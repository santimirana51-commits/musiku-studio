# Pustaka Musik — Lokal & Cloud

Halaman `/library` dengan 4 sumber: **YouTube**, **File Perangkat**,
**Pustaka Lokal** (IndexedDB), **Pustaka Cloud** (Supabase privat).

## File perangkat (tanpa upload)

Pilih file audio (MP3/WAV/OGG/FLAC/M4A/AAC — bila browser mendukung) untuk
langsung diputar via `HTMLAudioElement`. **Tidak ada byte pun yang diunggah.**
Tombol unduh pada tiap file memindahkannya ke pustaka lokal.

## Pustaka lokal (IndexedDB)

- Blob + metadata (nama, ukuran, MIME, tanggal impor, durasi, LRC) tersimpan
  di database `musikku` / store `tracks`, pulih setelah dibuka ulang.
- Tambah (multi-file), cari, urutkan (terbaru/judul/artis/ukuran), putar,
  hapus (dengan konfirmasi), tampilan daftar/grid.
- Estimasi `navigator.storage.estimate()` ditampilkan; `persist()` diminta
  sekali saat impor — hasilnya dilaporkan jujur (bisa ditolak browser).
- `QuotaExceededError` ditangkap dengan pesan hapus-lagu-lama.
- **Peringatan: hapus data situs = koleksi hilang.** Tanpa backup otomatis.
  Tersedia **ekspor metadata JSON** (tanpa blob) + impor pencocokan
  (laporan cocok/hilang — blob tak dapat dipulihkan dari JSON).

## Pustaka cloud (Supabase, login wajib)

Alur eksplisit 2 tahap:

1. `GET /api/library/upload-url?filename&mime&size` — validasi server
   (tipe, ≤ `MUSIC_MAX_FILE_MB`, default 50 MB batas Supabase), lalu terbitkan
   **signed upload URL** (user-scoped, bucket privat `music-files`).
2. Client `PUT` via XHR (progress + retry aman dengan URL baru) →
   `POST /api/library` mencatat metadata setelah server memverifikasi objek
   ada + path milik user (`<user_id>/...`).

- Putar: `GET /api/library/[id]/url` → signed URL 5 menit (bucket privat,
  tanpa URL publik). Hapus: objek Storage + baris dihapus konsisten.
- RLS: user hanya CRUD miliknya (`music_library` + policy `storage.objects`
  berbasis `storage.foldername(name)[1]`).
- Penggunaan = jumlah `file_size` milik user, tampil di halaman.
- Service-role key tidak pernah ke browser (server memakai JWT user).

## Pemutar lokal + EQ + LRC

- `LocalAudioEngine`: play/pause/seek/volume/prev/next/shuffle/repeat
  (off/all/one)/antrean. Graph (bila AudioContext ada): element →
  MediaElementSource → EQ 10-band → master → destination.
- Preset Flat/Bass/Vocal/Pop/Rock/Jazz (modul EQ yang sama dengan karaoke),
  preferensi di `localStorage` (`musikku:local-eq`).
- LRC per lagu lokal: tempel → Terapkan (sinkron via `KaraokeEngine` +
  `currentTime` element) → Simpan ke IndexedDB.
- Mini player sticky; EQ/LRC panel toggle; keyboard: semua kontrol elemen
  native (button/input/select) sehingga fokus & operable.

## Batasan jujur

- EQ lokal TIDAK berlaku untuk audio YouTube (iframe cross-origin).
- Tidak semua browser mendukung semua format (khususnya FLAC/AAC di Safari
  lama) — file yang gagal diputar menampilkan error, bukan diam.
- Pengguna bertanggung jawab atas hak file yang diimpor/diunggah.

## Konfigurasi Supabase

```bash
npx supabase db push   # menjalankan 0003_music_library.sql (tabel + bucket + RLS)
```

Env opsional: `MUSIC_MAX_FILE_MB=50` (server; default 50). Tanpa service-role
key pun alur tetap jalan (JWT user + RLS).
