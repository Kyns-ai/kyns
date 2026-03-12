"""
RunPod Serverless handler for KYNS image generation.

Supported models:
  - flux2klein: black-forest-labs/FLUX.2-klein-9B   (quality, 4 steps)
  - zimage:     Tongyi-MAI/Z-Image-Turbo            (speed, 9 steps)

Z-Image lives fully on CUDA (~16 GB).
FLUX.2 Klein uses CPU offloading (~29 GB peak during forward pass).
Both use BF16 and Flash Attention for maximum quality.
"""

import os
import io
import base64
import logging

import torch
import runpod
from diffusers import Flux2KleinPipeline, ZImagePipeline
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kyns-image")

VOLUME_PATH = os.getenv("VOLUME_PATH", "/runpod-volume")
HF_TOKEN = os.getenv("HF_TOKEN", "")

FLUX2_HF_ID = "black-forest-labs/FLUX.2-klein-9B"
ZIMAGE_HF_ID = "Tongyi-MAI/Z-Image-Turbo"

MODEL_DEFAULTS = {
    "flux2klein": {"steps": 4, "guidance_scale": 3.5},
    "zimage": {"steps": 9, "guidance_scale": 0.0},
}

pipes: dict = {}


def _cache_dir() -> str:
    path = os.path.join(VOLUME_PATH, "hf-cache")
    os.makedirs(path, exist_ok=True)
    return path


def _hf_kwargs() -> dict:
    kwargs: dict = {"cache_dir": _cache_dir()}
    if HF_TOKEN:
        kwargs["token"] = HF_TOKEN
    return kwargs


def load_flux2klein():
    logger.info("Loading FLUX.2 Klein 9B from %s …", FLUX2_HF_ID)
    try:
        pipe = Flux2KleinPipeline.from_pretrained(
            FLUX2_HF_ID,
            torch_dtype=torch.bfloat16,
            **_hf_kwargs(),
        )
        pipe.enable_model_cpu_offload()
        logger.info("FLUX.2 Klein 9B loaded (CPU offload).")
        return pipe
    except Exception as e:
        logger.error("Failed to load FLUX.2 Klein 9B: %s", e)
        return None


def load_zimage():
    logger.info("Loading Z-Image Turbo from %s …", ZIMAGE_HF_ID)
    try:
        pipe = ZImagePipeline.from_pretrained(
            ZIMAGE_HF_ID,
            torch_dtype=torch.bfloat16,
            **_hf_kwargs(),
        )
        pipe.to("cuda")
        logger.info("Z-Image Turbo loaded on CUDA.")
        return pipe
    except Exception as e:
        logger.error("Failed to load Z-Image Turbo: %s", e)
        return None


def preload():
    p = load_zimage()
    if p:
        pipes["zimage"] = p

    p = load_flux2klein()
    if p:
        pipes["flux2klein"] = p

    if not pipes:
        logger.error("No models loaded. Volume path: %s", VOLUME_PATH)
    else:
        logger.info("Ready. Loaded models: %s", list(pipes.keys()))


def handler(job: dict) -> dict:
    inp: dict = job.get("input", {})

    prompt = str(inp.get("prompt", "")).strip()
    model_key = str(inp.get("model", "flux2klein")).lower()
    width = max(64, min(2048, int(inp.get("width", 1024))))
    height = max(64, min(2048, int(inp.get("height", 1024))))

    if not prompt:
        return {"error": "prompt is required"}

    defaults = MODEL_DEFAULTS.get(model_key, MODEL_DEFAULTS["flux2klein"])
    steps = int(inp.get("steps", defaults["steps"]))
    cfg_scale = float(inp.get("cfg_scale", defaults["guidance_scale"]))

    pipe = pipes.get(model_key) or pipes.get("flux2klein")
    if pipe is None:
        return {"error": "No image model available. Check logs for loading errors."}

    logger.info(
        "Generating [%s] %dx%d steps=%d cfg=%.1f prompt='%.80s'",
        model_key, width, height, steps, cfg_scale, prompt,
    )

    gen_kwargs = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        "guidance_scale": cfg_scale,
    }

    with torch.inference_mode():
        result = pipe(**gen_kwargs)

    image: Image.Image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    logger.info("Image generated: %.1f KB (base64)", len(b64) / 1024)
    return {"image": b64}


if __name__ == "__main__":
    preload()
    runpod.serverless.start({"handler": handler})
