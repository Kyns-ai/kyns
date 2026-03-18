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
import traceback

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
_preload_errors: list = []


def _gpu_memory() -> dict | None:
    if not torch.cuda.is_available():
        return None
    return {
        "allocated_mb": round(torch.cuda.memory_allocated() / 1024 / 1024, 1),
        "reserved_mb": round(torch.cuda.memory_reserved() / 1024 / 1024, 1),
        "total_mb": round(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024, 1),
    }


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
            low_cpu_mem_usage=False,
            **_hf_kwargs(),
        )
        pipe.to("cuda")
        logger.info("FLUX.2 Klein 9B loaded on CUDA.")
        return pipe
    except Exception as e:
        logger.error("Failed to load FLUX.2 Klein 9B: %s", e)
        _preload_errors.append({"model": "flux2klein", "error": str(e), "trace": traceback.format_exc()[:2000]})
        return None


def load_zimage():
    logger.info("Loading Z-Image Turbo from %s …", ZIMAGE_HF_ID)
    try:
        pipe = ZImagePipeline.from_pretrained(
            ZIMAGE_HF_ID,
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=False,
            **_hf_kwargs(),
        )
        pipe.to("cuda")
        logger.info("Z-Image Turbo loaded on CUDA.")
        return pipe
    except Exception as e:
        logger.error("Failed to load Z-Image Turbo: %s", e)
        _preload_errors.append({"model": "zimage", "error": str(e), "trace": traceback.format_exc()[:2000]})
        return None


def preload():
    p = load_zimage()
    if p:
        pipes["zimage"] = p

    p = load_flux2klein()
    if p:
        pipes["flux2klein"] = p
    elif FLUX2_HF_ID:
        logger.warning("FLUX.2 Klein failed on CUDA, retrying with CPU offload…")
        try:
            pipe = Flux2KleinPipeline.from_pretrained(
                FLUX2_HF_ID,
                torch_dtype=torch.bfloat16,
                low_cpu_mem_usage=False,
                **_hf_kwargs(),
            )
            pipe.enable_model_cpu_offload()
            pipes["flux2klein"] = pipe
            logger.info("FLUX.2 Klein 9B loaded (CPU offload fallback).")
        except Exception as e:
            logger.error("FLUX.2 Klein CPU offload fallback also failed: %s", e)

    if not pipes:
        logger.error("No models loaded. Volume path: %s", VOLUME_PATH)
    else:
        logger.info("Ready. Loaded models: %s", list(pipes.keys()))


def handler(job: dict) -> dict:
    inp: dict = job.get("input", {})

    prompt = str(inp.get("prompt", "")).strip()
    negative_prompt = str(inp.get("negative_prompt", "")).strip() or None
    model_key = str(inp.get("model", "flux2klein")).lower()
    width = max(64, min(2048, int(inp.get("width", 1024))))
    height = max(64, min(2048, int(inp.get("height", 1024))))

    if not prompt:
        return {"error": "prompt is required", "error_type": "validation"}

    defaults = MODEL_DEFAULTS.get(model_key, MODEL_DEFAULTS["flux2klein"])
    steps = int(inp.get("steps", defaults["steps"]))
    cfg_scale = float(inp.get("cfg_scale", defaults["guidance_scale"]))

    pipe = pipes.get(model_key) or pipes.get("flux2klein")
    if pipe is None:
        return {
            "error": "No image model available. Check logs for loading errors.",
            "error_type": "model_unavailable",
            "preload_errors": _preload_errors,
            "gpu_memory": _gpu_memory(),
        }

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
    if negative_prompt:
        gen_kwargs["negative_prompt"] = negative_prompt

    try:
        with torch.inference_mode():
            result = pipe(**gen_kwargs)

        image: Image.Image = result.images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        logger.info("Image generated: %.1f KB (base64)", len(b64) / 1024)
        return {"image": b64}
    except Exception as e:
        logger.error("Inference failed [%s]: %s", model_key, e)
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()[:2000],
            "gpu_memory": _gpu_memory(),
            "model": model_key,
        }


if __name__ == "__main__":
    preload()
    runpod.serverless.start({"handler": handler})
