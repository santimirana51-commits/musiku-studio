# Web & PWA Deployment — MusikKu

> Fase 6. Panduan deployment produksi Web dan PWA (Progressive Web App) untuk MusikKu.

---

## 1. Arsitektur Deployment Web

MusikKu dibangun menggunakan **Next.js 14 App Router** dengan TypeScript dan Tailwind CSS.
Aplikasi ini memiliki dua komponen runtime:
1. **Server Runtime (Node.js):** Menjalankan API routes (`/api/*`), proxy pencarian YouTube ber-rate-limit, validasi server via Zod, dan generasi signed upload/download URL via Supabase Admin (service-role key).
2. **Client Runtime (Browser / WebView):** UI responsif, state player global, Web Audio API (EQ 10-band), IndexedDB (library lokal), dan Media Session API.

> [!IMPORTANT]
> Karena rute `/api/*` membutuhkan server Node.js / Edge runtime untuk menjaga keamanan kunci rahasia (`SUPABASE_SERVICE_ROLE_KEY` dan `YOUTUBE_API_KEY`), deployment web produksi **harus dijalankan pada lingkungan yang mendukung server-side execution** (seperti Docker Container, Node.js server, Vercel, atau AWS/GCP Cloud Run), bukan pure static hosting tanpa backend.

---

## 2. Variabel Lingkungan (Environment Variables)

Pastikan konfigurasi lingkungan berikut tersedia sebelum build/deploy:

### Variabel Publik (Client & Server)
| Variabel | Keterangan | Contoh |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL instance Supabase | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key (aman untuk browser, diproteksi RLS) | `eyJhbGciOi...` |
| `NEXT_PUBLIC_SITE_URL` | URL publik aplikasi (untuk callback auth) | `https://musikku.app` |
| `NEXT_PUBLIC_STREAM_PROXY_URL` | (Opsional) URL publik external microservice stream-proxy untuk Equalizer YouTube Web | `https://musiku-stream-production.up.railway.app` |

### Variabel Privat (Server Saja — DILARANG diekspos ke client)
| Variabel | Keterangan | Catatan Keamanan |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS untuk signed upload/download URL | Jangan pernah gunakan prefix `NEXT_PUBLIC_` |
| `YOUTUBE_API_KEY` | Kunci Google Cloud YouTube Data API v3 | Digunakan hanya di `/api/search` & `/api/videos` |
| `MUSIC_MAX_FILE_MB` | Batas ukuran unggah file audio cloud (MB) | Default: `50` (maks DDL: 500 MB) |
| `MUSIC_STORAGE_BUCKET` | Nama bucket Supabase Storage privat | Default: `music-files` |
| `STREAM_PROXY_URL` | (Opsional) URL microservice proxy untuk redirect 307 di Next.js `/api/stream` | Sama dengan `NEXT_PUBLIC_STREAM_PROXY_URL` |

---

## 3. Langkah Build & Jalankan Produksi

### 3.1 Verifikasi Baseline Sebelum Build
```bash
# 1. Typecheck TypeScript
npm run typecheck

# 2. Linting ESLint
npm run lint

# 3. Unit & Integration Tests
npm test
```

### 3.2 Build Produksi Next.js
```bash
npm run build
```
Perintah ini menghasilkan bundle teroptimasi di folder `.next/`.

### 3.3 Menjalankan Server Produksi
```bash
npm run start
```
Secara default berjalan pada port 3000 (`http://0.0.0.0:3000`).

---

## 4. Keamanan & Header HTTP (`next.config.js`)

Aplikasi dilengkapi header keamanan tingkat lanjut di `next.config.js`:
- `X-Frame-Options: DENY`: Melindungi dari clickjacking.
- `X-Content-Type-Options: nosniff`: Mencegah MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`: Menjaga privasi referrer URL.
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`:
  - Kamera dan geolokasi diblokir total.
  - Mikrofon **hanya** diizinkan untuk origin `self` dan hanya aktif saat pengguna memulai sesi karaoke.

---

## 5. PWA (Progressive Web App) & Offline Shell

### 5.1 Prinsip Desain PWA MusikKu
1. **Installability:** Pengguna dapat menginstal MusikKu ke homescreen di Android Chrome, iOS Safari, dan Desktop Chrome/Edge.
2. **Offline App Shell:** Shell aplikasi (HTML dasar, CSS, ikon) dapat dimuat secara offline.
3. **Penyimpanan Audio yang Jujur:**
   - Blob audio lokal disimpan di **IndexedDB** (`musikku/tracks`), bukan di Service Worker cache.
   - Signed URL Supabase **tidak pernah dicache** oleh Service Worker karena memiliki masa kedaluwarsa (TTL 5 menit).
   - IFrame YouTube **memerlukan koneksi internet aktif** (tidak ada audio offline untuk YouTube sesuai ToS).

