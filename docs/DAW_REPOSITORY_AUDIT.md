# Audit Repository MusikKu Studio DAW

**Tanggal Audit:** 12 Oktober 2026  
**Auditor:** Senior DAW Software Architect & Audio DSP Engineer  
**Lingkup:** Seluruh basis kode repositori MusikKu (`musiku`) mencakup Web (Next.js), Desktop (Tauri 2 Rust), Mobile (Capacitor Android), WebExtension, dan modul audio studio.

---

## 1. Ikhtisar Ekosistem & Stack Teknologi

| Komponen | Teknologi | Versi Aktual | Keterangan & Status |
| :--- | :--- | :--- | :--- |
| **Framework Utama** | Next.js (App Router) | `14.2.13` | Rendering SSR/SSG/Client, API Routes |
| **Bahasa Pemrograman** | TypeScript / Node.js | `5.6.2` / Node 22 | Konfigurasi Strict Mode aktif |
| **Library UI** | React / React DOM | `18.3.1` | Client components interaktif (`"use client"`) |
| **Styling** | Tailwind CSS / Lucide Icons | `3.4.13` / `0.446.0` | Dark-mode DAW estetika profesional |
| **Skema & Validasi Data** | Zod | `3.23.8` | Validasi model proyek, track, klip, plugin |
| **Database & Auth Cloud**| Supabase (`@supabase/supabase-js`) | `2.45.4` | Relasi metadata cloud & otentikasi user |
| **Penyimpanan Lokal** | IndexedDB via Native & Fake-IDB | `idb` / `fake-indexeddb 6.2.5` | Penyimpanan project JSON, take recording blob |
| **Desktop Native (Windows)** | Tauri 2 (Rust) | `tauri 2.0` / Rust 2021 | WASAPI Exclusive, scanner VST3, tray window |
| **Mobile Native (Android)** | Capacitor | `8.5.3` | Konfigurasi WebView, sinkronisasi native |
| **Browser Extension** | Manifest V3 WebExtension | Custom bash build | Tab audio capture & sinkronisasi eksternal |
| **Testing Framework** | Vitest | `2.1.3` | 38 test files, 246 tests passing |

---

## 2. Struktur Direktori & Titik Masuk (Entry Points)

```
musiku/
├── src/
│   ├── app/                      # Next.js App Router (Halaman & API Routes)
│   │   ├── studio/               # Entry point utama MusikKu Studio DAW (`page.tsx`)
│   │   ├── library/              # Pustaka musik & manajemen aset pengguna
│   │   ├── karaoke/              # Fitur pemutar karaoke & lirik tersinkronisasi
│   │   └── api/                  # REST API (sync, lyrics, audio search)
│   ├── components/               # Komponen Antarmuka Pengguna
│   │   ├── studio/               # 13 Komponen modular MusikKu Studio DAW:
│   │   │   ├── timeline.tsx              # Arranger, timeline grid, playhead, clip cutter
│   │   │   ├── track-header.tsx          # Channel strip header, vol/pan, FX, arm, routing
│   │   │   ├── transport-bar.tsx         # Transport control, BPM, time signature, punch, snap
│   │   │   ├── mixer.tsx                 # Konsol mixer, submix buses, aux return, master fader
│   │   │   ├── piano-roll.tsx            # Editor MIDI, skala musikal, velocity, notasi tuts
│   │   │   ├── step-sequencer.tsx        # 16/32-step drum sequencer, 6 suara perkusi
│   │   │   ├── performance-panel.tsx     # Clip launcher jam session (S1-S4 scene triggers)
│   │   │   ├── video-window.tsx          # Floating video preview window, SMPTE timecode
│   │   │   ├── master-track-header.tsx   # Master track controls & brickwall limiter display
│   │   │   ├── plugin-dialog.tsx         # Rak efek insert, preset synthesizer, DSP chain
│   │   │   ├── export-dialog.tsx         # Dialog bounce mixdown WAV 16/24-bit
│   │   │   ├── project-dialog.tsx        # Manajer proyek baru, buka/simpan, unduh JSON
│   │   │   └── karaoke-dock.tsx          # Docking panel lirik & integrasi karaoke
│   │   └── ui/                   # Elemen antarmuka dasar (buttons, dialogs, sliders)
│   └── lib/                      # Core Domain Logic & Audio Engines
│       └── studio/               # Inti MusikKu Studio DAW:
│           ├── audio-engine.ts           # Lookahead scheduler, Web Audio routing graph
│           ├── schema.ts                 # Definisi skema Zod (Project, Track, Clip, Bus)
│           ├── types.ts                  # Kontrak tipe TypeScript domain DAW
│           ├── storage.ts                # IndexedDB persistence & recovery manager
│           ├── synth.ts                  # Subtractive PolySynth & Procedural Drum Synth
│           ├── effects.ts                # Modul DSP efek (EQ, Comp, Limiter, Reverb, Delay)
│           ├── export.ts                 # OfflineAudioContext WAV 16/24-bit renderer
│           ├── step-sequencer.ts         # Pola ketukan drum pattern & model data
│           ├── vst3-bridge.ts            # Komunikasi IPC ke host VST3 desktop Windows
│           └── adapters/                 # Adaptor platform (Web, Android, Windows)
├── src-tauri/                    # Modul Desktop Windows (Tauri 2 Rust)
│   ├── src/main.rs               # Host commands WASAPI audio & pemindai plugin VST3
│   └── Cargo.toml                # Dependensi Rust (tauri v2, serde, serde_json)
├── extension/                    # Ekstensi Peramban (Manifest V3)
│   ├── src/background/           # Service worker & background audio capture
│   └── scripts/build.sh          # Skrip bundler ekstensi
└── docs/                         # Dokumentasi Arsitektur & Spesifikasi Sistem
```

