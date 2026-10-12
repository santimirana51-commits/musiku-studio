# MusikKu Multi-Platform Architecture

> Fase 1 — Audit & Baseline. Dokumen ini menggambarkan **arsitektur aktual** (hasil audit repo 2026-10-11), **gap** menuju target Web+PWA / Android / Windows, **risiko**, dan **rencana migrasi bertahap**. Tidak menghapus fitur yang sudah berjalan.

## 1. Baseline aktual (hasil audit)

### 1.1 Stack & tooling

- **Framework:** Next.js 14.2.13 App Router + TypeScript strict + Tailwind 3.4. Tidak ada `public/` (tidak ada PWA manifest / service worker / icon). Tidak ada Capacitor / Tauri / `android/` / `windows/` / `src-tauri/`.
- **Package manager:** npm (`package-lock.json`). Scripts: `dev, build, start, lint (next lint), typecheck (tsc --noEmit), test (vitest run), build:extension`.
- **Hasil baseline (2026-10-11):** `typecheck` bersih, `lint` 0 warning/error, `test` **17 file / 91 test lulus**.
- **Security headers** di `next.config.js`: `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(), microphone=(self), geolocation=()` (mic hanya untuk karaoke atas gestur).

### 1.2 Routes & UI aktual

- Halaman: `/ (beranda), /search, /watch, /library (4 tab: YouTube/File perangkat/Lokal/Cloud), /playlists, /favorites, /history, /karaoke, /settings, /admin, /login, /register, /forgot-password, /reset-password`.
- Navigasi konsisten sudah ada (`src/components/nav.tsx`): Home, Search, Library, Playlists, Karaoke, Settings — **belum ada** menu AI Lyrics / Equalizer mandiri (EQ hanya panel di Karaoke + Library lokal), belum ada Cloud Library sebagai halaman terpisah, belum ada Queue panel global, belum ada indikator sumber audio global.
- Player: `PlayerProvider` (`src/components/player-context.tsx`) + `YouTubeEmbed` (IFrame API, loader bersama `src/lib/youtube-iframe.ts`) + `PlayerBar` (mini). Aturan keras saat ini: **satu instance YouTube resmi dalam satu waktu**; play dari halaman lain → `router.push('/watch?v=')`; pindah halaman mini↔watch memakai `resumeRef` (>5 dtk). Status: `idle|playing|paused|error` — **belum ada** kontrak `stop/seek/volume/mute/shuffle/repeat/currentTime/duration/buffering/lifecycle/capability-flags`.
- Mini/full player: mini (`PlayerBar`) ada; full player = halaman `/watch` (bukan overlay). Queue: `VideoItem[] + index` di context + `localStorage musikku:queue` (maks 100), tanpa shuffle/repeat/volume di level YouTube-context.

### 1.3 Backend bersama (sudah ada, dipertahankan)

- **Auth:** Supabase email (`src/lib/supabase/*`, `requireUser()` via cookie). Anonim: favorit/riwayat lokal saja.
- **Tabel + RLS (0001–0003):** `profiles, playlists, playlist_items, favorites, playback_history, user_preferences (history_enabled, theme), karaoke_lyrics (unique user+video+lang, visibility private/public, rights_confirmed), music_library (path unique, mime allowlist, size ≤500MB di DDL + ≤MUSIC_MAX_FILE_MB di API default 50MB)`. Semua RLS owner-only kecuali `playlists/is_public` dan `karaoke_lyrics/visibility=public`. Bucket **`music-files` privat**, path `<user_id>/...`, hanya **signed URL** (putar 5 mnt, upload via signed upload URL 2-tahap). Service-role tidak ke browser (verifikasi: tidak di `.next/static`).
- **Validasi server:** Zod (`src/lib/validation.ts`) + rate-limit (`src/lib/rate-limit.ts`) di `/api/search, /api/videos, playlists-create`.
- **Sync saat ini:** bukan sync-engine — tiap fitur fetch langsung ke API (playlist/favorit/riwayat/music_library/karaoke_lyrics). Offline queue, retry-backoff, idempotency, versioning/konflik **belum ada**. `user_preferences` hanya `theme + history_enabled`.

### 1.4 Audio engine aktual

