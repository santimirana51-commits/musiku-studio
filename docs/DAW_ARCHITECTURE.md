# Arsitektur Multi-Platform MusikKu Studio DAW

Dokumen ini mendefinisikan arsitektur rekayasa perangkat lunak 14-lapisan (*14-Layer Architecture*) untuk **MusikKu Studio**, memastikan konsistensi performa audio profesional di seluruh platform Web (W3C standard), Android (Capacitor touch), dan Windows Desktop (Tauri 2 Rust).

---

## 1. Diagram 14-Lapisan Sistem DAW

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. PRESENTATION / UI LAYER                                            │
│  Next.js 14 App Router, React 18, Tailwind CSS, Lucide Icons           │
│  (Timeline, TrackHeader, TransportBar, Mixer, PianoRoll, VideoWindow) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  2. PROJECT DOMAIN MODEL LAYER                                         │
│  Zod Schemas: StudioProject, StudioTrack, StudioClip, SubgroupBus      │
└─────────┬─────────────────────────┬──────────────────────────┬─────────┘
          │                         │                          │
┌─────────▼──────────────┐ ┌────────▼──────────────┐ ┌─────────▼─────────┐
│ 3. ARRANGEMENT ENGINE  │ │ 9. AUTOMATION ENGINE  │ │ 10. RECORDING ENG │
│ Clips, Tracks, Splits, │ │ Breakpoints, Curves,  │ │ MediaDevices, Arm,│
│ Trim, Grid Snap, Ruler │ │ Parameter Modulators  │ │ Takes & Comp Lanes│
└─────────┬──────────────┘ └────────┬──────────────┘ └─────────┬─────────┘
          │                         │                          │
┌─────────▼─────────────────────────▼──────────────────────────▼─────────┐
│  8. MIXER & ROUTING GRAPH LAYER                                        │
│  9-Stage Mixcraft Signal Flow (Clips -> Dry Send -> Channel Strip ->   │
│  Insert FX -> Pre Send -> Volume/Pan -> Analyzers -> Post Send)        │
└─────────┬─────────────────────────┬──────────────────────────┬─────────┘
          │                         │                          │
┌─────────▼──────────────┐ ┌────────▼──────────────┐ ┌─────────▼─────────┐
│ 4. AUDIO ENGINE        │ │ 5. MIDI ENGINE        │ │ 7. DSP EFFECTS    │
│ Dual-Clock Scheduler,  │ │ Notes, Ticks (960 PPQ)│ │ 3-Band/Param EQ,  │
│ Web Audio AudioContext │ │ Quantize, Scale Snap  │ │ Comp, Limiter, RVB│
└─────────┬──────────────┘ └────────┬──────────────┘ └─────────┬─────────┘
          │                         │                          │
          └─────────────────────────┼──────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  6. INSTRUMENT ENGINE                                                  │
│  Subtractive PolySynth, Procedural Drum Synth, VST3 Native Bridge Host │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  11. RENDERING / EXPORT ENGINE                                         │
│  OfflineAudioContext deterministic renderer, 16/24-bit RIFF WAV        │
└─────────┬────────────────────────────────────────────────────┬─────────┘
          │                                                    │
┌─────────▼──────────────────────────────┐ ┌───────────────────▼─────────┐
│ 12. PERSISTENCE & RECOVERY LAYER       │ │ 14. CLOUD SYNC LAYER        │
│ IndexedDB (idb), Blob take store,      │ │ Supabase Cloud Auth,        │
│ Autosave, Schema migrations (.musiku)  │ │ Remote Metadata Sync        │
└─────────┬──────────────────────────────┘ └───────────────────┬─────────┘
          │                                                    │
┌─────────▼────────────────────────────────────────────────────▼─────────┐
│  13. PLATFORM ADAPTERS LAYER                                           │
│  • Web Adapter: W3C Web Audio, Web MIDI API, MediaRecorder             │
│  • Android Adapter: Capacitor Touch Optimized, Low-Latency Web Audio   │
│  • Windows Desktop Adapter: Tauri 2 Rust, WASAPI Exclusive, VST3 Host  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Perincian 14 Lapisan Arsitektur

### 1. Presentation / UI Layer
- Dibangun dengan React 18 dan Next.js App Router (`src/app/studio/page.tsx`).
- Seluruh komponen dirancang modular: `timeline.tsx` (aransemen multi-track), `track-header.tsx` (kontrol strip kanal per track), `transport-bar.tsx` (kontrol pemutaran, tempo, time signature, snap), `mixer.tsx` (konsol fader studio), `piano-roll.tsx` (editor MIDI 88-tuts), `step-sequencer.tsx` (grid drum 16/32 step), dan `video-window.tsx` (jendela preview video floating).

### 2. Project Domain Model Layer
- Didefinisikan secara deklaratif menggunakan pustaka Zod di `src/lib/studio/schema.ts` dan tipe TypeScript di `types.ts`.
- Memvalidasi integritas data proyek (`StudioProject`), trek (`StudioTrack`), klip audio/MIDI (`StudioClip`), jalur bus (`SubgroupBus`), dan rantai plugin (`PluginInstance`).

