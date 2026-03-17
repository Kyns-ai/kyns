FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

ARG CHATTERBOX_TTS_API_REF=a5f466128e4baa8e4cceb3bba9b7ca9de6f7ec6b

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    wget \
    curl \
    build-essential \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/travisvn/chatterbox-tts-api.git /opt/chatterbox-tts-api \
    && cd /opt/chatterbox-tts-api \
    && git fetch --depth 1 origin "${CHATTERBOX_TTS_API_REF}" \
    && git checkout "${CHATTERBOX_TTS_API_REF}"

WORKDIR /opt/chatterbox-tts-api

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch==2.6.0+cpu torchaudio==2.6.0+cpu --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir \
        fastapi \
        "uvicorn[standard]" \
        python-dotenv \
        python-multipart \
        requests \
        psutil \
        pydub \
        sse-starlette \
    && pip install --no-cache-dir git+https://github.com/travisvn/chatterbox-multilingual.git@exp

RUN mkdir -p /cache /voices /data/long_text_jobs

ENV HOST=0.0.0.0
ENV PORT=4123
ENV DEVICE=cpu
ENV USE_MULTILINGUAL_MODEL=true
ENV EXAGGERATION=0.5
ENV CFG_WEIGHT=0.5
ENV TEMPERATURE=0.6
ENV MAX_CHUNK_LENGTH=200
ENV MAX_TOTAL_LENGTH=3000
ENV MODEL_CACHE_DIR=/cache
ENV VOICE_LIBRARY_DIR=/voices
ENV LONG_TEXT_DATA_DIR=/data/long_text_jobs
ENV LONG_TEXT_MAX_LENGTH=100000
ENV LONG_TEXT_CHUNK_SIZE=2500
ENV LONG_TEXT_SILENCE_PADDING_MS=200
ENV LONG_TEXT_JOB_RETENTION_DAYS=7
ENV LONG_TEXT_MAX_CONCURRENT_JOBS=3
ENV ENABLE_MEMORY_MONITORING=false

EXPOSE 4123

HEALTHCHECK --interval=30s --timeout=30s --start-period=5m --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["python", "main.py"]
