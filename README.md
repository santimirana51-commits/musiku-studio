# msiku-studio

Platform penemuan dan streaming musik berbasis **YouTube** dengan desain premium gelap (charcoal + aksen ungu/magenta/pink), terinspirasi pola UX aplikasi musik modern. Seluruh antarmuka berbahasa Indonesia.

**Kepatuhan YouTube:** pencarian memakai **YouTube Data API v3** resmi, pemutaran memakai **YouTube IFrame Player API** resmi yang terlihat. Tidak mengunduh/menyimpan audio-video, tidak mengakali kuota, tidak menjanjikan semua video bisa diputar. MusikKu bukan situs resmi YouTube.

## Fitur

- Beranda: hero, pencarian, kategori, populer (hasil API sah), pencarian terakhir, terakhir diputar, playlist.
- Pencarian `/search`: debounce 600 ms, pagination token resmi, grid/list, URL query yang bisa dibagikan, error kuota.
- Pemutar `/watch?v=`: player resmi tunggal, antrean, next/prev, error embedding (101/150), privat/dihapus, batas wilayah.
- Playlist: buat/ubah/hapus (konfirmasi), tambah/hapus item, reorder, putar semua, privat default.
- Favorit: sinkron cloud bila login, localStorage bila anonim.
- Riwayat: lokal + cloud, hapus satuan/semua, bisa dinonaktifkan.
- Auth Supabase: daftar, masuk, keluar, verifikasi email, lupa & reset password.
- Pengaturan: profil, preferensi riwayat, privasi, logout.
- Admin `/admin`: statistik agregat nyata, proteksi server (role + allowlist email). Tidak menampilkan secret.
- Karaoke `/karaoke`: player resmi + lirik LRC tersinkron per baris, upload LRC milik sendiri, mode mikrofon lokal opsional. Lihat `docs/karaoke.md`.
- AI Lyrics `/ai-lyrics`: asisten AI server-side (Gemini/OpenAI/Fallback) untuk menghasilkan format lirik tersinkronisasi `.lrc` dengan persetujuan hak dan tanpa membocorkan API key.
- Equalizer `/equalizer`: studio EQ 10-band interaktif (-12 dB s.d. +12 dB) dengan preset (Bass Boost, Vocal, Pop, Rock, Jazz) via Web Audio API untuk file lokal, cloud, dan mic.
- Pustaka `/library`: file perangkat (tanpa upload), pustaka lokal IndexedDB, cloud privat Supabase (signed URL), decode probe audio, dan download offline resmi. Lihat `docs/library.md` & `docs/storage-and-sync.md`.
- Multi-Platform Ecosystem:
  - **Web & PWA:** Installable dengan `manifest.webmanifest`, ikon vektor, dan Media Session API. Lihat `docs/web-deployment.md`.
  - **Android (Capacitor):** Foreground playback service `PlaybackService.java` + MediaSession & audio focus. Lihat `docs/android-build.md`.
  - **Windows (Tauri 2):** Arsitektur desktop spike terkonfigurasi di `src-tauri/`. Lihat `docs/windows-build.md`.
- Studio DAW `/studio`: Digital Audio Workstation multitrack lengkap terintegrasi: arrangement timeline, beat ruler, snap, track headers (mute/solo/arm), audio & MIDI clips, piano roll editor, console mixer dengan inserts & sends, polyphonic synthesizer internal, rak efek (EQ, compressor, limiter, reverb, delay), perekaman vokal multitrack live, ekspor master WAV offline, dan bridge host VST3 desktop Windows. Lihat `docs/studio-architecture.md` & `docs/audio-engine.md`.
- Ekstensi Chrome `extension/` (MV3): kontrol universal player lokal + tab media dengan kapabilitas jujur. Lihat `extension/README.md`, build via `npm run build:extension`.
- Keamanan: secret hanya di server, validasi Zod, rate limit, RLS, security headers, Idempotency-Key.

## Prasyarat

- Node.js 20+, npm
- Akun Google Cloud (untuk YouTube Data API v3 key)
- Akun Supabase (database + auth)

## Instalasi lokal

```bash
npm install
cp .env.example .env.local
# isi .env.local (lihat bawah)
npm run dev
# buka http://localhost:3000
```

## Environment (.env.local)

```
YOUTUBE_API_KEY=...                 # server only, dari Google Cloud Console
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # server only bila perlu (jangan NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=
# Opsional: batas upload musik cloud (MB, default 50 = batas Supabase)
MUSIC_MAX_FILE_MB=admin@contoh.id        # opsional, koma-dipisah
```

