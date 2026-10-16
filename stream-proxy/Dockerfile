# Multi-stage / lightweight Alpine image dengan yt-dlp + ffmpeg + Python3
FROM node:20-alpine

# Pasang dependensi runtime (Python 3, py3-pip, ffmpeg, curl, ca-certificates)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    ca-certificates

# Pasang yt-dlp dan yt-dlp-ejs resmi via pip untuk ketersediaan EJS challenge solver
RUN pip install --no-cache-dir --break-system-packages -U yt-dlp yt-dlp-ejs

WORKDIR /app

# Salin source microservice
COPY package.json server.js ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001 8080 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-3001}/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
