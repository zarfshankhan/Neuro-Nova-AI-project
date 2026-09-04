import os
import sys
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

app = FastAPI(
    title="Neuro Nova AI API",
    description="Brain Tumor Segmentation & Analysis API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "nova_ai_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {"message": "Neuro Nova AI API is running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    try:
        import torch
        cuda = torch.cuda.is_available()
        device = "cuda" if cuda else "cpu"
    except ImportError:
        cuda = False
        device = "cpu (torch not installed)"
    return {
        "status": "healthy",
        "cuda_available": cuda,
        "device": device
    }


@app.get("/models")
def list_models():
    return {
        "models": [
            {"id": "segresnet", "name": "SegResNet", "dice_score": 0.8896, "description": "Residual encoder-decoder network for 3D medical image segmentation"},
            {"id": "attention_unet", "name": "Attention U-Net", "dice_score": 0.7982, "description": "U-Net with attention gates for improved feature selection"},
            {"id": "swin_unetr", "name": "SwinUNETR", "dice_score": 0.8860, "description": "Swin Transformer-based UNETR for brain tumor segmentation"},
            {"id": "unetr", "name": "UNETR", "dice_score": 0.8705, "description": "Transformer-based UNETR architecture"},
            {"id": "nn_former", "name": "nnFormer", "dice_score": 0.8117, "description": "Nested transformer for 3D medical image segmentation"},
            {"id": "3duxnet", "name": "3D UX-Net", "dice_score": 0.8741, "description": "Volumetric convolution for volumetric medical image segmentation"},
            {"id": "vnet", "name": "V-Net", "dice_score": 0.842, "description": "Fully convolutional neural network for volumetric medical image segmentation"},
            {"id": "unet", "name": "U-Net", "dice_score": 0.5441, "description": "Classic encoder-decoder U-Net architecture"},
        ]
    }


@app.post("/segment")
async def segment(
    t1: Optional[UploadFile] = File(None),
    t1ce: Optional[UploadFile] = File(None),
    t2: Optional[UploadFile] = File(None),
    flair: Optional[UploadFile] = File(None),
    model_id: str = Form("segresnet"),
):
    """
    Accepts up to 4 MRI modalities (NIfTI .nii / .nii.gz) and returns
    a simulated segmentation result (demo mode when no weights provided).
    """
    uploaded = {}
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    try:
        for label, file_obj in [("t1", t1), ("t1ce", t1ce), ("t2", t2), ("flair", flair)]:
            if file_obj is not None:
                dest = session_dir / f"{label}_{file_obj.filename}"
                with open(dest, "wb") as f:
                    shutil.copyfileobj(file_obj.file, f)
                uploaded[label] = str(dest)

        if not uploaded:
            raise HTTPException(status_code=400, detail="At least one NIfTI file must be uploaded.")

        # Demo / simulation result (no real model weights required to run)
        np.random.seed(42)
        result = _simulate_segmentation(uploaded, model_id)
        result["session_id"] = session_id
        return JSONResponse(content=result)

    finally:
        # Clean up uploaded files
        shutil.rmtree(session_dir, ignore_errors=True)


@app.post("/growth-predict")
async def growth_predict(
    volumes: str = Form(...),  # JSON array of historical volumes (cc)
    timepoints: str = Form(...),  # JSON array of days since first scan
):
    """
    Predicts future tumor growth given historical volume measurements.
    Accepts comma-separated or JSON-formatted volume history.
    """
    import json
    try:
        volume_list = json.loads(volumes)
        timepoint_list = json.loads(timepoints)
    except Exception:
        raise HTTPException(status_code=422, detail="volumes and timepoints must be valid JSON arrays.")

    if len(volume_list) < 1:
        raise HTTPException(status_code=400, detail="At least one volume datapoint required.")

    result = _simulate_growth_prediction(volume_list, timepoint_list)
    return JSONResponse(content=result)


@app.get("/dataset-stats")
def dataset_stats():
    return {
        "dataset": "BraTS 2023",
        "total_cases": 1251,
        "train_cases": 833,
        "val_cases": 209,
        "test_cases": 209,
        "modalities": ["T1", "T1ce", "T2", "FLAIR"],
        "tumor_regions": {
            "ET": "Enhancing Tumor (label 3)",
            "ED": "Peritumoral Edema (label 2)",
            "NCR": "Necrotic Core (label 1)"
        },
        "evaluation_regions": ["ET", "TC (ET+NCR)", "WT (ET+NCR+ED)"]
    }


# ---------------------------------------------------------------------------
# Helper simulation functions (demo mode – no model weights needed)
# ---------------------------------------------------------------------------

def _simulate_segmentation(uploaded: dict, model_id: str) -> dict:
    np.random.seed(hash(model_id) % (2**31))
    model_dice = {
        "segresnet": 0.8896,
        "attention_unet": 0.7982,
        "swin_unetr": 0.8860,
        "unetr": 0.8705,
        "nn_former": 0.8117,
        "3duxnet": 0.8741,
        "vnet": 0.842,
        "unet": 0.5441,
    }
    base_dice = model_dice.get(model_id, 0.85)
    noise = np.random.uniform(-0.02, 0.02)

    et_volume = round(float(np.random.uniform(5, 25)), 2)
    ncr_volume = round(float(np.random.uniform(8, 30)), 2)
    ed_volume = round(float(np.random.uniform(20, 60)), 2)
    total_volume = round(et_volume + ncr_volume + ed_volume, 2)

    return {
        "model": model_id,
        "modalities_used": list(uploaded.keys()),
        "status": "demo",
        "note": "Simulated result – no model weights loaded. Upload real .nii.gz files and provide weights for actual inference.",
        "metrics": {
            "dice_ET": round(base_dice + noise, 4),
            "dice_TC": round(base_dice + np.random.uniform(-0.01, 0.01), 4),
            "dice_WT": round(base_dice + np.random.uniform(-0.01, 0.02), 4),
        },
        "tumor_volumes_cc": {
            "enhancing_tumor_ET": et_volume,
            "necrotic_core_NCR": ncr_volume,
            "peritumoral_edema_ED": ed_volume,
            "total_tumor_WT": total_volume,
        },
        "severity": _classify_severity(total_volume),
    }


def _simulate_growth_prediction(volumes: list, timepoints: list) -> dict:
    if len(volumes) >= 2:
        rate = (volumes[-1] - volumes[0]) / max(timepoints[-1] - timepoints[0], 1)
    else:
        rate = 0.1

    last_vol = volumes[-1]
    return {
        "status": "demo",
        "historical_volumes_cc": volumes,
        "historical_timepoints_days": timepoints,
        "growth_rate_cc_per_day": round(rate, 4),
        "predictions": {
            "day_30": round(last_vol + rate * 30, 2),
            "day_60": round(last_vol + rate * 60, 2),
            "day_90": round(last_vol + rate * 90, 2),
        },
        "risk_assessment": _growth_risk(rate),
    }


def _classify_severity(total_volume_cc: float) -> str:
    if total_volume_cc < 15:
        return "Low"
    elif total_volume_cc < 40:
        return "Moderate"
    else:
        return "High"


def _growth_risk(rate_per_day: float) -> str:
    if rate_per_day < 0.05:
        return "Stable"
    elif rate_per_day < 0.2:
        return "Slow Growth"
    elif rate_per_day < 0.5:
        return "Moderate Growth"
    else:
        return "Rapid Growth"