Tanpa `YOUTUBE_API_KEY`, endpoint `/api/search` mengembalikan 503 dengan pesan konfigurasi (UI tetap bisa dibuka). Tanpa Supabase, form auth menampilkan pesan konfigurasi.

## Membuat YouTube API Key

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project.
2. **APIs & Services → Library** → aktifkan **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create Credentials → API key**.
4. Batasi key: **API restrictions → YouTube Data API v3**; bila perlu batasi HTTP referrer/IP server. Key dipakai **hanya di server** (`YOUTUBE_API_KEY`), tidak pernah dikirim ke browser.
5. Pantau kuota: **APIs & Services → Dashboard → Quotas**. Default ~10.000 unit/hari; 1 pencarian ≈ 100 unit. Aplikasi memakai cache 60 dtk + batas 25 hasil/request + tanpa retry loop.

## Membuat proyek Supabase

1. Buat project di [supabase.com](https://supabase.com) → catat **Project URL** dan **anon key**.
2. **Authentication → Providers → Email**: aktifkan, atur verifikasi email & redirect (`/reset-password`).
3. Jalankan migration:

```bash
# via CLI
npx supabase init        # sekali saja
npx supabase link --project-ref <ref>
npx supabase db push     # menjalankan 0001_init.sql + 0002_karaoke_lyrics.sql
# atau: salin-tempel supabase/migrations/0001_init.sql lalu 0002_karaoke_lyrics.sql ke SQL Editor lalu Run
```

4. Jadikan admin (opsional): `update public.profiles set role='admin' where id='<uuid>';` atau isi `ADMIN_EMAILS`.
5. Isi env di atas, restart dev server.

## Perintah

```bash
npm run dev         # development
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest (unit)
npm run build       # build produksi
npm start           # jalankan hasil build
```

## Deploy

**Vercel (aplikasi):**
1. Push repo ke GitHub → Import di Vercel.
2. Isi Environment Variables (sama seperti .env.local) di Project Settings.
3. Deploy. Pastikan `NEXT_PUBLIC_APP_URL` = domain produksi untuk redirect auth Supabase.

**Supabase (database):** migration sudah di `supabase/migrations/`. Backup: **Database → Backups** (akun berbayar: PITR) atau `pg_dump` manual berkala.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| `YOUTUBE_API_KEY belum dikonfigurasi` | Isi key di server env, restart. |
| `Kuota YouTube API habis` | Tunggu reset harian / naikkan kuota di Cloud Console. Jangan spam retry. |
| `Video tidak mengizinkan embedding (101/150)` | Batasan pemilik video; pilih video lain. |
| `Harus login` di playlist/favorit | Masuk dulu; mode anonim hanya favorit/riwayat lokal. |
| `Akses ditolak. Khusus admin` | Set role admin / ADMIN_EMAILS. |
| Build gagal karena env | Build tidak mewajibkan env; halaman yang butuh env menampilkan pesan konfigurasi saat runtime. |

## Kuota & kebijakan

- Debounce, batas query 100 karakter, maks 25 hasil/request, pagination token resmi, cache publik 60 dtk.
- Hanya metadata publik yang di-cache; respons privat tidak di-cache lintas pengguna.
- Atribusi: judul/channel/thumbnail selalu ditampilkan; jangan diklaim sebagai konten MusikKu.
- Tidak ada audio-only, background-play, pemblokir iklan, atau pengunduhan.

## Struktur folder

```
src/
  app/            # App Router: pages + API routes
    api/          # search, videos/[id], playlists, favorites, history, admin
  components/     # player, kartu video, nav, modal, toast, auth
  lib/            # supabase client/server, validasi, rate-limit, storage, youtube
supabase/migrations/
docs/             # arsitektur, api, database, karaoke, library
```

Dokumentasi arsitektur multi-platform:
- `docs/multiplatform-architecture.md` — Arsitektur aktual, mitigasi risiko & rencana 8 fase.
- `docs/platform-capabilities.md` — Matriks kemampuan per platform & sumber audio.
- `docs/storage-and-sync.md` — Arsitektur penyimpanan 3-lapis & Sync Engine.
- `docs/android-build.md` — Konfigurasi Capacitor & background PlaybackService.
- `docs/windows-build.md` — Konfigurasi desktop Tauri 2 & panduan build Windows.
- `docs/web-deployment.md` — Panduan deployment produksi Web & PWA.
- Tambahan: `docs/arsitektur.md`, `docs/api.md`, `docs/database.md`, `docs/karaoke.md`, `docs/library.md`.
>>>>>>> 1f4e9a5 (Initial commit – MusikKu Studio setup)
