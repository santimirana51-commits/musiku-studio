# Multi-stage / lightweight Alpine image dengan yt-dlp + ffmpeg + Python3
FROM node:20-alpine

# Pasang dependensi runtime (Python 3, ffmpeg, curl)
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    curl \
    ca-certificates

# Unduh binary yt-dlp resmi terbaru langsung dari GitHub Releases
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Salin source microservice
COPY package.json server.js ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001 8080 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-3001}/health" || exit 1

CMD ["node", "server.js"]
