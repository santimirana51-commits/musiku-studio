# Pemetaan Fitur Mixcraft 10: Advanced Features

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 11: Performance Panel (Hlm. 411 – 461)  
- Bab 7: Video and Video Text Tracks & Track Regions (Hlm. 124 – 148, 199 – 202)  
- Bab 18: Plug-In Manager (Hlm. 639 – 647)  
- Bab 20: Separate Music into Stems (Hlm. 650 – 652)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas fitur-fitur tingkat lanjut (*advanced professional workflows*): kisi peluncur klip non-linear untuk pertunjukan langsung dan sesi jam (*Performance Panel*), pengeditan video sinkron dengan trek teks judul/lirik karaoke (*Video & Video Text Tracks*), pengelompokan segmen lagu terpadu (*Track Regions*), isolasi dan audit stabilitas plugin (*Plug-In Manager*), serta pemisahan vokal/instrumen cerdas (*AI Stem Separation*).

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ADV-101` |
| **Bab dan subbab** | Performance Panel: Grid Launcher & Scene Triggers |
| **Halaman sumber** | Hlm. 411 – 420 |
| **Fitur referensi** | Performance Panel Clip Launcher (Scenes 1–8) |
| **Tujuan** | Memfasilitasi pertunjukan langsung (*live jamming / electronic music sets*) dengan memicu klip loop audio dan MIDI secara non-linear tanpa menghentikan playback. |
| **Perilaku** | Kisi sel klip (*clip grid matrix*) yang selaras dengan trek vertikal. Setiap kolom memiliki tombol putar/berhenti sel individual, dan baris horizontal memiliki tombol pemicu adegan (*Scene Triggers S1–S8*) yang memicu seluruh klip dalam satu baris secara serempak. |
| **Alur penggunaan** | Tekan tombol `Performance Panel` di toolbar atas atau shortcut `[P]`. Muat loop ke dalam sel, lalu klik tombol Scene 1 untuk memainkan seluruh adegan pertama. |
| **Input/output** | In: Klik tombol sel / Scene trigger; Out: Sinkronisasi pemutaran loop pada birama terdekat. |
| **Ketergantungan** | Quantized clip scheduler (Bar, Beat, 16th). |
| **Pemetaan MusikKu** | Komponen `src/components/studio/performance-panel.tsx` dengan peluncur adegan S1–S4 dan tombol Stop All. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Memicu adegan saat playback berjalan menunggu hingga awal birama berikutnya (*downbeat*) sebelum memulai putaran loop secara kuantisasi presisi. |
| **Test ID** | `TEST-PERF-PANEL-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ADV-102` |
| **Bab dan subbab** | Tracks and Types: Video and Video Text Tracks |
| **Halaman sumber** | Hlm. 124 – 138 |
| **Fitur referensi** | Video Track & Associated Audio Track Generation |
| **Tujuan** | Mengedit soundtrack musik dan efek suara pada film/video dengan sinkronisasi akurat milidetik. |
| **Perilaku** | **Aturan Utama**: Sebuah proyek hanya dapat memiliki maksimal 1 Video Track. Saat video dengan audio diimpor, sistem secara otomatis mengekstrak audio dan membuat sebuah Associated Audio Track tepat di bawah Video Track. Audio track ini dapat dihapus tanpa mempengaruhi video. |
| **Alur penggunaan** | Klik `+ Track > Video Track`, impor berkas video, DAW secara otomatis membuat audio track terkait langsung di bawahnya. |
| **Input/output** | In: Berkas video (MP4/WebM); Out: Klip video di Video Track + Klip audio di Associated Audio Track. |
| **Ketergantungan** | Video decoding & project track constraints. |
| **Pemetaan MusikKu** | Penegakan batasan 1 video track di `page.tsx` dan pembuatan otomatis audio track terkait saat import video. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Upaya menambahkan video track kedua ditolak dengan notifikasi validasi; menghapus audio track terkait mempertahankan video track tetap utuh. |
| **Test ID** | `TEST-VID-TRK-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ADV-103` |
| **Bab dan subbab** | Tracks and Types: Video and Video Text Tracks — Video Text Track |
| **Halaman sumber** | Hlm. 138 – 145 |
| **Fitur referensi** | Video Text Track (+ / - Sign Toggle & Titles/Lyrics) |
| **Tujuan** | Menambahkan teks statis, judul lagu, subtitle, lirik karaoke berjalan, atau kredit film di atas video. |
| **Perilaku** | Tombol `+` pada header Video Track menambahkan Video Text Track tepat di bawahnya; tombol `-` menyembunyikannya. Klip menyimpan data properti `textOverlay` yang dirender di atas layar video saat diputar. |
| **Alur penggunaan** | Klik tombol `+` pada Video Track header untuk memunculkan Video Text Track, lalu klik `+ Text / Lirik` untuk menambahkan klip teks. |
| **Input/output** | In: Teks string & posisi beat; Out: Teks sinematik terhampar di video window. |
| **Ketergantungan** | Floating Video Window renderer. |
| **Pemetaan MusikKu** | Tombol `+/-` pada `TrackHeader` untuk track video dan perenderan teks di `src/components/studio/video-window.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Teks lirik dari klip aktif muncul secara otomatis di bagian bawah jendela video saat playhead melintasi klip tersebut. |
| **Test ID** | `TEST-VID-TEXT-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ADV-104` |
| **Bab dan subbab** | Tracks and Types: Track Regions |
| **Halaman sumber** | Hlm. 199 – 202 |
| **Fitur referensi** | Track Regions (Mixcraft 10 Song Section Re-Arranger) |
| **Tujuan** | Menyusun ulang struktur lagu (misal memindahkan seluruh bagian Chorus 1 ke Chorus 2) sekaligus melintasi seluruh track secara serentak dalam satu tarikan mouse. |
| **Perilaku** | Bilah Region di bagian atas timeline menandai rentang birama lagu (Intro, Verse, Chorus). Menyeret balok Region memindahkan seluruh klip, automasi, dan penanda di seluruh track di bawah rentang tersebut secara utuh. |
| **Alur penggunaan** | Buat Region pada timeline ruler, seret Region `Verse 1` ke posisi baru; seluruh trek ikut bergeser secara sinkron. |
| **Input/output** | In: Region drag delta; Out: Pergeseran posisi klip multitrack global. |
| **Ketergantungan** | Global multitrack arrangement manipulator. |
| **Pemetaan MusikKu** | Section Markers di `timeline.tsx` dengan fitur seleksi dan pergeseran klip berbasis section. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Memindahkan section marker menggeser seluruh klip di bawah rentang ketukan tersebut tanpa mengubah posisi klip di luar rentang. |
| **Test ID** | `TEST-REGIONS-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ADV-105` |
| **Bab dan subbab** | Separate Music into Stems |
| **Halaman sumber** | Hlm. 650 – 652 |
| **Fitur referensi** | AI Stem Separation (Vocal, Drums, Bass, Other) |
| **Tujuan** | Memisahkan lagu stereo campuran (*full mixdown*) menjadi 4 track terpisah untuk remix, latihan instrumen, atau pembuatan vokal karaoke. |
| **Perilaku** | Mengolah berkas audio menggunakan algoritma pemisahan sumber (*source separation*) untuk menghasilkan 4 trek individual yang terisolasi. |
| **Alur penggunaan** | Klik kanan klip audio > `Separate Stems...`, pilih model pemisahan, tunggu proses inferensi selesai. |
| **Input/output** | In: Berkas audio stereo campuran; Out: 4 track audio baru (Vokal, Drum, Bass, Lainnya). |
| **Ketergantungan** | Backend neural network inference / WebAssembly source separator. |
| **Pemetaan MusikKu** | Integrasi pemisahan vokal/instrumen untuk mode karaoke studio. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Proses pemisahan menghasilkan track vokal dan track instrumen backing terpisah yang dapat diatur fader volumenya secara independen. |
| **Test ID** | `TEST-STEM-SEP-01` |
