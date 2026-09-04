import torch
import torch.nn as nn
import numpy as np
from scipy.stats import skew, kurtosis, entropy
from skimage.measure import mesh_surface_area, marching_cubes

class GrowthPredictor(nn.Module):
    """
    LSTM-based model to predict tumor growth over time based on radiomic features.
    """

    def __init__(self, input_size=10, hidden_size=64, num_layers=3, dropout=0.3):
        """
        Initializes the GrowthPredictor LSTM model.
        """
        super(GrowthPredictor, self).__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout,
            batch_first=True
        )
        self.fc = nn.Linear(hidden_size, 3)  # Predicts volume at +30, +60, +90 days

    def forward(self, x):
        """
        Forward pass for the LSTM.
        """
        out, _ = self.lstm(x)
        # Use the last hidden state for prediction
        out = self.fc(out[:, -1, :])
        return out

    def extract_radiomic_features(self, mask: np.ndarray, image: np.ndarray, voxel_spacing: tuple) -> np.ndarray:
        """
        Extracts 10 radiomic features from a segmentation mask and its corresponding image.

        Args:
            mask (np.ndarray): Binary segmentation mask.
            image (np.ndarray): Corresponding MRI image (e.g., FLAIR).
            voxel_spacing (tuple): Voxel dimensions (dx, dy, dz) in mm.

        Returns:
            np.ndarray: Vector of 10 radiomic features.
        """
        # 1. Volume (cc)
        voxel_volume_mm3 = np.prod(voxel_spacing)
        volume_cc = (np.sum(mask > 0) * voxel_volume_mm3) / 1000.0

        # 2. Surface Area
        # Using marching cubes to get surface area
        if np.sum(mask) > 0:
            verts, faces, _, _ = marching_cubes(mask, level=0.5)
            surface_area = mesh_surface_area(verts, faces)
        else:
            surface_area = 0.0

        # 3. Sphericity
        if volume_cc > 0:
            sphericity = (np.pi**(1/3) * (6 * volume_cc * 1000)**(2/3)) / surface_area
        else:
            sphericity = 0.0

        # 4-5. Shape features (Elongation, Compactness - Simplified)
        # For a real implementation, use PCA on coordinates of mask voxels
        elongation = 1.0  # Placeholder
        compactness = surface_area / (volume_cc * 1000)**(2/3) if volume_cc > 0 else 0.0

        # Intensity features
        tumor_voxels = image[mask > 0]
        if len(tumor_voxels) > 0:
            mean_intensity = np.mean(tumor_voxels)
            std_intensity = np.std(tumor_voxels)
            skewness = skew(tumor_voxels)
            kurt = kurtosis(tumor_voxels)
            
            # Entropy
            hist, _ = np.histogram(tumor_voxels, bins=10, density=True)
            ent = entropy(hist + 1e-6)
        else:
            mean_intensity = std_intensity = skewness = kurt = ent = 0.0

        return np.array([
            volume_cc, surface_area, sphericity, elongation,
            compactness, mean_intensity, std_intensity,
            skewness, kurt, ent
        ])

    def predict_growth(self, feature_sequence: np.ndarray, days=90) -> dict:
        """
        Predicts future tumor volume based on a sequence of historical features.

        Args:
            feature_sequence (np.ndarray): Sequence of radiomic feature vectors.
            days (int): Total future days to predict (default 90).

        Returns:
            dict: Predicted volumes at +30, +60, +90 days and volumetric velocity.
        """
        self.eval()
        input_tensor = torch.FloatTensor(feature_sequence).unsqueeze(0)
        with torch.no_grad():
            predictions = self.forward(input_tensor).numpy()[0]

        # Calculate volumetric velocity (rate of change cc/day)
        # Based on the last two timepoints if available
        if len(feature_sequence) >= 2:
            vol_change = feature_sequence[-1, 0] - feature_sequence[-2, 0]
            # Assuming timepoints are 30 days apart for velocity calculation
            velocity = vol_change / 30.0
        else:
            velocity = 0.0

        return {
            "prediction_30_days": predictions[0],
            "prediction_60_days": predictions[1],
            "prediction_90_days": predictions[2],
            "volumetric_velocity": velocity
        }
