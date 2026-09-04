import os
import sys
import yaml
import torch
import nibabel as nib
import numpy as np
from monai.networks.nets import SegResNet, AttentionUnet
from monai.transforms import (
    Compose,
    LoadImage,
    EnsureChannelFirst,
    NormalizeIntensity,
    Spacing,
    Orientation,
    ToDevice,
    ToTensor
)
from monai.metrics import DiceMetric
from monai.inferers import sliding_window_inference

# Task 11.1 - Import from modules/ subfolders
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules', 'AttentionUNet'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules', 'MONAI_tutorials'))

try:
    # Try to import from AttentionUNet module if it exists
    from brain_tumor_segmentation.models import AttentionUNet as CustomAttentionUNet
except ImportError:
    CustomAttentionUNet = None

class SegmentationModel:
    """
    Core segmentation module for brain tumor identification.
    Uses MONAI networks for 3D medical image segmentation.
    """

    def __init__(self, config_path: str):
        """
        Initializes the segmentation model based on the configuration file.

        Args:
            config_path (str): Path to the config.yaml file.
        """
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)

        model_cfg = self.config['model']
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        if model_cfg['architecture'] == "attention_unet":
            if CustomAttentionUNet:
                self.model = CustomAttentionUNet(
                    spatial_dims=model_cfg['spatial_dims'],
                    in_channels=model_cfg['in_channels'],
                    out_channels=model_cfg['out_channels'],
                    channels=(16, 32, 64, 128, 256),
                    strides=(2, 2, 2, 2),
                ).to(self.device)
            else:
                self.model = AttentionUnet(
                    spatial_dims=model_cfg['spatial_dims'],
                    in_channels=model_cfg['in_channels'],
                    out_channels=model_cfg['out_channels'],
                    channels=(16, 32, 64, 128, 256),
                    strides=(2, 2, 2, 2),
                ).to(self.device)
        else:
            self.model = SegResNet(
                spatial_dims=model_cfg['spatial_dims'],
                init_filters=model_cfg['feature_size'],
                in_channels=model_cfg['in_channels'],
                out_channels=model_cfg['out_channels'],
            ).to(self.device)

        self.dice_metric = DiceMetric(include_background=False, reduction="mean")

    def load_weights(self, checkpoint_path: str):
        """
        Loads model weights from a .pth file.

        Args:
            checkpoint_path (str): Path to the checkpoint file.
        """
        if os.path.exists(checkpoint_path):
            self.model.load_state_dict(torch.load(checkpoint_path, map_location=self.device))
            self.model.eval()
            print(f"Weights loaded from {checkpoint_path}")
        else:
            print(f"Checkpoint not found at {checkpoint_path}")

    def preprocess(self, nifti_paths: list[str]) -> torch.Tensor:
        """
        Loads and preprocesses 4 MRI modalities (T1, T1ce, T2, FLAIR).

        Args:
            nifti_paths (list[str]): List of paths to the 4 NIfTI files.

        Returns:
            torch.Tensor: Preprocessed tensor of shape [1, 4, H, W, D].
        """
        # Note: The user requested Z-score normalization and 1mm isotropic resampling
        transforms = Compose([
            LoadImage(image_only=True),
            EnsureChannelFirst(),
            Orientation(axcodes="RAS"),
            Spacing(pixdim=(1.0, 1.0, 1.0), mode="bilinear"),
            NormalizeIntensity(nonzero=True, channel_wise=True),
            ToTensor()
        ])

        # Stack the 4 modalities
        modality_tensors = []
        for path in nifti_paths:
            img_tensor = transforms(path)
            modality_tensors.append(img_tensor)

        # Shape: [4, H, W, D]
        stacked_tensor = torch.cat(modality_tensors, dim=0)
        # Add batch dimension: [1, 4, H, W, D]
        return stacked_tensor.unsqueeze(0).to(self.device)

    def predict(self, tensor: torch.Tensor) -> torch.Tensor:
        """
        Runs inference on the input tensor.

        Args:
            tensor (torch.Tensor): Preprocessed input tensor.

        Returns:
            torch.Tensor: Softmax segmentation mask.
        """
        roi_size = self.config['training']['roi_size']
        with torch.no_grad():
            output = sliding_window_inference(
                inputs=tensor,
                roi_size=roi_size,
                sw_batch_size=4,
                predictor=self.model,
                overlap=0.5
            )
            return torch.softmax(output, dim=1)

    def compute_dice(self, pred: torch.Tensor, gt: torch.Tensor) -> torch.Tensor:
        """
        Computes the Dice score between prediction and ground truth.

        Args:
            pred (torch.Tensor): Predicted mask (one-hot or softmax).
            gt (torch.Tensor): Ground truth mask.

        Returns:
            torch.Tensor: Per-class Dice scores.
        """
        self.dice_metric(y_pred=pred, y=gt)
        dice = self.dice_metric.aggregate().item()
        self.dice_metric.reset()
        return dice

    def get_tumor_volume_cc(self, mask: np.ndarray, voxel_spacing: tuple) -> float:
        """
        Computes the tumor volume in cubic centimeters.

        Args:
            mask (np.ndarray): Binary segmentation mask.
            voxel_spacing (tuple): Voxel dimensions (dx, dy, dz) in mm.

        Returns:
            float: Tumor volume in cubic centimeters (cc).
        """
        voxel_volume_mm3 = np.prod(voxel_spacing)
        tumor_voxels = np.sum(mask > 0)
        volume_cc = (tumor_voxels * voxel_volume_mm3) / 1000.0
        return volume_cc
