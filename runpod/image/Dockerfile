FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-devel

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 wget curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

COPY handler.py /handler.py

ENV VOLUME_PATH=/runpod-volume
ENV HF_HOME=/runpod-volume/hf-cache
ENV TRANSFORMERS_CACHE=/runpod-volume/hf-cache
ENV LUSTIFY_MODEL=lustifySDXLNSFW_ggwpV7.safetensors
ENV ZIMAGE_MODEL=zImageTurbo_v1.safetensors

CMD ["python3", "/handler.py"]
