# 🎵 MusikKu Audio Stream Proxy Microservice

Microservice audio streaming berkinerja tinggi yang dirancang untuk menjalankan YouTube Equalizer Web Audio API di lingkungan production (Vercel) tanpa batasan serverless.

---

## 🚀 Kenapa Layanan Ini Dibutuhkan?

Vercel Serverless memiliki batasan:
1. Tidak ada binary `yt-dlp` / Python.
2. Batas waktu eksekusi (timeout) 10 detik.
3. IP AWS Data Center sering dibatasi oleh bot-detection YouTube.

Dengan memisahkan endpoint `/api/stream` ke microservice mandiri ini, streaming audio dan 10-band Web Audio Equalizer dapat berjalan **100% lancar tanpa batas durasi**.

---

## 🛠️ Pilihan Deployment

### Pilihan 1: Deploy di Railway (Paling Cepat & Gratis)
1. Buka [railway.app](https://railway.app) dan login dengan akun GitHub Anda.
2. Klik **"New Project"** -> **"Deploy from GitHub repo"** -> pilih repo `musiku-studio`.
3. Di pengaturan service Railway:
   - Atur **Root Directory**: `stream-proxy`
   - Railway akan otomatis mendeteksi [Dockerfile](file:///home/miran/projec/musiku/stream-proxy/Dockerfile).
4. Di tab **Settings** -> **Networking**, klik **"Generate Domain"** (misal: `musiku-stream-production.up.railway.app`).
5. Selesai! Salin domain HTTPS yang didapat.

---

### Pilihan 2: Deploy di VPS Linux (Hetzner, DigitalOcean, Linode)

#### A. Menggunakan Skrip Otomatis (Ubuntu/Debian)
Salin folder `stream-proxy` ke VPS Anda, lalu jalankan:
```bash
sudo bash setup-vps.sh
```
Skrip otomatis akan:
- Memasang Node.js, Python 3, ffmpeg, dan `yt-dlp` terbaru.
- Menjalankan service background via Systemd (`musiku-stream.service`) yang auto-restart saat reboot/crash.
- Menjadwalkan cron auto-update `yt-dlp` setiap jam 03.00 malam.

#### B. Menggunakan Docker Compose
```bash
cd stream-proxy
docker compose up -d --build
```

---

### Konfigurasi Nginx Reverse Proxy & SSL (Domain Pribadi)
Jika Anda memiliki domain/subdomain untuk VPS (misal: `stream.domainanda.com`), buat konfigurasi Nginx:

```nginx
# /etc/nginx/sites-available/musiku-stream
server {
    server_name stream.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Wajib untuk HTTP 206 Partial Content (Seeking Audio)
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

Aktifkan SSL gratis dengan Certbot:
```bash
sudo certbot --nginx -d stream.domainanda.com
```

---

## 🔗 Menghubungkan ke Vercel

Setelah microservice aktif dan memiliki URL publik (misal `https://musiku-stream-production.up.railway.app` atau `https://stream.domainanda.com`):

1. Buka dashboard [Vercel](https://vercel.com) -> Proyek **MusikKu**.
2. Masuk ke tab **Settings** -> **Environment Variables**.
3. Tambahkan 2 variabel berikut:
   - **`NEXT_PUBLIC_STREAM_PROXY_URL`** = `https://musiku-stream-production.up.railway.app`
   - **`STREAM_PROXY_URL`** = `https://musiku-stream-production.up.railway.app`
4. Tekan **Save** lalu lakukan **Redeploy** di Vercel (atau jalankan `git deploy`).

### Hasil:
- Browser pengguna akan langsung terhubung ke stream proxy VPS untuk audio equalizer.
- Beban streaming sepenuhnya dialihkan dari Vercel ke VPS.
- Fitur 10-Band Equalizer YouTube di website production aktif 100%!
