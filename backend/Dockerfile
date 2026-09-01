FROM python:3.11-slim

WORKDIR /app

# build-essential: a few deps compile native extensions on some platforms
# espeak-ng: needed by pyttsx3 (offline TTS fallback) on Linux
# libgomp1: runtime dependency of onnxruntime/ctranslate2 (fastembed, faster-whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    espeak-ng \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 10 --timeout 100 -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
