# MusikKu Studio — Engineering Roadmap & Implementation Plan

Dokumen ini memetakan peta jalan teknis (*engineering roadmap*), pembagian fase pengembangan, dan kriteria penerimaan (*acceptance criteria*) untuk **MusikKu Studio — Professional Multiplatform DAW**.

---

## 1. Ikhtisar Strategi Platform

| Platform | Frontend & Shell | Engine Audio & Realtime | Hosting Plugin | Penyimpanan & Izin |
| :--- | :--- | :--- | :--- | :--- |
| **Web / PWA** | Next.js 14, React 18, Tailwind CSS | Web Audio API, Lookahead Scheduler (25ms/150ms), AudioWorklet | Plugin internal; VST3 ditandai *bypassed/unavailable* dengan metadata utuh | IndexedDB lokal (proyek & audio blobs); Web MediaDevices permission |
| **Android** | Capacitor 8 WebView, Touch-optimized UI | Oboe / AAudio C++ stream bridge (low-latency) + Web Audio fallback | Plugin internal; VST3 disimpan sebagai metadata proyek | IndexedDB + Android Scoped Storage; Android RECORD_AUDIO permission |
| **Windows Desktop** | Tauri 2 (WebView2) | Native Audio Engine (WASAPI Exclusive / ASIO), pro-audio thread priority | Windows VST3 Host Container (%CommonProgramFiles%/VST3) | Native File System & IndexedDB local cache; Desktop audio device selection |

---

## 2. Rincian Fase Pengembangan & Kriteria Penerimaan (Acceptance Criteria)

### Fase 1 — Audit, Arsitektur, dan Fondasi Skema
- **Tujuan**: Memeriksa lingkungan, menentukan batasan teknologi, memvalidasi dependensi, menyusun spesifikasi arsitektur teknis dan audio engine, serta memastikan build baseline bersih.
- **Kriteria Penerimaan**:
  1. `docs/studio-roadmap.md`, `docs/studio-architecture.md`, dan `docs/audio-engine.md` tersedia dan mencakup seluruh kebutuhan platform.
  2. `npm run typecheck` dan `npm test` lulus tanpa error.
  3. `cargo check` pada modul desktop Tauri (`src-tauri`) berhasil tanpa error kompilasi.
  4. Skema proyek (`StudioProject`) memvalidasi versi, tempo, time signature, tracks, clips, automation, markers, dan plugin instances dengan Zod.

### Fase 2 — Fondasi DAW, Timeline & Manajemen Proyek
- **Tujuan**: Menyediakan UI Studio terintegrasi dengan timeline aransemen interaktif, transport bar, ruler ketukan musikal, navigasi grid/snap, dan manipulasi klip.
- **Kriteria Penerimaan**:
  1. Pengguna dapat membuat proyek baru, membuka, menyimpan secara otomatis (*autosave*), dan mengekspor/mengimpor JSON proyek.
  2. Undo/Redo stack berfungsi untuk operasi track, penambahan klip, dan perubahan volume/pan.
  3. Timeline mendukung pergeseran (*drag/move*), pemotongan (*trim/split*), duplikasi, penghapusan, dan pewarnaan track.
  4. Playhead bergerak mulus dengan pemisahan waktu audio vs loop animasi UI (tidak melakukan re-render berat pada seluruh DOM timeline).

### Fase 3 — Beat Making, Step Sequencer & MIDI Piano Roll
- **Tujuan**: Menghadirkan alat komposisi beat dan sekuens nada MIDI yang intuitif dan tersinkronisasi transport.
- **Kriteria Penerimaan**:
  1. **Step Sequencer**: Grid 16/32 step untuk Kick, Snare, Clap, Hi-Hat Closed/Open, Percussion, dan Custom Sample dengan pengatur velocity per step dan swing.
  2. **Pattern Presets**: Preset drum beat (Boombap, Trap, Pop, Rock, 4-on-the-floor) dapat dimuat dan dikonversi menjadi klip timeline atau dimainkan langsung.
  3. **Piano Roll**: Menggambar nada MIDI, mengubah pitch (C1–B7), durasi, velocity (1–127), snap (1/4, 1/8, 1/16, 1/32), kuantisasi otomatis, dan transposisi skala/akor.
  4. Penjadwalan nada MIDI dieksekusi melalui Audio Engine clock yang akurat.