### 3. Arrangement & Timeline Engine
- Mengatur penempatan klip pada kisi ketukan musikal (*musical beats*).
- Menangani operasi non-destruktif: pembelahan klip di playhead (*split at playhead / scissors*), pemangkasan tepi (*trimming*), penggeseran waktu, dan perataan snap grid (Bar, 1/4, 1/8, 1/16).

### 4. Audio Engine Layer (`src/lib/studio/audio-engine.ts`)
- **Dual-Clock Architecture**: Memisahkan waktu riil hardware audio clock (`currentTime`) dari rendering UI browser (`requestAnimationFrame`).
- **Lookahead Scheduler**: Interval timer berjalan setiap 25 ms dengan jendela lookahead 150 ms untuk menjadwalkan event audio secara mulus tanpa jitter atau suara tersendat akibat beban CPU.

### 5. MIDI Engine Layer
- Satuan waktu musikal berbasis resolusi standar 960 PPQ (*Pulses Per Quarter Note*).
- Menangani kuantisasi waktu masuk (*quantize on the way in*), penyelarasan tangga nada (*scale snapping*), penanganan not polifonik, dan integrasi Web MIDI API.

### 6. Instrument Engine Layer (`src/lib/studio/synth.ts`)
- **Subtractive PolySynth**: Osilator polifonik 4 gelombang (sine, sawtooth, square, triangle), ADSR envelope eksponensial, dan filter resonant lowpass.
- **Procedural Drum Engine**: Pembangkitan suara perkusi sintetis (Kick, Snare, Clap, Closed/Open Hi-hat, Percussion).
- **Desktop VST3 Host**: Jembatan IPC ke modul native desktop untuk memuat plugin VSTi eksternal pada platform Windows.

### 7. DSP / Effects Engine Layer (`src/lib/studio/effects.ts`)
- Rangkaian node efek bawaan: 3-Band Parametric EQ, Studio Compressor, Master Brickwall Limiter, Stereo Convolution Reverb, Stereo Feedback Delay, dan Filter multimode.

### 8. Mixer & Routing Graph Layer
- Mengimplementasikan topologi 9 tahap standar Acoustica Mixcraft 10:
  1. Clips (clip-level automation)
  2. DRY - Fader Send
  3. Channels Utilities (Swap L/R, Phase Invert, Mono, Width) & Input Gain
  4. Channel Strip (Compressor, Preamp Drive, EQ)
  5. Track Insert Effects Rack
  6. PRE - Fader Send (Headphone Cue Mix)
  7. Track Volume Fader & Panning
  8. FFT Spectrum Analyzer & Oscilloscope
  9. POST - Fader Send (Aux Reverb/Delay Return)
  10. Subgroup Buses (1-4) & Master Bus Output

### 9. Automation Engine Layer
- Menjadwalkan kurva automasi titik breakpoint (`AutomationPoint`) secara linear dan kurva lengkung ke Web Audio parameters via `linearRampToValueAtTime`.

### 10. Recording Engine Layer
- Menangkap stream mikrofon terkalibrasi murni tanpa noise-suppression atau echo-cancellation artifisial, meter level visual input, sistem jalur comping vokal (*takes multi-lane*), dan punch-in/punch-out locators.

### 11. Rendering / Export Engine Layer (`src/lib/studio/export.ts`)
- Render multi-track berkecepatan tinggi menggunakan `OfflineAudioContext`.
- Mengonversi buffer Float32Array menjadi format berkas biner RIFF WAV lossless 16-bit atau 24-bit PCM.

### 12. Project Persistence & Recovery Layer (`src/lib/studio/storage.ts`)
- Penyimpanan lokal tak terbatas di IndexedDB (`idb`), manajemen take rekaman biner Blob, autosave berkala, dan pemulihan darurat saat browser tertutup tidak sengaja.

### 13. Platform Adapters Layer (`src/lib/studio/adapters/`)
- Menyatukan antarmuka audio DAW di balik kontrak terpadu dengan implementasi spesifik:
  - `web-adapter.ts`: Browser modern berbasis W3C API.
  - `android-adapter.ts`: Capacitor WebView touch-friendly.
  - `windows-adapter.ts`: Tauri 2 Rust desktop commands.

### 14. Cloud Synchronization Layer
- Sinkronisasi metadata proyek, daftar lagu, dan otentikasi pengguna menggunakan Supabase Cloud.

---

## 3. Keputusan Teknis Penting (Architectural Decision Records)

1. **Pemilihan Web Audio API vs WebAssembly AudioWorklet**:
   - Web Audio API bawaan browser memiliki optimasi C++ tingkat kernel yang sangat efisien dan terakselerasi hardware. AudioWorklet disiapkan untuk modul DSP kustom tingkat lanjut pada iterasi mendatang.
2. **Penggunaan Zod untuk Validasi Proyek**:
   - Menjamin bahwa berkas proyek `.musiku` yang dimuat selalu terverifikasi secara ketat sebelum dimasukkan ke audio engine, mencegah crash runtime akibat data rusak atau versi usang.
3. **Isolasi Aliran Audio YouTube**:
   - Menolak tegas pelanggaran batasan CORS YouTube IFrame demi integritas kepatuhan hukum dan keamanan platform. DAW beroperasi secara independen pada audio lokal pengguna.
