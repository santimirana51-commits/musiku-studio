#!/usr/bin/env bash
# ==============================================================================
# Skrip Otomatisasi Setup Stream Proxy MusikKu di Ubuntu / Debian VPS
# Jalankan sebagai root: sudo bash setup-vps.sh
# ==============================================================================

set -e

echo "=== [1/6] Memperbarui paket sistem ==="
apt-get update -y
apt-get install -y curl wget git ffmpeg python3 python3-pip ca-certificates

echo "=== [2/6] Memasang yt-dlp versi terbaru ==="
wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
echo "yt-dlp terpasang: $(yt-dlp --version)"

echo "=== [3/6] Memasang Node.js 20 LTS jika belum ada ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js terpasang: $(node -v)"

APP_DIR="/opt/musiku-stream"
echo "=== [4/6] Menyiapkan direktori aplikasi di ${APP_DIR} ==="
mkdir -p "${APP_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/package.json" "${APP_DIR}/" 2>/dev/null || true
cp "${SCRIPT_DIR}/server.js" "${APP_DIR}/"

echo "=== [5/6] Mendaftarkan Systemd Service (musiku-stream.service) ==="
cat << 'EOF' > /etc/systemd/system/musiku-stream.service
[Unit]
Description=MusikKu Audio Stream Proxy Microservice
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/musiku-stream
ExecStart=/usr/bin/node /opt/musiku-stream/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=ALLOWED_ORIGIN=*

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable musiku-stream.service
systemctl restart musiku-stream.service

echo "=== [6/6] Menjadwalkan auto-update yt-dlp setiap malam ==="
# YouTube sering merubah format cipher, sehingga auto-update yt-dlp sangat penting
(crontab -l 2>/dev/null | grep -v "yt-dlp -U"; echo "0 3 * * * /usr/local/bin/yt-dlp -U >/dev/null 2>&1") | crontab -

echo ""
echo "=========================================================================="
echo "✅ Instalasi Selesai! Layanan stream-proxy aktif pada port 3001."
echo "Tes endpoint: curl http://localhost:3001/health"
echo "Cek status service: systemctl status musiku-stream"
echo "=========================================================================="