### Fase 4 — Audio Engine, Virtual Instruments, Mixer & Efek Internal
- **Tujuan**: Membangun rantai audio terstruktur dengan routing fleksibel, generator suara polifonik, dan rack efek terautomasi.
- **Kriteria Penerimaan**:
  1. **Virtual Instruments**:
     - *PolySynth*: Sintesis gelombang (Sine, Saw, Square, Triangle), ADSR envelope, resonant filter cutoff. Preset bass, lead, pad, plucks.
     - *Drum Synth / Sampler*: Generator suara perkusi sintetis dan sample playback per-suara.
     - *Sound Presets*: Serialisasi preset instrumen ke dalam state proyek.
  2. **Mixer Console**:
     - Fader volume linear dengan konversi dB, knob pan stereo, tombol Mute, Solo, Record-Arm.
     - Send buses (Aux Reverb, Delay) dan Master Channel dengan brickwall peak limiter.
     - Validasi graf routing untuk mencegah loop/feedback berbahaya.
  3. **Efek Internal**:
     - 3-Band Parametric EQ, Compressor, Limiter, Reverb (Impulse/Algorithmic), Delay Stereo, Noise Gate, dan Filter (Lowpass/Highpass/Bandpass/Notch).
     - Tombol bypass dan penyesuaian parameter real-time tanpa glitch audio.
  4. **Automasi**:
     - Lane automasi untuk volume, pan, cutoff, dan parameter efek dengan breakpoint dan interpolasi linear/kurva.

### Fase 5 — Multitrack Vocal & Instrument Recording
- **Tujuan**: Merekam vokal dan instrumen secara simultan ke track terpisah dengan metronom, count-in, dan penanganan take.
- **Kriteria Penerimaan**:
  1. Deteksi dan pemilihan perangkat input audio (`audioinput`) via `mediaDevices.enumerateDevices`.
  2. Metering level input live sebelum dan selama perekaman (VU meter responsif).
  3. Record-arm per track; perekaman multi-track simultan untuk semua track yang di-arm.
  4. Metronom audio klik presisi dan count-in (1-2 bar sebelum record dimulai).
  5. Audio take didekode menjadi Float32 PCM buffer, disimpan ke IndexedDB, dan ditempatkan sebagai klip baru di timeline tepat pada posisi beat perekaman.
  6. Penanganan error izin mikrofon dan putusnya koneksi perangkat secara ramah pengguna.

### Fase 6 — Windows Native Integration & VST3 Host Container
- **Tujuan**: Mengintegrasikan antarmuka desktop Windows via Tauri 2 untuk driver audio low-latency dan pemindaian/hosting VST3.
- **Kriteria Penerimaan**:
  1. Adapter Windows mendeteksi lingkungan Tauri dan memanggil command native `scan_vst3_plugins`, `init_native_audio_engine`, dll.
  2. Pemindaian plugin di direktori standar Windows (`%CommonProgramFiles%/VST3`, `C:\Program Files\Common Files\VST3`).
  3. Menampilkan daftar VST3 dengan kategori, vendor, UID, dan jumlah bus I/O.
  4. Metadata VST3 disimpan di dalam proyek; pada Web/Android, instance VST3 diberi status aman *Unavailable on platform* tanpa merusak state saat dibuka kembali di Windows.
  5. Telemetri audio native (sample rate, buffer size, latency ms, buffer underruns) terpantau di UI.

### Fase 7 — Mastering, WAV Export & Portabilitas Proyek
- **Tujuan**: Rendering audio berkualitas tinggi (*offline rendering*) ke berkas WAV linear PCM dan portabilitas proyek lintas platform.
- **Kriteria Penerimaan**:
  1. Ekspor WAV 16-bit dan 24-bit PCM dengan sample rate yang dapat dipilih (44.1 kHz, 48 kHz).
  2. Pilihan cakupan ekspor: Seluruh proyek atau rentang loop terpilih, dengan peluruhan ekor reverb/delay (*effect tail*).
  3. Opsi normalisasi audio otomatis dengan batas aman -0.1 dBFS.
  4. Validasi keabsahan struktur header RIFF/WAVE dan panjang byte data sebelum diunduh.
  5. Proyek JSON versi 1.0.0 dapat dibuka secara konsisten di Web, Android, dan Windows.

### Fase 8 — Stabilisasi, Pengujian Menyeluruh & Panduan Pengguna
- **Tujuan**: Menguji ketahanan aplikasi di berbagai beban proyek, memeriksa kebocoran memori, dan melengkapi dokumentasi.
- **Kriteria Penerimaan**:
  1. Pengujian otomatis unit & integrasi untuk seluruh modul studio (schema, storage, export, audio-engine, effects, step sequencer).
  2. Verifikasi UI responsif di viewport desktop dan layar sentuh tablet/ponsel.
  3. Dokumen rilis lengkap mencakup panduan pemecahan masalah dan batas kemampuan platform.

---

## 3. Matriks Status Implementasi & Verifikasi

