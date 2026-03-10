"""
RunPod Serverless handler for KYNS image generation.

Models loaded from network volume on startup.
If not present, downloads from CivitAI or a direct URL.

Input:
  {
    "prompt": "...",
    "model": "lustify" | "zimage",
    "width": 1024, "height": 1024,
    "steps": 30, "cfg_scale": 7.0,
    "negative_prompt": "..."
  }

Output:
  {"image": "<base64 PNG>"}
"""

import os
import io
import base64
import logging
import urllib.request

import torch
import runpod
from diffusers import StableDiffusionXLPipeline
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kyns-image")

VOLUME_PATH    = os.getenv("VOLUME_PATH",    "/runpod-volume")
LUSTIFY_MODEL  = os.getenv("LUSTIFY_MODEL",  "lustifySDXLNSFW_ggwpV7.safetensors")
ZIMAGE_MODEL   = os.getenv("ZIMAGE_MODEL",   "zImageTurbo_v1.safetensors")
CIVITAI_TOKEN  = os.getenv("CIVITAI_TOKEN",  "")

# Set these env vars in the RunPod endpoint to auto-download models if missing:
# LUSTIFY_MODEL_URL=https://civitai.com/api/download/models/XXXXX
# ZIMAGE_MODEL_URL=https://civitai.com/api/download/models/YYYYY
LUSTIFY_MODEL_URL = os.getenv("LUSTIFY_MODEL_URL", "")
ZIMAGE_MODEL_URL  = os.getenv("ZIMAGE_MODEL_URL",  "")

pipes: dict = {}


def _download(url: str, dest: str) -> bool:
    if not url:
        return False
    if CIVITAI_TOKEN and "civitai.com" in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}token={CIVITAI_TOKEN}"
    logger.info("Downloading model from %s → %s ...", url.split("?")[0], dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "kyns-image-worker/1.0"})
        with urllib.request.urlopen(req, timeout=1800) as resp, open(dest, "wb") as f:
            downloaded = 0
            while chunk := resp.read(8 * 1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                logger.info("  Downloaded %.1f MB ...", downloaded / 1e6)
        logger.info("Download complete: %.1f MB", os.path.getsize(dest) / 1e6)
        return True
    except Exception as e:
        logger.error("Download failed: %s", e)
        if os.path.exists(dest):
            os.remove(dest)
        return False


def load_pipe(model_key: str, filename: str, download_url: str) -> object | None:
    path = os.path.join(VOLUME_PATH, filename)

    if not os.path.exists(path):
        logger.warning("Model not found: %s", path)
        if download_url:
            ok = _download(download_url, path)
            if not ok:
                logger.error("Could not download %s — set %s_MODEL_URL in endpoint env vars.", filename, model_key.upper())
                return None
        else:
            logger.error(
                "Model %s missing. Set %s_MODEL_URL in RunPod endpoint env vars to auto-download.",
                filename, model_key.upper()
            )
            return None

    logger.info("Loading model %s from %s ...", model_key, path)
    try:
        pipe = StableDiffusionXLPipeline.from_single_file(
            path,
            torch_dtype=torch.float16,
            use_safetensors=True,
        )
        pipe = pipe.to("cuda")
        pipe.enable_xformers_memory_efficient_attention()
        logger.info("Model %s loaded successfully.", model_key)
        return pipe
    except Exception as e:
        logger.error("Failed to load model %s: %s", model_key, e)
        return None


def preload():
    p = load_pipe("lustify", LUSTIFY_MODEL, LUSTIFY_MODEL_URL)
    if p:
        pipes["lustify"] = p

    p = load_pipe("zimage", ZIMAGE_MODEL, ZIMAGE_MODEL_URL)
    if p:
        pipes["zimage"] = p

    if not pipes:
        logger.error(
            "No models loaded. Volume path: %s. Set LUSTIFY_MODEL_URL / ZIMAGE_MODEL_URL to download.",
            VOLUME_PATH
        )
    else:
        logger.info("Ready. Loaded models: %s", list(pipes.keys()))


def handler(job: dict) -> dict:
    inp: dict = job.get("input", {})

    prompt          = str(inp.get("prompt", "")).strip()
    model_key       = str(inp.get("model", "lustify")).lower()
    width           = max(64, min(2048, int(inp.get("width", 1024))))
    height          = max(64, min(2048, int(inp.get("height", 1024))))
    steps           = max(1, min(150, int(inp.get("steps", 30))))
    cfg_scale       = float(inp.get("cfg_scale", 7.0))
    negative_prompt = str(inp.get("negative_prompt", "lowres, blurry, bad anatomy, worst quality"))

    if not prompt:
        return {"error": "prompt is required"}

    pipe = pipes.get(model_key) or pipes.get("lustify")
    if pipe is None:
        return {"error": "No image model available. Check RunPod endpoint volume and model URLs."}

    logger.info("Generating [%s] %dx%d steps=%d prompt='%.80s'", model_key, width, height, steps, prompt)

    with torch.inference_mode():
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=cfg_scale,
        )

    image: Image.Image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    logger.info("Image generated: %.1f KB (base64)", len(b64) / 1024)
    return {"image": b64}


if __name__ == "__main__":
    preload()
    runpod.serverless.start({"handler": handler})
