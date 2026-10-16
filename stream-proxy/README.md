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

### Pilihan 1: Deploy di Railway (Auto-Detect & Paling Cepat)
1. Buka [railway.app](https://railway.app) dan login dengan akun GitHub Anda.
2. Klik **"New Project"** -> **"Deploy from GitHub repo"** -> pilih repo `musiku-studio`.
3. Railway otomatis mendeteksi `Dockerfile` dan `railway.json` di root (tidak perlu ubah root directory).
4. **Suggested Variables:** Railway akan menyarankan variabel Next.js (`YOUTUBE_API_KEY`, Supabase, dll.). **Abaikan/tidak perlu diisi**, karena microservice ini mandiri dan hanya butuh `PORT`.
5. Di tab **Settings** -> **Networking** (Public Networking), klik **"Generate Domain"** (contoh: `https://musiku-studio-production-xxxx.up.railway.app`).
6. **Uji Service:** Buka `https://<domain-railway-anda>/health` di browser. Jika keluar JSON `{"status":"ok", ...}`, proxy sudah 100% online.

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

Setelah microservice aktif dan memiliki URL publik (misal `https://musiku-studio-production-xxxx.up.railway.app` atau `https://stream.domainanda.com`):

1. Buka dashboard [Vercel](https://vercel.com) -> Proyek **MusikKu**.
2. Masuk ke tab **Settings** -> **Environment Variables**.
3. Tambahkan 2 variabel berikut (masukkan base URL HTTPS tanpa akhiran `/api/stream`):
   - **`NEXT_PUBLIC_STREAM_PROXY_URL`** = `https://<domain-railway-atau-vps-anda>`
   - **`STREAM_PROXY_URL`** = `https://<domain-railway-atau-vps-anda>`
4. Tekan **Save** lalu lakukan **Redeploy** di Vercel (atau lakukan git push).

### Hasil:
- Browser pengguna akan langsung terhubung ke stream proxy VPS untuk audio equalizer.
- Beban streaming sepenuhnya dialihkan dari Vercel ke VPS.
- Fitur 10-Band Equalizer YouTube di website production aktif 100%!

---

## 🍪 Solusi Jika YouTube Meminta Konfirmasi Bot ("Sign in to confirm you're not a bot")

IP server cloud publik (seperti Railway, AWS, DigitalOcean) kadang dibatasi oleh YouTube dan memunculkan log:
`Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.`

Microservice ini sudah mendukung bypass otomatis via cookies:
1. Pasang ekstensi browser **"Get cookies.txt LOCALLY"** (tersedia di Chrome Web Store / Firefox Addons).
2. Buka tab [youtube.com](https://youtube.com) (pastikan sudah login akun Google biasa).
3. Klik ikon ekstensi tersebut dan tekan **Export** untuk mengunduh berkas `cookies.txt`.
4. Buka berkas `cookies.txt` dengan Notepad / Text Editor, lalu salin seluruh isinya.
5. Di dashboard **Railway** (atau VPS):
   - Masuk ke tab **Variables**.
   - Tambahkan variabel:
     - Nama: **`YOUTUBE_COOKIES`**
     - Nilai: *(Tempel seluruh isi teks cookies.txt di sini)*
6. Railway akan merestart service secara otomatis. Service akan mendeteksi cookies dan semua video YouTube akan langsung ter-stream tanpa pernah diblokir lagi!

