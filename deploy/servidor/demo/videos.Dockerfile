# Navegador de la demostración más lo necesario para grabar los videos:
# una pantalla virtual (Xvfb), ffmpeg con H.264 y AAC, y la voz sin conexión
# (Piper con dos voces abiertas de español de México). La construye videos.sh.
FROM mcr.microsoft.com/playwright:v1.52.0-noble
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg xvfb python3 python3-pip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --break-system-packages "piper-tts>=1.3,<2"
# Voces de rhasspy/piper-voices: es_MX-claude-high (apache-2.0) y es_MX-ald-medium (unlicense).
ARG VOCES=https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX
RUN mkdir -p /opt/voces \
 && for v in claude/high/es_MX-claude-high ald/medium/es_MX-ald-medium; do \
      n=$(basename "$v"); \
      curl -fsSL -o "/opt/voces/$n.onnx" "$VOCES/$v.onnx" \
   && curl -fsSL -o "/opt/voces/$n.onnx.json" "$VOCES/$v.onnx.json"; \
    done
