# Panduan Setup Deployment Vercel untuk MusikKu Studio

## 🚀 Quick Setup

### 1. Environment Variables yang Diperlukan di Vercel

Di **Vercel Dashboard → Project Settings → Environment Variables**, tambahkan:

| Variable | Required | Contoh | Keterangan |
|----------|----------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://xxxxx.supabase.co` | Project URL dari Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | `eyJhbGc...` | Anon Public Key dari Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | `eyJhbGc...` | Service Role Key dari Supabase (server-only) |
| `YOUTUBE_API_KEY` | ✅ | `AIza...` | YouTube Data API v3 Key dari Google Cloud |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://yourdomain.vercel.app` | Domain produksi (jangan localhost!) |
| `ADMIN_EMAILS` | ❌ | `admin@example.com` | Email admin yang dipisah koma (opsional) |
| `MUSIC_MAX_FILE_MB` | ❌ | `50` | Batas upload dalam MB (default: 50) |

### 2. Langkah-Langkah Deployment

#### A. Setup Supabase (jika belum)
1. Buat project di [supabase.com](https://supabase.com)
2. Copy **Project URL** dan **Anon Key** dari Settings → API
3. Copy **Service Role Key** dari Settings → API (hanya untuk server)
4. Jalankan migration:
   ```bash
   npx supabase init
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

#### B. Setup YouTube API (jika belum)
1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru
3. Enable **YouTube Data API v3** di Library
4. Buat API Key di Credentials
5. Batasi key ke YouTube Data API v3 saja

#### C. Deploy ke Vercel
1. **Push repo ke GitHub** (jika belum)
   ```bash
   git add .
   git commit -m "Setup deployment"
   git push origin main
   ```

2. **Import di Vercel**
   - Buka [vercel.com/dashboard](https://vercel.com/dashboard)
   - Klik "Add New" → "Project"
   - Pilih repo `santimirana51-commits/musiku-studio`
   - Klik "Import"

3. **Configure Environment Variables**
   - Di halaman Import, scroll ke "Environment Variables"
   - Tambahkan semua variables dari tabel di atas
   - **Penting**: Pastikan `NEXT_PUBLIC_APP_URL` sesuai dengan domain Vercel yang akan diberikan

4. **Deploy**
   - Klik "Deploy"
   - Tunggu proses build selesai (±2-3 menit)

5. **Update Supabase Auth Redirect**
   - Setelah deployment selesai, catat domain Vercel (contoh: `musiku-studio-git-main.vercel.app`)
   - Buka Supabase Dashboard → Authentication → URL Configuration
   - Set **Site URL** ke domain Vercel tersebut
   - Set **Redirect URLs** ke:
     ```
     https://yourdomain.vercel.app/auth/callback
     https://yourdomain.vercel.app/reset-password
     ```

---

## ❌ Troubleshooting

### Build gagal dengan error "Git information retrieval failed"
- Ini biasanya bukan error aplikasi, tapi masalah pada Vercel's internal
- **Solusi**: Trigger redeploy dari Vercel Dashboard atau push commit baru

### Environment variables error
- **Error**: `NEXT_PUBLIC_SUPABASE_URL tidak ditemukan`
- **Solusi**: Pastikan di Vercel Project Settings sudah ada env var tersebut dengan benar

### Aplikasi buka tapi fitur auth tidak jalan
- **Penyebab**: Supabase URL/key belum dikonfigurasi di Vercel
- **Solusi**: Pastikan semua `NEXT_PUBLIC_SUPABASE_*` dan `SUPABASE_SERVICE_ROLE_KEY` sudah diisi

### Pencarian video error (503)
- **Penyebab**: `YOUTUBE_API_KEY` belum dikonfigurasi atau kuota habis
- **Solusi**: 
  1. Pastikan `YOUTUBE_API_KEY` ada di Vercel
  2. Cek quota di [Google Cloud Console → APIs & Services → Dashboard](https://console.cloud.google.com/)
  3. Tunggu reset kuota harian atau naikkan batas

### Tidak bisa login / redirect error
- **Penyebab**: `NEXT_PUBLIC_APP_URL` tidak sesuai domain produksi
- **Solusi**: Update Supabase URL Configuration dengan domain Vercel yang benar

---

## 📋 Checklist Deployment

- [ ] Supabase project dibuat
- [ ] YouTube API key dibuat
- [ ] Repo sudah di GitHub
- [ ] Import project di Vercel
- [ ] Semua 7 environment variables sudah diisi di Vercel
- [ ] Build berhasil tanpa error
- [ ] Aplikasi bisa dibuka (loading halaman utama)
- [ ] Supabase redirect URLs sudah updated
- [ ] Test login bisa jalan
- [ ] Test pencarian video bisa jalan

---

## 🔧 Local Development

Untuk test lokal sebelum deploy:

```bash
# Copy env example
cp .env.example .env.local

# Isi .env.local dengan nilai sebenarnya (lihat tabel di atas)
# Contoh:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
# dll

# Install dependencies
npm install

# Run dev server
npm run dev

# Buka http://localhost:3000
```

---

## 📞 Support

Jika ada error saat deploy:
1. Cek **Vercel Build Logs** di Dashboard → Deployments → [deployment] → Logs
2. Catat error message lengkap
3. Cek apakah semua env variables sudah benar di Vercel Settings
4. Jika perlu, trigger manual redeploy dari Vercel Dashboard