### 5.2 File Manifest & Aset
Aset PWA ditempatkan di folder `public/`:
- `manifest.webmanifest` (nama aplikasi, tema warna `#09090b`, icon 192x192 dan 512x512).
- `icon-192.png` & `icon-512.png`.
- Favicon dan touch icon.

---

## 6. Media Session API & Background Playback di Web

- **File Lokal & Cloud:**
  Saat memutar audio dari IndexedDB atau signed URL Supabase, Web Local Engine mengintegrasikan `navigator.mediaSession` jika didukung oleh browser:
  - Metadata: Title, Artist, Album, Artwork.
  - Action Handlers: `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`.
  - Audio tetap berjalan saat tab tidak aktif (selama tab browser tidak ditutup atau ditidurkan oleh sistem operasi).
- **YouTube:**
  Player YouTube menggunakan IFrame resmi YouTube. Berdasarkan kebijakan Google/YouTube dan arsitektur browser cross-origin, pemutaran YouTube **tidak mendukung background playback tanpa layar aktif**, dan MusikKu secara jujur menampilkan indikator ini kepada pengguna.

---

## 7. Storage Quota & Persistensi Browser

- Browser desktop dan mobile memiliki kuota IndexedDB yang bervariasi (biasanya hingga 60% sisa ruang disk di Chrome, 1GB di Safari mobile).
- MusikKu menggunakan `navigator.storage.estimate()` untuk memonitor kapasitas penyimpanan lokal dan memanggil `navigator.storage.persist()` saat pengguna mulai menyimpan koleksi file lokal, agar data tidak dihapus otomatis oleh browser saat disk menipis.

---

## 8. Microservice Audio Stream Proxy (Railway / VPS)

Untuk menjalankan **10-Band Equalizer Web Audio API pada audio YouTube** di lingkungan production tanpa hambatan serverless (seperti batas timeout 10 detik dan ketiadaan binary `yt-dlp` di Vercel), MusikKu menyediakan microservice audio stream proxy mandiri.

### 8.1 Deployment Cepat di Railway (Auto-Detect)
Repositori telah dilengkapi dengan `Dockerfile` dan `railway.json` di root:
1. Di [railway.app](https://railway.app), klik **"New Project"** → **"Deploy from GitHub repo"** → pilih repo `musiku-studio`.
2. Railway akan **otomatis mendeteksi Dockerfile root** dan langsung memulai build (tidak perlu ubah root directory).
3. **PENTING — Suggested Variables di Railway:**
   - Railway akan memindai source code dan menyarankan variabel seperti `YOUTUBE_API_KEY`, Supabase, dll.
   - **Abaikan / jangan klik Add**. Microservice `stream-proxy` berjalan mandiri (*zero external dependencies*) dan hanya memerlukan variabel `PORT` yang sudah otomatis diatur oleh Railway.
4. Di tab **Settings** → **Networking** (Public Networking), klik **"Generate Domain"** (contoh: `https://musiku-studio-production-xxxx.up.railway.app`).
5. **Verifikasi Proxy Aktif:**
   Buka di browser:
   ```text
   https://<domain-railway-anda>/health
   ```
   Pastikan mengembalikan respon JSON `{"status":"ok", "service":"musiku-stream-proxy", ...}`.

### 8.2 Menghubungkan Railway Proxy ke Vercel (Web Utama)
Di dashboard Vercel pada proyek web MusikKu Anda:
1. Buka **Project Settings** → **Environment Variables**.
2. Daftarkan 2 variabel berikut (masukkan base URL HTTPS tanpa akhiran `/api/stream`):
   - `NEXT_PUBLIC_STREAM_PROXY_URL` = `https://<domain-railway-anda>`
   - `STREAM_PROXY_URL` = `https://<domain-railway-anda>`
3. Klik **Save** lalu lakukan **Redeploy** di Vercel.

### 8.3 Mekanisme Graceful Fallback (Pengaman Otomatis)
Jika proxy belum dikonfigurasi, sedang offline, atau stream audio dibatasi:
- Aplikasi web **tidak akan macet atau error**.
- Sistem secara otomatis mengalihkan audio ke player resmi YouTube bawaan (IFrame) dengan notifikasi info:
  *"Aliran audio langsung dibatasi di cloud hosting. Audio dialihkan otomatis ke pemutar resmi YouTube."*
- Musik tetap diputar dengan lancar bagi pengguna.

### 8.4 Deployment Mandiri di Linux VPS
Tersedia skrip instalasi otomatis dan Docker Compose:
```bash
# Opsi A: Setup otomatis systemd (Ubuntu/Debian)
cd stream-proxy && sudo bash setup-vps.sh

# Opsi B: Docker Compose
cd stream-proxy && docker compose up -d --build
```
Panduan detail Nginx reverse proxy dan SSL dapat dibaca di `stream-proxy/README.md`.
