# Pemetaan Fitur Mixcraft 10: Export, Mastering & Stems

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 13: Mixing Down to Audio and Video Files (Hlm. 496 – 518)  
- Bab 14: Burning Audio CD’s (Hlm. 519 – 520)  
- Bab 7: Master Track & Master Limiter (Hlm. 186 – 190)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini merangkum proses akhir produksi musik (*rendering, mixdown, and mastering*): konversi multi-track menjadi berkas master stereo lossless (WAV 16-bit / 24-bit / 32-bit float), format kompresi (MP3, OGG, FLAC), ekspor stem terpisah (*stems bounce* untuk mixing/mastering eksternal), pengaturan frekuensi sample rate (44.1 kHz, 48 kHz, 96 kHz) dan dither, peredaman clipping dengan master limiter, serta ekspor video tersinkronisasi.

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-EXP-101` |
| **Bab dan subbab** | Mixing Down to Audio and Video Files: Mix Down To Audio File |
| **Halaman sumber** | Hlm. 496 – 499 |
| **Fitur referensi** | Mix Down To Master Audio File (WAV 16/24-bit Lossless) |
| **Tujuan** | Merender seluruh lagu menjadi satu berkas stereo berkualitas master tanpa penurunan kualitas audio atau gangguan latensi sistem. |
| **Perilaku** | Menggunakan mesin rendering offline berkecepatan tinggi untuk memproses seluruh trek, efek insert, bus gema aux, automasi, dan ekor reverb (*reverb tails*) secara deterministik. |
| **Alur penggunaan** | Klik `File > Mix Down to > WAV File...`, tentukan nama berkas dan lokasi penyimpanan, pilih opsi bit depth, lalu klik Save. |
| **Input/output** | In: Seluruh graf pemrosesan proyek; Out: Berkas biner RIFF WAV PCM 16-bit atau 24-bit. |
| **Ketergantungan** | Offline rendering engine & RIFF WAV encoder. |
| **Pemetaan MusikKu** | Dialog ekspor `src/components/studio/export-dialog.tsx` dan mesin render offline `src/lib/studio/export.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Berkas WAV yang dihasilkan memiliki header RIFF/WAVE yang valid, durasi eksak lagu, dan bebas dari distorsi clipping numerik. |
| **Test ID** | `TEST-EXP-WAV-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-EXP-102` |
| **Bab dan subbab** | Mixing Down to Audio and Video Files: Mix Down To Stems... |
| **Halaman sumber** | Hlm. 500 – 501 |
| **Fitur referensi** | Mix Down To Stems (Individual Track Stem Export) |
| **Tujuan** | Mengekspor setiap track proyek menjadi berkas audio individual terpisah yang berawal dari titik waktu nol yang sama persis, untuk diserahkan ke audio mixing engineer atau remixer. |
| **Perilaku** | Merender setiap track (vokal, drum, bass, synth, dll.) satu per satu secara otomatis menjadi file WAV terpisah dengan nama yang mengikuti nama track (misal `Lagu_Track1_Vokal.wav`, `Lagu_Track2_Bass.wav`). |
| **Alur penggunaan** | Pilih `File > Mix Down to > Mix Down To Stems...`, centang track yang ingin diekspor, pilih format, lalu klik Export. |
| **Input/output** | In: Daftar track terpilih; Out: Paket berkas WAV individual terisolasi. |
| **Ketergantungan** | Batch offline rendering scheduler. |
| **Pemetaan MusikKu** | Opsi `Export Stems (Trek Terpisah)` pada dialog `export-dialog.tsx` dan fungsi `exportProjectStems` di `export.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Setiap stem yang diekspor memiliki durasi total yang sama persis sehingga ketika diimpor kembali ke DAW lain, seluruh track langsung tersinkronisasi sempurna (*aligned*). |
| **Test ID** | `TEST-EXP-STEMS-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-EXP-103` |
| **Bab dan subbab** | Mixing Down to Audio and Video Files: Audio Options |
| **Halaman sumber** | Hlm. 502 – 505 |
| **Fitur referensi** | Audio Format Options (Sample Rate, Bit Depth, Dithering) |
| **Tujuan** | Menyesuaikan format berkas hasil ekspor dengan standar industri (CD Audio: 44.1 kHz 16-bit, Video/Streaming: 48 kHz 24-bit, High-Res: 96 kHz 24-bit). |
| **Perilaku** | Pengguna dapat memilih frekuensi pencuplikan (*sample rate*) dan kedalaman bit (*bit depth*). Dithering TPDF diterapkan saat melakukan penurunan dari 24-bit ke 16-bit untuk menghilangkan distorsi kuantisasi. |
| **Alur penggunaan** | Atur menu dropdown Sample Rate dan Bit Depth pada dialog ekspor sebelum melakukan rendering. |
| **Input/output** | In: Parameter format; Out: Pengkodean biner PCM terkuantisasi sesuai spesifikasi. |
| **Ketergantungan** | PCM quantization & dithering algorithm. |
| **Pemetaan MusikKu** | Pemilih bit depth (16-bit / 24-bit) dan sample rate (44100 Hz / 48000 Hz) di `export.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | File 24-bit menghasilkan ukuran berkas tepat 1.5 kali lebih besar daripada file 16-bit untuk durasi dan sample rate yang sama, dengan integritas data PCM terverifikasi. |
| **Test ID** | `TEST-EXP-BITS-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-EXP-104` |
| **Bab dan subbab** | Mixing Down to Audio and Video Files: Rendering Videos |
| **Halaman sumber** | Hlm. 506 – 518 |
| **Fitur referensi** | Video Export with Soundtrack (MP4 Video Rendering) |
| **Tujuan** | Menggabungkan klip video, still images, judul teks, subtitle lirik lagu, dan seluruh soundtrack musik menjadi satu berkas video MP4 siap unggah ke internet. |
| **Perilaku** | Me-render frame video dan canvas hamparan teks secara simultan dengan aliran audio master yang sudah ter-mixing. |
| **Alur penggunaan** | Buka `File > Mix Down to > Video File...`, pilih resolusi (1080p Full HD / 720p HD), klik Render. |
| **Input/output** | In: Video track frames + Master audio stream; Out: Berkas kontainer video MP4. |
| **Ketergantungan** | Canvas MediaRecorder / Video encoder. |
| **Pemetaan MusikKu** | Integrasi rendering MediaRecorder video stream di komponen `src/components/studio/video-window.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Berkas video yang dihasilkan memiliki trek visual dan trek audio yang sinkron dengan akurasi milidetik (*frame-accurate*). |
| **Test ID** | `TEST-EXP-VID-01` |