---

## 3. Sistem Audio, MIDI, Recording, dan Export Aktual

### 3.1 Audio Engine & Routing Graph
- **Arsitektur Waktu Ganda**: Lookahead Scheduler (interval 25 ms dengan lookahead window 150 ms) memisahkan audio clock hardware (`currentTime`) dari UI rendering thread.
- **Topologi 9 Tahap Mixcraft 10**: Sinyal mengalir dari Klip -> Dry Send -> Channel Strip Utilities (Swap L/R, Phase Invert ØL/ØR, Mono, Stereo Width, Input Gain) -> Integrated Strip (Compressor, Preamp Drive, 3-Band EQ, 4-Band Parametric EQ) -> Track Insert Effects -> Pre-Fader Send (Cue Mix) -> Track Volume/Pan Fader -> FFT Analyzer & Oscilloscope -> Post-Fader Send (Aux Return) -> Subgroup Bus (Buses 1-4) -> Master Bus -> Brickwall Limiter -> Output Destination.
- **Pencegahan Loop**: Validasi siklus topological sorting mencegah rekursi send antar bus.

### 3.2 MIDI Engine & Virtual Instruments
- **Sintesis Polifonik**: Osilator polifonik dengan 4 bentuk gelombang (sine, sawtooth, square, triangle), ADSR envelope eksponensial, dan filter resonant lowpass (cutoff 20–20.000 Hz, Q 0.1–20).
- **Procedural Drum Engine**: Pembangkitan suara perkusi sintetis matematis tanpa dependensi sampel eksternal (Kick sweep 150Hz->35Hz, Snare transient + filtered white noise, Clap triple bursts, Hi-Hat resonant bandpass).
- **Piano Roll**: Editor MIDI grafis 88-tuts (C1–B7), kuantisasi not, velocity visualizer, dan bantuan tangga nada (*Scale Snapping*).
- **Step Sequencer**: Grid 16/32 ketukan drum sequencer dengan pengaturan swing dan aksen.

### 3.3 Sistem Perekaman (Recording & Comping)
- **Multitrack Recording**: Akses mikrofon terkalibrasi (`echoCancellation: false`, `noiseSuppression: false`), meter level input visual, metronom dengan hitungan mundur 1/2 birama (*count-in*).
- **Manajemen Jalur Take (Lanes Comping)**: Mode rekaman Takes (auto-mute take lama), Overdub (menumpuk event not), dan Replace (menimpa rentang waktu). Manajemen lane dinamis ([Alt]+L tambah lane, [Alt]+K bersihkan lane kosong).
- **Punch-In / Punch-Out**: Titik locator otomatis `P-IN` dan `P-OUT` pada timeline ruler.

### 3.4 Mastering & Export
- **Offline Rendering Engine**: Menggunakan `OfflineAudioContext` multi-kanal untuk me-render seluruh trek, automasi, efek insert, dan reverb tail secara deterministik.
- **Format WAV RIFF**: Enkoder biner PCM 16-bit dan 24-bit lossless dengan validasi integritas header biner (44 byte RIFF/WAVE chunk).

---

## 4. Analisis Multi-Platform & Kepatuhan Batasan

### 4.1 Web Browser (W3C Standar)
- **Kondisi**: Berjalan mulus di Chrome, Firefox, Edge, dan Safari.
- **Batasan**: Browser memberlakukan kebijakan *Autoplay Policy* (memerlukan interaksi pengguna sebelum `AudioContext.resume()`) dan pembatasan isolasi lintas-origin (*CORS*) untuk streaming YouTube.

### 4.2 Windows Desktop (Tauri 2 Rust)
- **Kondisi**: Backend Rust menyediakan perintah `get_desktop_capabilities`, pemindaian direktori plugin VST3 Windows (`C:\Program Files\Common Files\VST3`), dan telemetri audio latar belakang.
- **Status**: Perintah IPC tauri telah dideklarasikan dan teruji via adapter non-destruktif.

### 4.3 Android (Capacitor)
- **Kondisi**: Proyek telah dikonfigurasi dengan `com.musikku.app` dan skrip sinkronisasi `npx cap sync android`.
- **Rekomendasi**: Optimasi tata letak layar sentuh untuk panel timeline dan tombol fader fungsional.

### 4.4 Batasan Hak Cipta & Integrasi YouTube MusikKu
- **Prinsip Utama**: Sesuai klausul kepatuhan arsitektural, MusikKu Studio DAW memproses berkas audio lokal pengguna, rekaman mikrofon sah, instrumen virtual, dan sampel legal.
- **Isolasi Buffer**: Aliran audio pemutar YouTube eksternal tidak di-hack atau di-intercept melanggar ketentuan layanan platform.

---

## 5. Ringkasan Kesiapan & Rekomendasi Arsitektur

1. **Stabilitas Basis Kode**: Seluruh 38 test suite (246 unit tests) lulus 100% dan TypeScript bersih dari error (`npx tsc --noEmit` lolos).
2. **Kekuatan Fondasi**: Arsitektur modular yang sudah ada sangat siap menampung seluruh fitur lanjutan dari manual Mixcraft 10 tanpa perlu merombak ulang framework Next.js atau domain model Zod.
3. **Langkah Prioritas**:
   - Memetakan seluruh inventaris fitur manual Mixcraft 10 (807 halaman) ke dalam folder `docs/mixcraft-reference/`.
   - Membuat matriks ketertelusuran fitur di `docs/FEATURE_TRACEABILITY.md`.
   - Mengembangkan dokumentasi arsitektur resmi di `docs/DAW_ARCHITECTURE.md` dan format file di `docs/PROJECT_FORMAT.md`.
   - Meneruskan implementasi bertahap pada fitur-fitur berprioritas tinggi sesuai manual.
