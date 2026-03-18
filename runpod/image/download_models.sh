#!/usr/bin/env bash
# Pre-download KYNS image models to RunPod network volume.
# Run ONCE from a pod with the volume mounted at /runpod-volume.
# Usage: HF_TOKEN=hf_xxx bash download_models.sh

set -e

VOLUME_PATH="${VOLUME_PATH:-/runpod-volume}"
CACHE_DIR="$VOLUME_PATH/hf-cache"
mkdir -p "$CACHE_DIR"

pip install -q huggingface_hub

echo "==> Downloading Z-Image Turbo (Tongyi-MAI/Z-Image-Turbo) ..."
HF_XET_HIGH_PERFORMANCE=1 python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('Tongyi-MAI/Z-Image-Turbo', cache_dir='$CACHE_DIR')
print('Z-Image Turbo downloaded.')
"

echo ""
echo "==> Downloading FLUX.2 Klein 9B (black-forest-labs/FLUX.2-klein-9B) ..."
echo "    NOTE: This model is gated. HF_TOKEN must have accepted the license."
HF_XET_HIGH_PERFORMANCE=1 python3 -c "
import os
from huggingface_hub import snapshot_download
token = os.getenv('HF_TOKEN', '')
snapshot_download('black-forest-labs/FLUX.2-klein-9B', cache_dir='$CACHE_DIR', token=token or None)
print('FLUX.2 Klein 9B downloaded.')
"

echo ""
echo "==> Done. Cache contents:"
du -sh "$CACHE_DIR"/*
