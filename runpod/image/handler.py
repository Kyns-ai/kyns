"""
RunPod Serverless handler for KYNS image generation.

Models are loaded from HuggingFace Hub (preferred) or from a direct URL.
If a network volume is attached, models are cached there across restarts.

Primary models (HuggingFace Hub, no auth needed):
  - lustify: RunDiffusion/Juggernaut-XL-v9  (photorealistic, NSFW-capable)
  - zimage:  stabilityai/sdxl-turbo          (fast, 4 steps)

Override with env vars:
  LUSTIFY_HF_MODEL  (default: RunDiffusion/Juggernaut-XL-v9)
  ZIMAGE_HF_MODEL   (default: stabilityai/sdxl-turbo)
  LUSTIFY_MODEL_URL / ZIMAGE_MODEL_URL  (direct .safetensors URL as fallback)
  CIVITAI_TOKEN     (for CivitAI download auth, used when URL contains civitai.com)
  HF_TOKEN          (HuggingFace token for gated models)

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
from diffusers import StableDiffusionXLPipeline, AutoPipelineForText2Image
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kyns-image")

VOLUME_PATH = os.getenv("VOLUME_PATH", "/runpod-volume")
HF_TOKEN = os.getenv("HF_TOKEN", "")
CIVITAI_TOKEN = os.getenv("CIVITAI_TOKEN", "")

LUSTIFY_HF_MODEL = os.getenv("LUSTIFY_HF_MODEL", "RunDiffusion/Juggernaut-XL-v9")
ZIMAGE_HF_MODEL  = os.getenv("ZIMAGE_HF_MODEL",  "stabilityai/sdxl-turbo")

LUSTIFY_MODEL_URL = os.getenv("LUSTIFY_MODEL_URL", "")
ZIMAGE_MODEL_URL  = os.getenv("ZIMAGE_MODEL_URL",  "")

# Legacy safetensors filenames (used only when MODEL_URL is a direct file URL)
LUSTIFY_MODEL = os.getenv("LUSTIFY_MODEL", "lustify_model.safetensors")
ZIMAGE_MODEL  = os.getenv("ZIMAGE_MODEL",  "zimage_model.safetensors")

pipes: dict = {}


def _download_url(url: str, dest: str) -> bool:
    if not url:
        return False
    resolved_url = url
    if CIVITAI_TOKEN and "civitai.com" in url:
        sep = "&" if "?" in url else "?"
        resolved_url = f"{url}{sep}token={CIVITAI_TOKEN}"
    logger.info("Downloading from %s → %s ...", resolved_url.split("?")[0], dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; kyns-image-worker/2.0)"}
        if HF_TOKEN and "huggingface.co" in resolved_url:
            headers["Authorization"] = f"Bearer {HF_TOKEN}"
        req = urllib.request.Request(resolved_url, headers=headers)
        with urllib.request.urlopen(req, timeout=1800) as resp, open(dest, "wb") as f:
            downloaded = 0
            while chunk := resp.read(8 * 1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded % (500 * 1024 * 1024) < 8 * 1024 * 1024:
                    logger.info("  Downloaded %.1f MB ...", downloaded / 1e6)
        logger.info("Download complete: %.1f MB", os.path.getsize(dest) / 1e6)
        return True
    except Exception as e:
        logger.error("Download failed: %s", e)
        if os.path.exists(dest):
            os.remove(dest)
        return False


def _load_from_hf(model_key: str, hf_model_id: str) -> "StableDiffusionXLPipeline | None":
    cache_dir = os.path.join(VOLUME_PATH, "hf-cache")
    os.makedirs(cache_dir, exist_ok=True)
    logger.info("Loading %s from HuggingFace: %s (cache: %s)", model_key, hf_model_id, cache_dir)
    try:
        kwargs = {
            "torch_dtype": torch.float16,
            "use_safetensors": True,
            "cache_dir": cache_dir,
            "variant": "fp16",
        }
        if HF_TOKEN:
            kwargs["token"] = HF_TOKEN
        try:
            pipe = AutoPipelineForText2Image.from_pretrained(hf_model_id, **kwargs)
        except Exception:
            del kwargs["variant"]
            pipe = AutoPipelineForText2Image.from_pretrained(hf_model_id, **kwargs)
        pipe = pipe.to("cuda")
        try:
            pipe.enable_xformers_memory_efficient_attention()
        except Exception:
            pass
        logger.info("Model %s loaded from HuggingFace successfully.", model_key)
        return pipe
    except Exception as e:
        logger.error("Failed to load %s from HuggingFace: %s", model_key, e)
        return None


def _load_from_file(model_key: str, filename: str, download_url: str) -> "StableDiffusionXLPipeline | None":
    path = os.path.join(VOLUME_PATH, filename)
    if not os.path.exists(path):
        logger.warning("Model file not found: %s", path)
        if not download_url:
            return None
        if not _download_url(download_url, path):
            return None
    logger.info("Loading %s from file: %s", model_key, path)
    try:
        pipe = StableDiffusionXLPipeline.from_single_file(
            path,
            torch_dtype=torch.float16,
            use_safetensors=True,
        )
        pipe = pipe.to("cuda")
        try:
            pipe.enable_xformers_memory_efficient_attention()
        except Exception:
            pass
        logger.info("Model %s loaded from file successfully.", model_key)
        return pipe
    except Exception as e:
        logger.error("Failed to load %s from file: %s", model_key, e)
        return None


def load_model(model_key: str, hf_model_id: str, filename: str, download_url: str) -> "StableDiffusionXLPipeline | None":
    # Try file first (faster if already downloaded)
    path = os.path.join(VOLUME_PATH, filename)
    if os.path.exists(path):
        pipe = _load_from_file(model_key, filename, "")
        if pipe:
            return pipe

    # Try HuggingFace Hub (no IP restrictions, caches to volume)
    pipe = _load_from_hf(model_key, hf_model_id)
    if pipe:
        return pipe

    # Fallback: download from direct URL (CivitAI or other)
    if download_url:
        return _load_from_file(model_key, filename, download_url)

    return None


def preload():
    p = load_model("lustify", LUSTIFY_HF_MODEL, LUSTIFY_MODEL, LUSTIFY_MODEL_URL)
    if p:
        pipes["lustify"] = p

    p = load_model("zimage", ZIMAGE_HF_MODEL, ZIMAGE_MODEL, ZIMAGE_MODEL_URL)
    if p:
        pipes["zimage"] = p

    if not pipes:
        logger.error("No models loaded. Volume path: %s", VOLUME_PATH)
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

    is_turbo = "turbo" in getattr(pipe, "config", {}).get("_name_or_path", "").lower() or model_key == "zimage"
    gen_kwargs = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
    }
    if not is_turbo:
        gen_kwargs["negative_prompt"] = negative_prompt
        gen_kwargs["guidance_scale"] = cfg_scale
    else:
        gen_kwargs["guidance_scale"] = 0.0

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