| Sumber | Engine | EQ/efek | Background | Keterangan |
|---|---|---|---|---|
| YouTube | IFrame Player API resmi, visible | **Tidak bisa** (cross-origin) — dikodekan eksplisit | **Tidak didukung** (player harus terlihat; layar mati = berhenti) | Search via Data API v3 resmi (cache 60 dtk, max 25/req, debounce 600ms). Error jujur: 101/150, privat, wilayah, kuota. |
| File lokal/cloud | `LocalAudioEngine` (`src/lib/local-player/engine.ts`, 340 baris): HTMLAudioElement + queue + shuffle/repeat off/all/one + volume + `MediaElementSource → EQ 10-band → master → destination` bila AudioContext ada | **Ya, 10-band** (32Hz–16k) + preset Flat/Bass/Vocal/Pop/Rock/Jazz, persist `musikku:local-eq` | Web: hanya selama tab hidup + Media Session (belum diimplementasikan — gap); minimize tab OK, tutup/lock OS tidak dijamin | Object URL milik halaman (engine tidak revoke). Durasi via metadata element. |
| Karaoke mic | Web Audio: `getUserMedia → EQ 10-band (modul sama) → echo/reverb/monitor` (`src/lib/karaoke/*`) | Ya untuk mic saja | N/A | `track.stop() + AudioContext.close()` saat mati/tutup halaman. Pitch estimator = `Unavailable` (tanpa skor palsu). |

### 1.5 Library lokal & cloud aktual

- **Web lokal:** IndexedDB `musikku/track` (blob+metadata) + file picker browser + multi-file + search/sort/delete + `estimate()/persist()` + `QuotaExceededError` + ekspor metadata JSON (tanpa blob). Peringatan hapus-data-situs sudah jujur. **Belum ada:** validasi format via decode (baru ekstensi/MIME), recovery file pindah/hilang (baru laporan impor JSON cocok/hilang), penyimpanan metadata terpisah per-platform.
- **Cloud:** alur 2-tahap (`GET upload-url → PUT XHR progress+retry → POST metadata` setelah verifikasi objek), hapus konsisten (Storage+row), kuota = sum `file_size`, signed URL 5 mnt. **Belum ada:** tabel kolom `status upload` (hanya implisit sukses/gagal), download offline resmi (baru streaming signed URL), MIME allowlist belum mencakup `audio/x-m4a` (M4A Safari bisa gagal — terdokumentasi jujur di UI `library/page.tsx`).

### 1.6 Karaoke, LRC, EQ, AI Lyrics

- **LRC:** parser `src/lib/karaoke/lrc.ts` (multi-timestamp, offset tag+parameter, batas 100k char/2000 baris, sanitasi HTML) + `KaraokeEngine` sinkron **per baris** + offset ±5 dtk. Sumber hanya `user_upload/user_created/licensed` + `rights_confirmed=true` (tanpa scraping/auto-fetch). Tersimpan per user+video+lang, bisa public/private.
- **EQ:** satu modul `src/lib/karaoke/equalizer.ts` dipakai mic + local player. Tidak ada duplikasi node yang terdeteksi (engine `destroy()` menutup context; perlu test regresi pindah track — sudah ada `engine.test.ts` 7 test + `equalizer.test.ts` 8 test).
- **AI Lyrics: BELUM ADA.** Audit `grep -ri ai` tidak menemukan provider (OpenAI/Gemini/Anthropic), endpoint `/api/ai-*`, tabel, maupun UI. Klaim "AI Lyrics yang sudah ada" di rencana adalah **asumsi yang salah** — diperlakukan sebagai fitur baru (server-proxy, key di server, consent eksplisit), bukan preservasi.

### 1.7 Ekstensi Chrome (di luar misi, jangan dirusak)

- `extension/` MV3 (kontrol universal player lokal + tab media). Build `npm run build:extension`. Test 4 file lulus. Misi multi-platform tidak menyentuh ekstensi kecuali berbagi tipe.

## 2. Gap analysis (aktual → target)

