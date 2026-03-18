FROM nvidia/cuda:12.9.1-base-ubuntu22.04

RUN apt-get update -y \
 && apt-get install -y python3-pip git

RUN ldconfig /usr/local/cuda-12.9/compat/

RUN python3 -m pip install --upgrade pip && \
    python3 -m pip install "vllm[flashinfer]==0.16.0" --extra-index-url https://download.pytorch.org/whl/cu129

COPY builder/requirements.txt /requirements.txt
RUN python3 -m pip install --upgrade -r /requirements.txt

ARG VLLM_NIGHTLY="true"

RUN pip install -U vllm --pre --index-url https://pypi.org/simple --extra-index-url https://wheels.vllm.ai/nightly && \
    pip install git+https://github.com/huggingface/transformers.git

ENV MODEL_NAME="" \
    BASE_PATH="/runpod-volume" \
    HF_DATASETS_CACHE="/runpod-volume/huggingface-cache/datasets" \
    HUGGINGFACE_HUB_CACHE="/runpod-volume/huggingface-cache/hub" \
    HF_HOME="/runpod-volume/huggingface-cache/hub" \
    HF_HUB_ENABLE_HF_TRANSFER=0 \
    RAY_METRICS_EXPORT_ENABLED=0 \
    RAY_DISABLE_USAGE_STATS=1 \
    TOKENIZERS_PARALLELISM=false \
    RAYON_NUM_THREADS=4 \
    PYTHONPATH="/:/vllm-workspace"

COPY src /src

CMD ["python3", "/src/handler.py"]