| Modul / Fitur | Status | Verifikasi & Keterangan |
| :--- | :--- | :--- |
| **Arsitektur & Spesifikasi** | Selesai | `docs/studio-roadmap.md`, `docs/studio-architecture.md`, `docs/audio-engine.md` |
| **Timeline Arrangement & Ruler** | Selesai | Ruler musikal, grid snap, section markers (`Intro`, `Verse`, `Chorus`), zoom, drag/resize klip |
| **Split Clip & Editing Tools** | Selesai | Split Clip di playhead (`Scissors` & shortcut `B`), klip duplicate (`Ctrl+D`), klip delete (`Del`) |
| **Drag-and-Drop & Audio Import** | Selesai | Drag-and-drop file audio langsung ke track lane dengan beat snapping & upload tombol di header |
| **Garis Otomasi (Automation Lanes)** | Selesai | Sub-lane kurva SVG interaktif (Volume & Pan), live breakpoint dragging, evaluasi audio realtime & offline |
| **Punch-In / Punch-Out Locators** | Selesai | Auto-punch range di ruler (`P-IN`, `P-OUT`), shading zone, sinkronisasi transport state |
| **Step Sequencer & Drum Synthesis** | Selesai | 16/32-step, velocity, swing, 6 suara perkusi prosedural, preset beat & IndexedDB pattern storage |
| **MIDI Piano Roll & Skala** | Selesai | 88-tuts C1–B7, scale assistance (Mayor, Minor, Pentatonis, Blues), kuantisasi, transposisi |
| **Synthesizer & Presets** | Selesai | PolySynth ADSR, cutoff, resonansi, preset dropdown (808 Sub Bass, Saw Bass, Neon Lead, Warm Pad, dll.) |
| **Efek Internal & Routing** | Selesai | EQ 3-Band, Compressor, Limiter, Reverb, Delay Stereo, Noise Gate, Filter, Chorus, Utility Gain |
| **Mixer Console & Aux Sends** | Selesai | Pan slider stereo, Send Aux Reverb & Delay, Master limiter indicator, VU metering live |
| **Multitrack Audio Recording** | Selesai | Enumerate audioinput, live input metering, 1-bar count-in metronome, IndexedDB blob take |
| **Mastering & WAV Export** | Selesai | OfflineAudioContext rendering dengan Aux reverb & delay return parity, 16/24-bit RIFF WAV |
| **Tracks & Track Types (Mixcraft)** | Selesai | 8 tipe track (Audio, MIDI/Instrument, Video, Video-Text, Submix, Send, Output, Vocoder), custom icons, tinggi track dinamis, Freeze/Unfreeze, Bounce track, Track reordering |
| **Common Track Controls (Mixcraft 10)** | Selesai | Volume 0-200% dengan integrated level meter (output/input), Pan slider, Set Exact Value, fine drag modifiers, Mute/Solo [Ctrl]+click logic, Arm dropdown menu, multi-select relative tracking, Track Linking groups, Shift+Drag resize all, cycling height (Small/Normal/Large/Super Big Gulp X-Treme™) |
| **Adding a New Track & Menu Persist** | Selesai | Tombol `+ Track`, klik area kosong track list, Menu Persist Switch (slider biru), Add Track (bawah) vs Insert Track (di atas track terpilih), Top Menu `Track > Add Track` & `Track > Insert Track` |
| **Inline FX & Purple Effect Buttons** | Selesai | Opsi Show Effects On Tracks, tombol efek ungu dengan submenu Mixcraft 10 (Active, Remove, Effect List Is Active, Edit Effects List, Close All Effect Windows, Remove All Effects), tombol `+` quick insert |
| **Performance Panel & Master Track** | Selesai | Performance Panel (clip launcher grid jam mode, scene triggers S1-S4, Stop All), Show Master Track (Master Track Header di track list & arrangement lane di timeline dengan Brickwall limiter) |
| **Audio Track & Audio Track Header (Mixcraft 10)** | Selesai | Nomor track konstan (#1 dst), Rename, Pan & Volume fader/meter, Power switch efek ungu, Arm & Audio Inputs menu (Menu Persist, stereo/mono, Takes/Overdub/Replace), dedicated FX List button, Automation lane squiggly icon, Blue Mute/Solo with stripes, Software Monitoring, Guitar Tuner display replacement, Choose Track Image (JPG/PNG/GIF/BMP + library), Track Color bar |
| **Recording Audio Tracks & Lanes System (Mixcraft 10)** | Selesai | Record arm [CTRL]+B, Driver-aware volume fader (WaveRT/Wave red adjuster 3-zona meter vs ASIO hidden fader dengan ASIO HW PREAMP), Pemilihan input audio (Stereo 1+2, Mono 1, Mono 2) & multitrack simultan, Metronome Settings Dialog (Recording, Playback, Count-In measures), Dual-Arrow Tempo widget (±1 BPM & ±0.1 BPM), Software Monitoring (biru dengan dry recording), Multi-lane comping (Takes auto-mute previous passes, Overdub stack, Replace range), Manajemen Lanes ([Alt]+L tambah, delete bottom, [Alt]+K hapus lane kosong, Mute/Unmute lane, Denny Laine trivia) |
| **Track Right-Click Commands (Mixcraft 10)** | Selesai | Insert Track sub-menu (8 tipe track ke atas `insertAbove: true`), Delete Track, Color (14 palet HSL + dialog kustom), Link sub-menu (Link Selected, Unlink, Unlink All 'Fleetwood Mac', Select All Linked), Lanes sub-menu (Add, Delete, Delete Empty, Mute All, Unmute All, Select clips), FX... dialog, Show Effects On Tracks, Show Automation Lane, Properties sub-menu (Mute [Ctrl]+M, Solo [Ctrl]+L, Set Exact Volume & Pan, Height presets 64/96/144/240px Super Big Gulp X-Treme™, Cycle Track Size [Ctrl]+~, Choose Image), Mix To New Audio Track, Duplicate, Freeze/Unfreeze CPU saver (audio background, bypass FX, arsir biru), Select All Clips, Reorder Ke Atas/Bawah |
| **Virtual Instrument / MIDI Track & Header (Mixcraft 10 & 10.5)** | Selesai | Ikon keyboard di samping Mute, default VSTi naming (#1 dst), Pan slider (-100% s/d +100%) & Volume fader (0-200%) dengan mode normal output meter vs armed note velocity input meter, Insert effects slots & handle tepi kanan `<->`, Instrument Quick Access (Mixcraft 10.5 tombol instrumen, power bypass switch, drag move & Alt+drag copy ke tombol keyboard track tujuan), Menu Arm & Masukan MIDI (Menu Persist slider biru, pemilih MIDI input devices: All/MTK/USB/DrumPad/MIDIGuitar/EWI, kanal MIDI All Omni & Ch 1-16, mode rekaman Takes/Overdub/Replace, Automatic Quantization on the way in 1/4 s/d 1/16T, Snap Notes To Scale, Arm For Performance Panel, Arm track), tombol fx, ikon gelombang squiggly automasi, Solo & Mute [Ctrl]+click Han Solo logic, Track Image & Track Color |
| **Video & Video Text Tracks (Mixcraft 10)** | Selesai | Batasan 1 Video Track per proyek, Track Number konstan (#1 dst), Rename, Tombol Show/Hide Video Window (`Film`), Tombol Show/Hide Video Text Track (`+` / `-`), Squiggly automation lane, Track Image & Track Color bar, Mute/Solo video, floating video preview window synchronizer (SMPTE timecode `HH:MM:SS:FF` 30fps, rasio 16:9 / 4:3, fullscreen, import video/still image, live subtitle/lyrics text overlay preview), pembuatan otomatis Associated Audio Track langsung di bawah Video Track saat import video dengan audio (dapat dihapus tanpa mempengaruhi Video Track), quick text clip creator |
| **Audio Signal Flow & 3-Point Sends (Mixcraft 10)** | Selesai | Topologi 9 tahap: (1) Clips + automation, (2) DRY Send tap point murni, (3) Channels (Swap L/R, Phase Invert ØL/ØR, Mono sum, Stereo Width) & Input Gain, (4) Channel Strip (Compressor thresh, Drive preamp, 3-Band EQ, 4-Band Parametric EQ Q1/Q2), (5) Track Insert Effects list, (6) PRE Send (cue mix kebal fader), (7) Track Volume/Pan, (8) FFT Spectrum Analyzer & Oscilloscope, (9) POST Send (Aux return proporsional) |
| **Windows VST3 Native Bridge** | Selesai | Tauri 2 scanner command, fallback aman non-destruktif di Web/Android, `cargo check` lulus |
| **Pengujian Otomatis** | Selesai | 38 test suite / 246 unit tests lulus (Vitest), `tsc --noEmit` 0 errors, Next.js build 32/32 routes, `cargo check` 0 errors |
| **Panduan Pengguna & Troubleshooting** | Selesai | `docs/user-guide.md` (Workflow, Shortcuts, Mixer, Recording & Export, Section 12 Track Management, Section 13 Audio Track & Header Spec, Section 14 Recording Audio Tracks & Lanes System, Section 15 Audio Track Right-Click Commands, Section 16 Virtual Instrument / MIDI Track & Header, Section 17 Video & Video Text Tracks, Section 18 Audio Signal Flow) |




