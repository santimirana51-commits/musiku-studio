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

### Variabel Privat (Server Saja — DILARANG diekspos ke client)
| Variabel | Keterangan | Catatan Keamanan |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS untuk signed upload/download URL | Jangan pernah gunakan prefix `NEXT_PUBLIC_` |
| `YOUTUBE_API_KEY` | Kunci Google Cloud YouTube Data API v3 | Digunakan hanya di `/api/search` & `/api/videos` |
| `MUSIC_MAX_FILE_MB` | Batas ukuran unggah file audio cloud (MB) | Default: `50` (maks DDL: 500 MB) |
| `MUSIC_STORAGE_BUCKET` | Nama bucket Supabase Storage privat | Default: `music-files` |

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
