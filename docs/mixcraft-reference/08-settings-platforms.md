# Pemetaan Fitur Mixcraft 10: Preferences & Multiplatform Systems

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 23: Preferences (Hlm. 669 – 700)  
- Bab 2: Audio Hardware Setup (Hlm. 3 – 6)  
- Bab 27: Troubleshooting & Platform Optimization (Hlm. 732 – 747)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas pengaturan preferensi sistem workstation: konfigurasi antarmuka suara (*Sound Device*), preferensi umum dan bahasa, tema tampilan dan kontras visual (*Display*), perutean perangkat masukan/keluaran MIDI (*MIDI Preferences*), direktori dan format rekaman (*Recording Preferences*), jalur pemindaian plugin (*Plug-Ins Preferences*), pengaturan proyek bawaan (*Project Defaults*), serta arsitektur eksekusi multi-platform (Web browser modern, perangkat sentuh Android, dan desktop workstation Windows).

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-SET-101` |
| **Bab dan subbab** | Preferences: Sound Device Preferences |
| **Halaman sumber** | Hlm. 669 – 674 |
| **Fitur referensi** | Sound Device Configuration (Driver, Buffer Size, Sample Rate) |
| **Tujuan** | Menentukan perangkat keras audio aktif, ukuran buffer pemrosesan (latensi), dan frekuensi sample rate sistem. |
| **Perilaku** | Menyediakan pilihan driver (ASIO/WaveRT/Wave), pilihan kartu suara masukan/keluaran, pengatur latency slider, dan deteksi sample rate. |
| **Alur penggunaan** | Buka `File > Preferences...` atau klik ikon roda gigi di toolbar atas, pilih tab `Sound Device`. |
| **Input/output** | In: Pilihan driver & buffer size; Out: Status inisialisasi hardware audio. |
| **Ketergantungan** | Platform hardware audio stack. |
| **Pemetaan MusikKu** | Dialog preferensi audio dan status engine latency di toolbar transport `transport-bar.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Pengguna dapat mengganti audio input device secara langsung tanpa mematikan atau me-restart aplikasi. |
| **Test ID** | `TEST-PREF-SOUND-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-SET-102` |
| **Bab dan subbab** | Preferences: Display Preferences |
| **Halaman sumber** | Hlm. 678 – 681 |
| **Fitur referensi** | Display & Theme Customization (Dark Theme, High Contrast) |
| **Tujuan** | Mengoptimalkan kenyamanan mata musisi dalam berbagai kondisi pencahayaan studio (ruang rekaman temaram vs panggung terang). |
| **Perilaku** | Pengaturan tema warna (gelap/terang), kontras warna kisi grid, warna klip terbalik (*invert clip background*), dan opsi scroll otomatis (*auto-scroll during playback*). |
| **Alur penggunaan** | Buka `Preferences > Display`, pilih skema warna dan opsi auto-scroll timeline. |
| **Input/output** | In: Pilihan tema UI; Out: Pembaruan token variabel CSS theme studio. |
| **Ketergantungan** | Tailwind CSS / CSS variables design system. |
| **Pemetaan MusikKu** | Tema dark-mode studio profesional dengan warna aksen ergonomis pada seluruh komponen studio. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Antarmuka mempertahankan rasio kontras visual teks terhadap latar belakang minimal 4.5:1 (WCAG AA). |
| **Test ID** | `TEST-UI-THEME-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-SET-103` |
| **Bab dan subbab** | Preferences: Recording Preferences |
| **Halaman sumber** | Hlm. 686 – 688 |
| **Fitur referensi** | Recording Preferences & Auto Cleanup |
| **Tujuan** | Mengatur format berkas rekaman bawaan dan membersihkan berkas audio sampah yang tidak terpakai (*unused recordings*) secara otomatis saat menyimpan proyek. |
| **Perilaku** | Opsi `Delete Unused Recordings During Save Or On Exit` menghapus berkas take yang dibatalkan (*undone takes*) dari penyimpanan lokal untuk menghemat memori disk. |
| **Alur penggunaan** | Buka `Preferences > Recording`, centang opsi pembersihan rekaman tak terpakai. |
| **Input/output** | In: Boolean flag; Out: Garbage collection aset audio di IndexedDB / filesystem. |
| **Ketergantungan** | Storage manager & asset database. |
| **Pemetaan MusikKu** | Fungsi pembersihan aset orphan di `src/lib/studio/storage.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Aset audio yang tidak dirujuk oleh klip mana pun dalam proyek dibersihkan saat fungsi cleanup dipanggil. |
| **Test ID** | `TEST-STORAGE-CLEAN-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-SET-104` |
| **Bab dan subbab** | Preferences: Plug-Ins Preferences & VST Directories |
| **Halaman sumber** | Hlm. 696 – 700 |
| **Fitur referensi** | VST3 Search Paths & Auto-Scan |
| **Tujuan** | Menemukan dan memuat instrumen VSTi dan plugin efek pihak ketiga yang terpasang pada komputer desktop. |
| **Perilaku** | Mendeteksi direktori standar VST3 (`C:\Program Files\Common Files\VST3`) dan folder kustom, dengan proteksi blacklist otomatis bila plugin mengalami crash saat pengujian. |
| **Alur penggunaan** | Buka `Preferences > Plug-Ins`, klik `Edit VST/VST3 Folders...`, tambahkan jalur folder, klik `Rescan All VST Plug-Ins`. |
| **Input/output** | In: Array string path folder; Out: Daftar plugin VST3 terverifikasi. |
| **Ketergantungan** | Desktop native host (Tauri 2 Rust). |
| **Pemetaan MusikKu** | Perintah `scan_vst3_plugins` pada backend Tauri di `src-tauri/src/main.rs` dan bridge `vst3-bridge.ts`. |
| **Platform** | Windows (Khusus Desktop) |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Pemindaian direktori Windows VST3 mendeteksi berkas `.vst3` tanpa menyebabkan crash pada aplikasi. |
| **Test ID** | `TEST-VST3-BRIDGE-01` |

---

## 3. Matriks Kompatibilitas Multi-Platform MusikKu Studio

| Lapisan Arsitektur | Web Browser Modern | Android Touch (Capacitor) | Windows Desktop (Tauri 2) |
| :--- | :--- | :--- | :--- |
| **Presentation / UI** | Responsif Mouse & Keyboard | Kontrol sentuh teroptimasi layar sentuh | Multi-window floating dialogs & Hotkeys |
| **Audio Clock & Engine**| W3C Web Audio API AudioContext | Web Audio API + Oboe/AAudio low-latency | WASAPI Exclusive Mode / Web Audio engine |
| **MIDI Engine** | Web MIDI API (`requestMIDIAccess`) | Web MIDI API via USB OTG / Bluetooth | Native Windows MIDI API & Web MIDI |
| **Virtual Instruments** | Internal Subtractive PolySynth & Drum Synth | Internal Subtractive PolySynth & Drum Synth | Internal Synth + Host Plugin VST3 Eksternal |
| **Effects Rack** | 3-Band/Parametric EQ, Comp, Reverb, Delay | 3-Band/Parametric EQ, Comp, Reverb, Delay | Efek Internal + Plugin Efek VST3 Eksternal |
| **Storage & Persistence**| IndexedDB (`idb`) & JSON export | IndexedDB lokal aplikasi & file storage | Filesystem lokal langsung (`.musiku`) |
| **Cloud Synchronization**| Supabase Cloud Auth & Metadata sync | Supabase Cloud Auth & Metadata sync | Supabase Cloud Auth & Metadata sync |