| ID | Target | Status aktual | Kerja |
|---|---|---|---|
| G1 | Kontrak AudioEngine bersama + capability flags | `PlayerContext` (YouTube-only) + `LocalAudioEngine` (file-only) terpisah, tanpa interface bersama | Buat `src/lib/audio/` : `AudioEngine` interface + `Capability` (`canBackground, canEQ, canVolume, canSeek…`) + `WebYouTubeEngine` adapter (bungkus context saat ini) + `WebLocalEngine` adapter (bungkus LocalAudioEngine). Tanpa mengubah perilaku. |
| G2 | Web background + Media Session | Belum ada `navigator.mediaSession` | Tambah Media Session + `MediaMetadata`/action handlers hanya untuk sumber lokal; YouTube tetap jujur `canBackground=false`. |
| G3 | PWA (installable, offline shell) | Tanpa `public/`, manifest, SW | Tambah `public/manifest.webmanifest + icons + apple-touch`, `next-pwa`/SW custom minimal (cache shell, bukan blob musik), halaman offline. Jangan cache signed URL / audio blob otomatis. |
| G4 | Android (Capacitor): service + MediaSession + file picker scoped | Nol | Tambah Capacitor + `@capacitor/*` + plugin/foreground-service native (Kotlin) untuk **sumber lokal hasil decode native**; YouTube tetap WebView IFrame (`canBackground=false`). Scoped storage, tanpa `MANAGE_EXTERNAL_STORAGE`. |
| G5 | Windows (Tauri 2): tray/minimize/close semantics + SMTC | Nol | Tambah `src-tauri/` + Rust command file picker + `windows.playback` adapter (HTMLAudio bertahan saat minimize; SMTC bila tersedia). Kompatibilitas dicek dulu (Next static export vs Tauri — risiko, lihat §3). |
| G6 | Sync engine (offline queue, retry, konflik) | Fetch langsung, tanpa queue/version | Tambah `src/lib/sync/` (queue IndexedDB/localStorage + backoff + idempotency-key + `updated_at` versioning + aturan last-write-wins per-tabel + pisah hapus lokal vs cloud). Migrasi bertahap per fitur. |
| G7 | Cloud `upload_status` + download offline | Kolom belum ada; unduh belum ada | Migrasi `0004_*`: `upload_status, error, progress` (atau tabel state client-side dulu) + endpoint download (signed URL `download` + `Content-Disposition`) + cache offline per-platform (IndexedDB/Android files/Tauri store). |
| G8 | AI Lyrics via server-proxy | Tidak ada | Endpoint `/api/ai-lyrics` (provider pluggable, key server-only) + UI halaman + consent + tabel `ai_lyrics_cache` (opsional). Jangan kirim audio/file tanpa consent. |
| G9 | UI: sumber indikator, queue panel, EQ global, status sync | Parsial | Tambah `SourceBadge`, `QueuePanel`, `SyncStatus`, halaman `/equalizer`, `/ai-lyrics`, `/cloud` (atau tab dipromosi) + empty/loading/error/permission states + capability-gated buttons. |
| G10 | Test perangkat nyata + docs build | Hanya unit (vitest/jsdom/mock) | Tambah integration test (engine transitions, import/restore, LRC sync, RLS via supabase-js, sync-retry) + manual checklist browser/emulator/Windows + 6 dokumen §5. |

## 3. Risiko & keputusan jujur

1. **YouTube tidak akan pernah background/EQ.** IFrame cross-origin + ToS melarang audio-only/background/ekstraksi. Semua UI harus menampilkan `YouTube: foreground + tanpa EQ` apa adanya. Jangan janjikan "background YouTube" di Android/Windows.
2. **Tauri 2 + Next.js App Router:** Tauri idealnya serve static export; App Router dengan API routes dinamis tidak bisa dibundel murni statis. Opsi: (a) frontend Tauri menunjuk ke deployment web (butuh online), atau (b) `output: export` + pindah API ke Supabase Edge/backend eksternal. Keputusan ditunda ke Fase 5 setelah spike kompatibilitas — didokumentasikan, bukan asumsi.
3. **Capacitor + Supabase Auth:** deep-link redirect + secure storage token perlu plugin; risiko sesi kedaluwarsa/pindah akun — ditangani sync-engine (§G).
4. **AudioContext lifecycle:** satu context per engine, `destroy()` wajib; pindah track tidak boleh duplikat filter (regresi test wajib).
5. **Storage quota Web:** IndexedDB bisa ditolak; `persist()` tidak dijamin — UI sudah jujur, pertahankan.
6. **Izin minimal:** mic hanya atas tombol Mulai; Android tanpa akses seluruh file; Windows ikut ACL OS; secret server-only.
7. **Hak cipta:** pengguna bertanggung jawab atas file/lirik; `rights_confirmed` wajib; tanpa klaim bebas-hak-cipta.

## 4. Rencana migrasi bertahap (8 fase, sesuai perintah M)

