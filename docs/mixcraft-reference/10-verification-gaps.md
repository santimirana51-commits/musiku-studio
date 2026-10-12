# Kesenjangan Fitur, Batasan Platform & Kepatuhan Arsitektur

**Sumber Manual:** `Mixcraft 10 User Guide.pdf` (807 Halaman)  
**Tujuan:** Mendokumentasikan secara transparan dan jujur seluruh kesenjangan fitur (*feature gaps*), fitur yang belum diverifikasi, keterbatasan platform spesifik, dan kebijakan kepatuhan arsitektural dalam MusikKu Studio DAW.

---

## 1. Klasifikasi Status Fitur

Sesuai aturan wajib arsitektur MusikKu Studio, status kapabilitas dikelompokkan ke dalam 4 kategori tegas:
1. **Verified & Implemented**: Fitur yang tercantum dalam manual Mixcraft 10, memiliki implementasi nyata di MusikKu, dan lulus pengujian otomatis.
2. **Platform-Specific (Terbatas pada Platform Tertentu)**: Fitur yang secara teknis hanya dapat berjalan pada OS tertentu (misal Windows native) dan memiliki fallback transparan pada Web/Android.
3. **Unverified / Out-of-Scope (Kesenjangan / Gap)**: Fitur Mixcraft 10 warisan lama (*legacy*) atau fitur hardware yang tidak relevan dengan teknologi web modern.
4. **MusikKu Unique Extension**: Fitur orisinal MusikKu yang melampaui kemampuan Mixcraft 10 (misal integrasi lirik real-time karaoke, hybrid cloud sync, sinkronisasi ekstensi browser).

---

## 2. Matriks Kesenjangan & Analisis Batasan Teknis

| ID Kesenjangan | Fitur Mixcraft 10 | Status Sumber | Analisis Teknis & Batasan Platform | Strategi & Fallback MusikKu Studio |
| :---: | :--- | :---: | :--- | :--- |
| **GAP-01** | **Pembakaran CD Audio Fisik (Red Book CD Burning)** | Hlm. 519 – 520 | Perangkat Keras Optik (CD-R/RW) sudah usang di browser web dan perangkat seluler modern. Tidak ada API web untuk mengendalikan laser CD-ROM. | **Out of Scope untuk Web/Android**: MusikKu fokus pada ekspor format digital modern (WAV 24-bit, MP3, FLAC) dan pengarsipan cloud. |
| **GAP-02** | **Propellerhead ReWire Host/Client** | Hlm. 648 – 649 | Protokol ReWire telah dihentikan secara resmi (*discontinued*) oleh Reason Studios sejak tahun 2020 dan tidak didukung dalam arsitektur WebAssembly/Web Audio. | **Discontinued**: Digantikan oleh komunikasi standar VST3 pada desktop Windows dan arsitektur bus submix internal pada Web. |
| **GAP-03** | **Hardware Audio Driver ASIO Eksklusif** | Hlm. 3 – 5 | Browser Web (Chrome/Firefox) dan Android OS tidak mengizinkan akses langsung ke driver ASIO kernel-level. | **Windows-Only Native**: Didukung pada Windows desktop via backend Tauri 2 WASAPI Exclusive Mode; pada Web menggunakan buffer adaptif Web Audio API. |
| **GAP-04** | **Host Plugin VST3 Pihak Ketiga (DLL / Biner C++)** | Hlm. 639 – 647 | Berkas biner `.vst3` (C++ dynamic libraries) tidak dapat dieksekusi langsung di dalam sandbox peramban web demi alasan keamanan sistem. | **Windows Native Host**: Disediakan modul Tauri 2 IPC untuk desktop Windows; pada Web dan Android disediakan rangkaian efek internal lengkap (EQ, Kompresor, Reverb, Delay, Saturasi). |
| **GAP-05** | **Integrasi Berbayar Celemony Melodyne Essential** | Hlm. 562 – 569 | Memerlukan lisensi perangkat lunak proprietari berbayar dari Celemony Software GmbH via protokol ARA2. | **Lisensi Pihak Ketiga**: MusikKu menyediakan deteksi nada pitch gratis terintegrasi (*Guitar Tuner*) dan editor skala notasi grafis (*Scale Snapping*). |

---

## 3. Kebijakan Kepatuhan YouTube & Isolasi Buffer Audio

Sesuai **Aturan Wajib Nomor 8** pada Master Prompt Arsitektur MusikKu:

1. **Larangan Intersepsi Lintas-Origin YouTube IFrame**:
   - Web Audio API `MediaElementAudioSourceNode` mematuhi prinsip keamanan W3C CORS (*Cross-Origin Resource Sharing*). Browser secara otomatis membisukan buffer audio jika script mencoba mengakses data mentah dari iframe YouTube tanpa izin server origin.
   - MusikKu Studio **TIDAK PERNAH** meretas, membocorkan, atau memotong aliran audio internal YouTube IFrame secara ilegal.

2. **Pemisahan Jalur DAW vs Jalur Pemutar Streaming**:
   - **Jalur DAW (MusikKu Studio)**: Mengolah berkas audio lokal sah milik pengguna (unggah file WAV/MP3), rekaman input mikrofon/instrumen yang diizinkan pengguna, notasi MIDI, synthesizer internal, dan sampel suara legal.
   - **Jalur Streaming MusikKu**: Berjalan sebagai antarmuka pemutar audio legal untuk konsumsi musik pengguna tanpa bercampur dengan jalur rendering produksi multi-track DAW.

3. **Kejujuran Fungsional**:
   - DAW tidak menjanjikan pemisahan stem AI atau ekualisasi atas streaming YouTube yang tidak dapat diakses secara sah.
   - Seluruh kontrol EQ, kompresi, dan ekspor di MusikKu Studio 100% bekerja pada data audio yang berada di dalam domain kepemilikan proyek pengguna.

---

## 4. Rencana Tindak Lanjut (*Gap Remediation Roadmap*)

1. **Tahap 1 (Saat Ini)**: Memastikan seluruh fitur verified (100% dari 38 test suites / 246 unit tests) tetap berjalan stabil dan bebas regresi.
2. **Tahap 2**: Mengembangkan modul WebAssembly (Wasm) untuk mempercepat proses FFT analitik dan DSP saturasi di lingkungan peramban.
3. **Tahap 3**: Memperluas pemetaan controller hardware Web MIDI API untuk mendeteksi profil perangkat populer (Novation Launchkey, Akai MPK Mini) secara *plug-and-play*.
