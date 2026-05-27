FROM node:22-bookworm-slim

# Install system dependencies:
#   ffmpeg       — audio conversion (WAV output)
#   python3      — yt-dlp runtime
#   python3-pip  — to install yt-dlp
#   curl + ca-certificates — HTTPS downloads
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       python3-pip \
       curl \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp system-wide via pip.
# --break-system-packages is required on Debian bookworm (PEP 668) and is safe
# inside Docker where there is no real system Python environment to break.
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5050

CMD ["node", "index.js"]