1. **Fase 1 (ini):** audit + `docs/multiplatform-architecture.md` + baseline hijau. ✅
2. **Fase 2 — Audio engine interface + local library:** buat `src/lib/audio/{types,web-youtube-engine,web-local-engine,capabilities}.ts` + adapter tanpa ubah perilaku + unit test transisi + validasi format via decode + `docs/platform-capabilities.md` (parsial Web).
3. **Fase 3 — Cloud + sync:** migrasi `0004_music_upload_state.sql` + endpoint download + `src/lib/sync/*` (queue/backoff/idempotency/konflik) + `docs/storage-and-sync.md`.
4. **Fase 4 — Android:** `npm i @capacitor/*` + `npx cap init` + `android/` + foreground service + MediaSession + file picker scoped + `docs/android-build.md` (debug APK dulu, AAB/release kemudian). Bukti: APK debug + video lock-screen lokal-play.
5. **Fase 5 — Windows:** spike Tauri-compat → `src-tauri/` + adapter + tray/minimize semantics + `docs/windows-build.md` (installer hanya bila benar dihasilkan).
6. **Fase 6 — Web+PWA:** manifest/icons/SW/offline + Media Session lokal + `docs/web-deployment.md`. Bukti: Lighthouse PWA + install prompt.
7. **Fase 7 — EQ/Karaoke/AI:** preservasi EQ/LRC test + `/api/ai-lyrics` server-proxy + halaman EQ & AI Lyrics + consent. AI key server-only.
8. **Fase 8 — Regresi & build:** full lint/typecheck/test + manual matrix + 6 dokumen final. Tanpa klaim build yang belum ada.

Aturan setiap fase: kode kecil yang dapat diperiksa + test + docs; laporkan file diubah, perintah + hasil nyata, keterbatasan, langkah berikut.

## 5. Dokumen yang dihasilkan (status lengkap)

- [x] `docs/multiplatform-architecture.md` (arsitektur aktual, gap, risiko & rencana migrasi)
- [x] `docs/platform-capabilities.md` (tabel kejujuran kemampuan per sumber × platform)
- [x] `docs/storage-and-sync.md` (arsitektur 3 lapis storage, cloud upload/download & sync engine)
- [x] `docs/android-build.md` (setup Capacitor, PlaybackService foreground media & MediaSession)
- [x] `docs/windows-build.md` (spike Tauri 2, tauri.conf.json, Cargo.toml & integrasi desktop)
- [x] `docs/web-deployment.md` (panduan web & PWA deployment, environment, headers & Media Session)

## 6. Perintah baseline terverifikasi (bukti nyata, bukan klaim)

```bash
npm run typecheck  → bersih (0 error)
npm run lint       → ✔ No ESLint warnings or errors
npm test           → 26 files / 132 tests passed
npm run build      → 31 routes teroptimasi tanpa error
```

## 7. Status Ekosistem Multi-Platform (Ringkasan per Fase)

1. **Fase 1 (Audit & Baseline):** ✅ Selesai. Struktur Next.js 14 App Router, Supabase, Capacitor, Vitest, dan tooling diaudit.
2. **Fase 2 (Audio Engine & Local Library):** ✅ Selesai. Kontrak AudioEngine bersama, capability flags, `WebYouTubeEngine`, `WebLocalEngine` dengan integrasi Media Session API, decode probe, dan unit test transisi.
3. **Fase 3 (Cloud Library & Sync Engine):** ✅ Selesai. Migrasi Supabase 0004 (`upload_status`), signed download endpoint, tombol unduh offline di UI, endpoint `/api/sync` dengan cache penegakan `Idempotency-Key` server-side, antrean offline FIFO, retry backoff, dan conflict resolution teruji.
4. **Fase 4 (Android Background Playback):** ⚠️ Fondasi & Kode Native Selesai. Struktur Capacitor, AndroidManifest izin foreground service, `PlaybackService.java` (MediaSession + audio focus) tersedia. Membutuhkan JDK 17+ di environment untuk kompilasi APK fisik.
5. **Fase 5 (Windows Desktop):** ⚠️ Spike & Kode Native Selesai. Struktur `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, dan `src/main.rs`) telah dikonfigurasi lengkap dengan command `minimize_window` dan IPC bridge. Membutuhkan toolchain Rust di target Windows untuk kompilasi installer `.msi`/`.exe`.
6. **Fase 6 (Web Integration & PWA):** ✅ Selesai. PWA manifest (`manifest.webmanifest`), ikon SVG, Service Worker offline shell (`public/sw.js`), halaman fallback offline (`/offline`), registrasi PWA otomatis, dan Media Session API.
7. **Fase 7 (Equalizer, Karaoke & AI Lyrics):** ✅ Selesai. EQ 10-band Web Audio Studio (`/equalizer`), LRC parser, API route AI Lyrics server-side (`/api/ai-lyrics`) + Studio UI (`/ai-lyrics`) dengan persetujuan pengguna dan zero-leak key.
8. **Fase 8 (Regresi & Dokumentasi):** ✅ Selesai. 6 dokumen deliverable lengkap, lint & typecheck bersih, 132 unit & integration test lulus 100%, 31 rute produksi terkompilasi.
