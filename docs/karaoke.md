# Karaoke MusikKu

Modul karaoke di `/karaoke`: player YouTube resmi yang selalu terlihat +
lirik LRC tersinkron **per baris** + mode mikrofon opsional.

## Cara memakai

1. Buka halaman **Karaoke** (sidebar) → pilih kategori atau hasil pencarian.
2. Badge hijau `Lirik ✓ id` = sudah ada lirik tersimpan; `Tanpa lirik` = unggah sendiri.
3. Klik **Putar** pada kartu → pindah ke panggung karaoke (pemutar musik global dijeda otomatis).
4. Pilih **Bahasa** bila tersedia beberapa versi lirik.
5. Atur **offset** (±5000 ms) bila lirik terasa maju/mundur, lalu **Simpan offset** (hanya untuk lirik milikmu).
6. Tombol **Penuh** = layar penuh area karaoke (player YouTube tetap terlihat
   lengkap dengan branding & kontrolnya). **Mode musik biasa** = kembali memilih lagu.

## Format LRC

```lrc
[ti:Judul Lagu]
[ar:Nama Artis]
[offset:+500]
[00:10.00] Baris pertama lirik
[00:15.50] Baris kedua
[00:20.00][00:25.00] Baris yang diulang (dua timestamp)
```

- Timestamp `[mm:ss.xx]`: `xx` 2 digit = centisecond; 1 digit = desisecond; 3 digit = milidetik. Menit boleh > 59.
- Multi-timestamp dalam satu baris menghasilkan beberapa baris lirik.
- Tag `[offset:±ms]` bawaan file ikut dihitung.
- Baris tanpa timestamp valid diabaikan dan dilaporkan (bukan ditebak).
- Batas: 100.000 karakter, 2.000 baris. Teks disanitasi (tag HTML dibuang).

Sinkronisasi bersifat **per baris**: baris aktif = baris terakhir yang
waktunya tiba. Tidak ada klaim sinkronisasi per kata.

## Sumber lirik yang diizinkan

- File `.lrc` milikmu sendiri (upload).
- Lirik yang kamu tulis sendiri (tempel/ketik).
- Materi berlisensi eksplisit (pilih sumber `licensed` + cantumkan referensi).

Yang **dilarang** dan memang tidak diimplementasikan:

- Scraping situs lirik tanpa izin.
- Mengambil lirik lengkap otomatis dari YouTube (subtitle YouTube tidak selalu
  tersedia via Data API dan bukan sumber lirik resmi).
- Menyimpan lirik tanpa mencentang konfirmasi hak (`rights_confirmed` wajib true).

Metadata yang disimpan: `source_type`, `source_reference`, `language`,
`offset_ms`, `visibility` (`private`/`public`), `rights_confirmed`.

## Equalizer & efek vokal

Panel di bawah mode mikrofon menyediakan:

- Equalizer 10-band (32 Hz–16 kHz, ±12 dB) + preset Flat, Bass Boost,
  Vocal Clear, Pop, Rock, Jazz + tombol reset + nilai dB per slider.
- Efek: echo, reverb, volume mic (0–150%), dan monitor (dengar sendiri —
  wajib headphone agar tidak feedback).
- Preferensi tersimpan otomatis di `localStorage` (`musikku:eq-settings`).

**Batasan jujur:** EQ/effects hanya memproses sinyal mikrofon lokal.
Audio video YouTube berada di iframe cross-origin (same-origin policy)
sehingga mustahil dibaca/diubah aplikasi — panel menampilkan penjelasan
ini dan tidak menyediakan kontrol palsu untuk audio YouTube.

## Izin mikrofon
- Mode mikrofon **opsional**, dimulai hanya lewat tombol **Mulai**.
- Tidak ada perekaman/upload default — stream hanya dianalisis lokal untuk
  level meter (Web Audio API `AnalyserNode`).
- Mematikan mode (atau menutup halaman) menghentikan **seluruh track**
  (`track.stop()` + `AudioContext.close()`).
- Status yang ditampilkan jujur: `granted/denied/no-device/unsupported`.
- Butuh HTTPS (kecuali `localhost`) agar `getUserMedia` diizinkan browser.

## Penilaian pitch (tahap berikutnya)

Antarmuka `PitchEstimator` (`src/lib/karaoke/mic.ts`) sudah disiapkan.
Implementasi bawaan (`UnavailablePitchEstimator`) selalu `available=false`
dan mengembalikan `null` — UI menampilkan "belum tersedia", **tanpa skor palsu**.

## Batasan integrasi YouTube

- Hanya YouTube IFrame Player API resmi; player selalu terlihat.
- Tanpa ekstraksi audio, tanpa unduh/proxy video, tanpa pemisah audio.
- Iklan & kontrol wajib YouTube tidak disembunyikan; iklan tetap tayang sesuai kebijakan YouTube.
- Hormati error embedding (101/150), video privat/dihapus, batas wilayah.
- Tidak semua video mendukung karaoke; tidak ada pemutaran latar saat layar mati.
- Perubahan kecepatan (`setPlaybackRate`) tergantung dukungan player per video.

## Integrasi dengan MusikKu Studio DAW

Modul Karaoke kini terhubung langsung dengan **MusikKu Studio DAW (`/studio`)**:
1. **Tombol "Buka di Studio DAW":** Pada panggung karaoke, pengguna dapat mengeklik tombol ini untuk mentransfer lirik lagu aktif (`.lrc`) langsung ke proyek Studio DAW.
2. **Teleprompter Lirik di DAW:** Studio DAW memiliki dock khusus **Lirik Karaoke & Teleprompter** yang tersinkronisasi per milidetik dengan playhead playback/recording DAW.
3. **Alur Produksi Vokal (Vocal Tracking Workflow):**
   - Pengguna dapat mengimpor file audio backing track (instrumental MP3/WAV) ke Track 1 DAW.
   - Mengaktifkan tombol **Track Vokal (Record-Arm)** pada Track 2.
   - Bernyanyi sambil membaca teleprompter yang bergerak otomatis.
   - Hasil take vokal disimpan ke timeline untuk diberi efek studio (Parametric EQ, Compressor, Reverb, Delay) dan dimixing secara profesional.
4. **Konversi ke Marker Timeline:** Baris bait lirik penting dapat disematkan langsung sebagai *Timeline Markers* di ruler DAW.

## Database

Migration `supabase/migrations/0002_karaoke_lyrics.sql` membuat tabel
`karaoke_lyrics` (+ indeks + RLS: pemilik penuh, publik baca yang
`visibility='public'`). Terapkan bersama `0001_init.sql` (lihat README).
