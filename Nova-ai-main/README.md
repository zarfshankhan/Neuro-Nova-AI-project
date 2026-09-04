<div align="center">

# Neuro Nova AI
### Brain Tumor Segmentation & Clinical Analysis Platform
#### Final Year Thesis Project — Computer Science / AI in Healthcare


> *"Combining state-of-the-art deep learning with a secure, role-based clinical platform to support radiologists and patients in the diagnosis and monitoring of brain tumours."*

</div>

---

## Table of Contents

1. [Abstract](#abstract)
2. [Key Features](#key-features)
3. [System Architecture](#system-architecture)
4. [Project Structure](#project-structure)
5. [Deep Learning Models](#deep-learning-models)
6. [Model Performance Results](#model-performance-results)
7. [The BraTS 2023 Dataset](#the-brats-2023-dataset)
8. [Prerequisites](#prerequisites)
9. [Installation & Local Setup](#installation--local-setup)
10. [How to Use the System](#how-to-use-the-system)
11. [Role-Based Access Control](#role-based-access-control)
12. [API Reference](#api-reference)
13. [Production Deployment](#production-deployment)
14. [References](#references)

---

## Abstract

Brain tumours — particularly gliomas — represent one of the most lethal and diagnostically challenging conditions in modern medicine. Radiologists currently rely on time-intensive manual review of multi-modal MRI scans, a process vulnerable to human error and institutional variability.

**Neuro Nova AI** addresses this challenge by delivering a full-stack, clinically aware AI platform that:

- Automatically segments brain tumour sub-regions from 3D multi-modal MRI using 8 state-of-the-art deep learning architectures
- Provides explainable AI overlays (GradCAM, SHAP) to build radiologist trust
- Implements a **doctor approval workflow** — AI-generated reports are gated behind clinical review before patients can access them
- Forecasts tumour growth trajectories using an LSTM-based predictor
- Enforces role-based access control (RBAC) separating doctor and patient capabilities

The platform is trained and evaluated on the **BraTS 2023** dataset (1,251 cases) and achieves a best mean Dice score of **88.96%** with SegResNet.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **3D Multi-modal Segmentation** | Simultaneous T1, T1ce, T2, FLAIR fusion for ET / TC / WT detection |
| **8 SOTA Architectures** | SegResNet, SwinUNETR, 3DUX-Net, UNETR, V-Net, AttentionUNet, nnFormer, UNet |
| **Explainable AI** | GradCAM class activation maps + SHAP voxel importance scores |
| **LSTM Growth Predictor** | 30 / 60 / 90-day tumour volume forecasting from historical data |
| **Doctor Approval Workflow** | All AI reports require clinical sign-off before patient delivery |
| **Role-Based Access** | Strictly separated Doctor and Patient portals |
| **HIPAA-aligned Security** | AES-256 encryption, TLS 1.3, audit trail, data minimisation |
| **Interactive UI** | Modern Vite + TypeScript SPA with SVG icons, dark/light themes |
| **REST API** | FastAPI backend with OpenAPI docs at `/docs` |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (SPA)                        │
│   Vite + TypeScript · Role-gated UI · SVG icon system  │
└─────────────────┬───────────────────────────────────────┘
                  │  HTTP  /api/*  (Vite proxy)
┌─────────────────▼───────────────────────────────────────┐
│                 FastAPI Backend                         │
│   /health  /models  /segment  /growth-predict           │
│   python-multipart · uvicorn · async endpoints          │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              MONAI Inference Pipeline                   │
│   Sliding-window 3D inference · 8 architectures        │
│   NIfTI I/O · GPU acceleration (optional)              │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Nova-ai/
├── api/
│   └── main.py                  # FastAPI application, all endpoints
├── frontend/
│   └── nova-frontend/
│       ├── src/
│       │   ├── main.ts          # Full UI — auth, pages, role gating, API calls
│       │   ├── icons.ts         # Lucide-style SVG icon set (zero emoji)
│       │   └── style.css        # Complete design system (light mode, CSS vars)
│       ├── index.html
│       ├── vite.config.ts       # Proxies /api → localhost:8000
│       └── package.json         # Scripts: dev, dev:all, build
├── README.md
└── requirements.txt             # Python dependencies
```

---

## Deep Learning Models

All models are implemented using the **MONAI** framework and trained on BraTS 2023 with 3D sliding-window inference. Each architecture takes 4-channel 3D input (T1, T1ce, T2, FLAIR) and outputs a 3-class segmentation mask (ET, TC, WT).

### 1. SegResNet *(Best Performance — 88.96% Dice)*
A residual encoder-decoder network with a compact decoder and variational autoencoder regularisation. Myronenko (2018). Best suited for clinical deployment due to speed and accuracy balance.

### 2. SwinUNETR *(86.60% Dice)*
Combines Swin Transformer hierarchical feature extraction with a U-Net decoder. Captures long-range spatial dependencies that CNNs miss. Hatamizadeh et al. (2021).

### 3. 3DUX-Net *(87.41% Dice)*
A large-kernel 3D CNN that bridges the gap between Transformers and convolutions. Efficient volumetric feature extraction with reduced parameter count.

### 4. UNETR *(87.05% Dice)*
Pure Transformer encoder (ViT) with a CNN decoder. Treats 3D patches as tokens and models global context from the first layer. Hatamizadeh et al. (2021).

### 5. Attention U-Net *(79.82% Dice)*
Classic U-Net augmented with attention gates that suppress irrelevant activations and focus on tumour regions. Oktay et al. (2018).

### 6. V-Net *(84.20% Dice)*
Fully convolutional volumetric network using 3D convolutions and residual connections throughout the encoder-decoder. Milletari et al. (2016).

### 7. nnFormer *(81.17% Dice)*
Interleaved local and global self-attention specifically designed for medical image segmentation. Uses volume-based patch embedding.

### 8. UNet *(54.41% Dice)*
The baseline 3D U-Net — symmetric encoder-decoder with skip connections. Included for benchmarking comparison against SOTA architectures.

---

## Model Performance Results

Trained for **300 epochs** on an NVIDIA RTX-4070 GPU. Evaluated on the BraTS 2023 held-out test set.

| Rank | Model | Mean Dice ↑ | Hausdorff Dist. ↓ | Sensitivity ↑ | Specificity ↑ |
|------|-------|------------|-------------------|---------------|---------------|
| 1 | **SegResNet** | **0.8896** | **8.65** | 0.9117 | 0.9932 |
| 2 | SwinUNETR | 0.8860 | 9.02 | 0.9034 | 0.9940 |
| 3 | 3DUX-Net | 0.8741 | 14.26 | 0.9244 | 0.9945 |
| 4 | UNETR | 0.8705 | 9.92 | 0.8902 | 0.9930 |
| 5 | V-Net | 0.8420 | 10.89 | 0.8278 | 0.9927 |
| 6 | nnFormer | 0.8117 | 10.07 | 0.8528 | 0.9923 |
| 7 | Attention U-Net | 0.7982 | 20.05 | 0.8570 | 0.9915 |
| 8 | UNet (baseline) | 0.5441 | 39.09 | 0.7377 | 0.9911 |

**Metrics explained:**
- **Mean Dice** — overlap between predicted and ground-truth segmentation (higher = better)
- **Hausdorff Distance** — maximum surface distance error in mm (lower = better)
- **Sensitivity** — true positive rate (ability to detect tumour)
- **Specificity** — true negative rate (ability to exclude healthy tissue)

---

## The BraTS 2023 Dataset

The **Brain Tumor Segmentation (BraTS) 2023** challenge dataset contains multi-parametric MRI (mpMRI) scans of glioma patients, all co-registered to the same anatomical template and skull-stripped.

### Modalities
| Modality | Description |
|----------|-------------|
| **T1** | Native T1-weighted — anatomy reference |
| **T1ce** | Contrast-enhanced T1 — highlights active tumour (ET) |
| **T2** | T2-weighted — peritumoral oedema visible |
| **FLAIR** | T2 Fluid Attenuated Inversion Recovery — whole tumour extent |

### Tumour Sub-regions
| Label | Sub-region | Description |
|-------|-----------|-------------|
| ET | Enhancing Tumour | Active tumour cells, visible on T1ce |
| NCR | Necrotic Core | Dead tumour cells in the tumour core |
| ED | Peritumoral Edema | Swollen tissue surrounding the core |
| TC | Tumour Core | ET + NCR (clinical target volume) |
| WT | Whole Tumour | ET + NCR + ED (total affected region) |

### Dataset Split
| Split | Cases |
|-------|-------|
| Training | 833 |
| Validation | 209 |
| Test | 209 |
| **Total** | **1,251** |

Dataset available at: https://www.synapse.org/Synapse:syn51156910

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend tooling |
| npm | 9+ | Package manager |
| PyTorch | 2.x (optional) | Real model inference (demo mode works without it) |
| CUDA GPU | Optional | ~8× inference speedup over CPU |

---

## Installation & Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/Nova-ai.git
cd Nova-ai
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

For full model inference (optional):
```bash
pip install torch torchvision monai nibabel
```

### 3. Install frontend dependencies

```bash
cd frontend/nova-frontend
npm install
```

### 4. Start everything with one command

```bash
# From frontend/nova-frontend/
npm run dev:all
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### Run separately (alternative)

**Backend:**
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend/nova-frontend
npm run dev
```

---

## How to Use the System

### Step 1 — Open the app
Navigate to `http://localhost:5173`. You will see the login screen.

### Step 2 — Choose your role
Select **Doctor** or **Patient** using the role buttons. Use the **Demo Doctor** / **Demo Patient** buttons for instant access without registration.

---

### Doctor Portal

#### Running Segmentation
1. Go to **Models** → select an architecture (default: SegResNet)
2. Go to **Segmentation** → upload `.nii` / `.nii.gz` files for T1, T1ce, T2, FLAIR
3. Click **Run Segmentation**
4. View Dice scores, tumour volumes (cc), and severity rating

#### Reviewing Patient Reports
1. Go to **Review Reports** — the sidebar badge shows pending count
2. Review the AI metrics for each patient submission
3. Add an optional clinical note
4. Click **Approve & Send to Patient** or **Reject**

#### Other Doctor Tools
- **Growth Predictor** — enter historical volumes and days, get 30/60/90-day forecasts
- **Explainable AI** — GradCAM heatmap demo and SHAP overview
- **API Explorer** — test all backend endpoints live

---

### Patient Portal

#### Submitting a Scan
1. Go to **Upload Scan**
2. Upload one or more NIfTI files (T1, T1ce, T2, FLAIR)
3. Click **Submit for Analysis**
4. Status shows as **Pending** — waiting for doctor review

#### Viewing Reports
1. Go to **My Reports**
2. Only **doctor-approved** reports are visible here
3. Each approved report shows Dice scores, tumour volumes, severity, and the doctor's note

> Patients never see raw AI output — a doctor must review and approve every result first.

---

## Role-Based Access Control

| Feature | Doctor | Patient |
|---------|:------:|:-------:|
| Full dashboard & stats | Yes | Personal stats only |
| Segmentation tool | Yes | No |
| Model selection | Yes | No |
| Growth predictor | Yes | No |
| Explainable AI page | Yes | No |
| API Explorer | Yes | No |
| Review & approve reports | Yes | No |
| Upload MRI scan | Yes | Yes |
| View reports | All patients | Own approved only |
| Privacy & Education pages | Yes | Yes |

---

## API Reference

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health, CUDA availability |
| GET | `/models` | All 8 architectures with Dice scores |
| GET | `/dataset-stats` | BraTS 2023 dataset statistics |
| POST | `/segment` | Run brain tumour segmentation |
| POST | `/growth-predict` | LSTM tumour growth prediction |

**POST /segment** — `multipart/form-data`
```
model_id  : string   (e.g. "segresnet")
t1        : file     (.nii / .nii.gz)
t1ce      : file     (.nii / .nii.gz)
t2        : file     (.nii / .nii.gz)
flair     : file     (.nii / .nii.gz)
```

**POST /growth-predict** — `multipart/form-data`
```
volumes    : JSON string  (e.g. "[10.2, 11.5, 13.0]")
timepoints : JSON string  (e.g. "[0, 30, 60]")
```

Full interactive docs: `http://localhost:8000/docs`

---

## Production Deployment

### Backend — Docker

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY api/ ./api/
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```bash
docker build -t nova-ai-backend .
docker run -p 8000:8000 nova-ai-backend
```

### Frontend — Static Build

```bash
cd frontend/nova-frontend
npm run build          # outputs to dist/
```

**Nginx:**
```nginx
server {
  listen 80;
  root /var/www/nova-ai/dist;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ { proxy_pass http://localhost:8000/; }
}
```

**Netlify / Vercel:**
- Build command: `npm run build`
- Publish directory: `frontend/nova-frontend/dist`

---

## References

1. Menze, B.H. et al. "The multimodal brain tumor image segmentation benchmark (BRATS)." *IEEE TMI* (2015).
2. Myronenko, A. "3D MRI brain tumor segmentation using autoencoder regularization." *BrainLes @ MICCAI* (2018). — **SegResNet**
3. Hatamizadeh, A. et al. "Swin UNETR: Swin Transformers for semantic segmentation of brain tumors." *BrainLes @ MICCAI* (2021). — **SwinUNETR**
4. Hatamizadeh, A. et al. "UNETR: Transformers for 3D medical image segmentation." *WACV* (2022). — **UNETR**
5. Oktay, O. et al. "Attention U-Net: Learning where to look for the pancreas." *MIDL* (2018). — **Attention U-Net**
6. Milletari, F., Navab, N., Ahmadi, S.A. "V-Net: Fully convolutional neural networks for volumetric medical image segmentation." *3DV* (2016). — **V-Net**
7. Ronneberger, O., Fischer, P., Brox, T. "U-Net: Convolutional networks for biomedical image segmentation." *MICCAI* (2015). — **UNet**
8. Zhou, H.Y. et al. "nnFormer: Volumetric medical image segmentation via a 3D transformer." *IEEE TMI* (2023). — **nnFormer**
9. Lee, H.H. et al. "3D UX-Net: A large kernel volumetric ConvNet." *ICLR* (2023). — **3DUX-Net**
10. Cardoso, M.J. et al. "MONAI: An open-source framework for deep learning in healthcare." *arXiv:2211.02701* (2022).
11. Selvaraju, R.R. et al. "Grad-CAM: Visual explanations from deep networks." *ICCV* (2017).
12. Lundberg, S.M., Lee, S.I. "A unified approach to interpreting model predictions (SHAP)." *NeurIPS* (2017).

---

<div align="center">

**Neuro Nova AI** — Thesis Project

*Built with FastAPI · Vite · MONAI · BraTS 2023*

</div>
