# MusikKu Studio — DAW Multiplatform Architecture

Dokumen ini mendefinisikan arsitektur sistem digital audio workstation (DAW) **MusikKu Studio**, yang terintegrasi secara modular ke dalam aplikasi MusikKu untuk platform Web, Android, dan Windows.

---

## 1. Prinsip Desain & Batasan Inti

1. **Pemisahan Model & Rendering (Separation of Concerns)**:
   - State proyek DAW berorientasi *single source of truth* berbasis data murni (pure JSON-serializable schema) dengan validasi skema ketat menggunakan Zod (`StudioProjectSchema`).
   - Audio Engine tidak bergantung pada siklus render React/DOM. Transport, penjadwalan, dan manipulasi audio buffer berjalan secara mandiri.
   - UI Timeline tidak merender ulang seluruh komponen saat playhead bergerak, melainkan menggunakan decoupled animation loop (`requestAnimationFrame`) dengan pointer transform atau kanvas terisolasi.

2. **Hierarki Ketepatan Waktu (Musical Timing vs Absolute Time)**:
   - Sumbu waktu musikal berbasis **Beats** dan **Ticks** (standar industri: 960 PPQ — Pulses Per Quarter note) untuk penempatan not MIDI, grid snap, automasi, dan penyesuaian tempo.
   - Konversi waktu: $\text{detik} = \frac{\text{beats}}{\text{BPM}} \times 60$.
   - Klip audio memiliki koordinat posisi beat di timeline serta panjang durasi detik/sample asli dari buffer sumber.

3. **Platform-Honest Audio Backends**:
   - **Web & PWA**: Web Audio API (`AudioContext`, `OfflineAudioContext`), lookahead scheduling (25 ms interval / 150 ms window), dan MediaDevices API untuk multitrack recording.
   - **Android**: Capacitor bridge dengan background audio awareness, audio focus, low-latency buffer tuning, dan antarmuka Oboe/AAudio C++ bila tersedia di lapisan native.
   - **Windows**: Desktop shell (Tauri 2) dengan backend native low-latency (WASAPI Exclusive / ASIO), audio thread terisolasi dari UI (`AvSetMmThreadCharacteristics("Pro Audio")`), dan kontainer host VST3 eksternal. Plugin VST3 *tidak pernah* dieksekusi di Web atau Android; sistem mempertahankan metadata dan parameternya secara aman tanpa merusak proyek.

---

## 2. Diagram Arsitektur Sistem

```
+-----------------------------------------------------------------------------------+
|                            MUSIKKU STUDIO UI LAYER                                |
|  - Toolbar & Transport (Play, Stop, Rec, BPM, Loop, Metronome, Count-In)          |
|  - Timeline & Track Arrangement (Grid Snap, Audio/MIDI Clips, Automation Lanes)   |
|  - Step Sequencer (16/32 Steps, Velocity, Swing, Drum Presets)                    |
|  - Piano Roll (MIDI Editing, Velocity, Scale/Chord Assistance, Quantization)      |
|  - Mixer Console (Faders, Meters, Inserts Rack, Sends/Buses, Master Limiter)       |
|  - Plugin & Instrument Dialogs / Asset Browser / Teleprompter Lirik Karaoke       |
+-----------------------------------------------------------------------------------+
                                         │  (Dispatches actions / state updates)
                                         ▼
+-----------------------------------------------------------------------------------+
|                           PROJECT & EDITING CORE (TS)                             |
|  - StudioProject Schema (Zod) & Versioning (1.0.0)                                |
|  - History / Undo-Redo Stack (Immutable snapshots)                                |
|  - Asset Manifest & Blob Resolver (IndexedDB / Local Storage)                     |
|  - JSON Import-Export / Autosave / Recovery                                       |
+-----------------------------------------------------------------------------------+
                      │                                        │
                      │ (Syncs timeline & parameters)          │ (Renders offline)
                      ▼                                        ▼
+------------------------------------+  +-------------------------------------------+
|      REALTIME AUDIO ENGINE         |  |             EXPORT & RENDER               |
|  - Transport Scheduler (Lookahead) |  |  - OfflineAudioContext (Web / Native)     |
|  - Track Audio Routing & Summing   |  |  - RIFF WAV File Encoder (16/24-bit PCM)  |
|  - Sends & Bus Processing          |  |  - Peak Normalization & Tail Processing   |
|  - Automation Evaluator            |  |  - Audio Header & Payload Validation      |
|  - Multitrack Recording Stream     |  +-------------------------------------------+
+------------------------------------+
       │                    │                           │
       ▼                    ▼                           ▼
[Internal Instruments] [Internal Effects]          [Platform Audio Adapters]
- PolySynth (ADSR)   - 3-Band Parametric EQ        ├─ Web: AudioContext & MediaStream
- Drum Synthesizer   - Compressor & Limiter        ├─ Android: Oboe/AAudio Stream Bridge
- Percussion Sampler - Stereo Delay & Reverb       └─ Windows: Tauri Native WASAPI &
                     - Noise Gate & Filter                     VST3 Host Container
```

---

## 3. Komponen Inti & Alur Data

### 3.1 Model Proyek Terpadu (`src/lib/studio/types.ts` & `schema.ts`)
- `StudioProject`:
  - `schemaVersion`: `"1.0.0"` untuk kompatibilitas ke depan dan migrasi aman.
  - `tempo`: BPM (20 s.d. 320).
  - `timeSignature`: Pembilang dan penyebut nada (default `[4, 4]`).
  - `loopRange`: Titik loop start dan end dalam satuan beat.
  - `tracks`: Koleksi track audio dan MIDI dengan fader gain, pan, mute, solo, armRecord, efek, sends, dan automasi.
  - `masterTrack`: Master gain, limiter brickwall, dan master insert rack.
  - `assetManifest`: Indeks aset audio (rekaman mikrofon, backing track) terpisah dari payload metadata JSON.
  - `lyrics`: Data lirik karaoke terintegrasi dengan penanda waktu (*time-synced lyrics*).

### 3.2 Beat Making & Step Sequencer
- Menggabungkan 16 hingga 32 ketukan per birama untuk suara perkusi utama:
  1. Kick (Sub bass sintetis & punch transient).
  2. Snare (Noise filtered & body resonant).
  3. Clap (Burst noise envelope).
  4. Hi-Hat Closed & Open (Metallic resonant oscillator/noise).
  5. Percussion / Tom / Rimshot.
- Dilengkapi pengaturan aksen/velocity per step, swing percentage, dan preset beat siap pakai (Boombap, Trap, Pop, R&B, House).
- Pola step sequencer dapat langsung diekspor menjadi klip MIDI di arrangement timeline.

### 3.3 Piano Roll & Notasi MIDI
- Visualisasi matriks nada C1 (24) hingga C7 (96) dengan pembeda tuts hitam/putih.
- Pengaturan beat snap (1/4, 1/8, 1/16, 1/32) dan kuantisasi instan.
- Velocity editor untuk ekspresi dinamis tiap nada.
- Bantuan tangga nada (*scale assistance*: Mayor, Minor Natural, Pentatonik, Blues) dan transposisi semi-nada.

### 3.4 Multitrack Recording Pipeline
- Enumerasi perangkat masukan melalui `navigator.mediaDevices.enumerateDevices()`.
- Perekaman simultan pada seluruh track yang memiliki status `armRecord: true`.
- Meter level input live (analyser RMS/Peak) dengan indikator clipping warna merah (> -0.1 dBFS).
- Fitur **Count-In** (1 birama metronom sebelum rekaman aktif) agar musisi dapat bersiap.
- Penataan klip rekaman otomatis pada beat yang tepat sesuai posisi playhead saat recording dimulai.

### 3.5 Mixer, Subgroup Bus I/O Routing & Automasi
- **Topologi Graf Routing Audio (Directed Acyclic Graph / DAG)**:
  - Setiap track audio/MIDI memiliki routing masukan (**IN**) dan luaran (**BUS OUT**):
    - **IN**: Pemilihan kanal fisik peranti (`all` Stereo 1/2, `input_1` Mono Ch 1 L / Mic, `input_2` Mono Ch 2 R / Line).
    - **BUS OUT**: Rute luaran ke `master` atau Subgroup Bus mana pun (`bus_drums`, `bus_vocals`, `bus_music`, `bus_fx`, atau custom bus).
  - Alur sinyal track ke subgroup bus dan master:
    $$\text{Track Source} \rightarrow \text{Track Inserts} \rightarrow \text{Track Gain} \rightarrow \text{Track Pan} \rightarrow \begin{cases} \text{Aux Sends (Reverb/Delay)} \\ \text{Subgroup Bus} \rightarrow \text{Bus Inserts} \rightarrow \text{Bus Gain} \rightarrow \text{Bus Pan} \rightarrow \text{Master} \\ \text{Langsung ke Master (bila OUT = master)} \end{cases} \rightarrow \text{Master Limiter} \rightarrow \text{DAC}$$
- **Subgroup Buses Terintegrasi**:
  - Proyek secara default menyertakan 4 Subgroup Bus: **Drums Bus**, **Vocal Bus**, **Music Bus**, dan **FX Submix**, dengan opsi `+ Add Bus` untuk menambah bus submix kustom.
  - Setiap bus dilengkapi fader vertikal (+12 dB headroom), stereo panner, meter VU peak real-time, tombol Mute/Solo, serta rak insert efek (misal: *Master/Bus Compressor*, *Parametric EQ*).
  - Dialog plugin (`PluginDialog`) mendukung pemilihan bus untuk konfigurasi efek insert langsung pada bus terkait.
- **Validasi Siklus Graf & Deteksi Kerusakan**:
  - Metode `AudioEngine.validateRoutingGraph()` memastikan topologi strictly acyclic dan mendeteksi dependensi bus yang hilang sebelum pemrosesan real-time atau ekspor.
- **Paritas Ekspor Offline (WAV Rendering)**:
  - Modul ekspor `export.ts` membangun rantai Subgroup Bus identik di dalam `OfflineAudioContext`, menjamin konsistensi akustik penuh antara pemutaran live dan hasil bounce WAV.
- **Automasi**:
  - Automasi dievaluasi per-block buffer atau via parameter automation events Web Audio API (`linearRampToValueAtTime`).

### 3.6 Windows VST3 Native Host Container
- Pada desktop Windows (via Tauri 2 Rust module di `src-tauri`):
  - Memindai folder `%CommonProgramFiles%\VST3` dan `C:\Program Files\Common Files\VST3`.
  - Mengambil deskriptor VST3: UID, Nama, Vendor, Kategori (Effect / Instrument), jumlah bus audio in/out.
  - Menyediakan fallback UI generik untuk mengontrol parameter VST3 jika editor GUI asli tidak tersedia.
  - Crash containment: Host VST3 diisolasi pada proses/kontainer terpisah agar kegagalan binary pihak ketiga tidak merusak sesi UI utama DAW.
- Pada Web dan Android:
  - Instance VST3 dilaporkan secara jujur sebagai *Unavailable on this platform*.
  - Parameter dan ID VST3 tetap dipertahankan di dalam dokumen proyek saat pengguna menyimpan file, sehingga aman dibuka kembali di PC Windows.

### 3.7 Offline Rendering & Validasi Ekspor WAV
- Menjalankan seluruh trek, synthesizer, sample buffer, dan effect rack ke dalam `OfflineAudioContext`.
- Mengonversi buffer Float32Array ke format **RIFF WAV Linear PCM** (16-bit atau 24-bit).
- Normalisasi peak opsional untuk memaksimalkan rasio sinyal terhadap derau tanpa distorsi (*ceiling* -0.1 dBFS).
- Fungsi `validateWavBlob()` memverifikasi byte header RIFF/WAVE, sample rate, kanal, dan panjang data sebelum berkas disajikan ke pengguna.

### 3.8 Mixcraft Tracks & Types System
- **6 Tipe Track Khusus**:
  1. **Audio Track**: Perekaman mikrofon, drag-and-drop file audio, volume/pan fader, aux sends, freeze to audio WAV.
  2. **Instrument / MIDI Track**: PolySynth polifonik atau step sequencer, piano roll MIDI events, preset instrumen, freeze pre-rendered WAV.
  3. **Video Track**: Pemutaran video stream tersinkronisasi transport untuk scoring/scoring film dan klip musik (maksimal 1 per proyek).
  4. **Video Text Track**: Subtitle, karaoke overlay teks tersinkronisasi ketukan musikal.
  5. **Submix Track**: Pengelompokan hierarkis sejumlah track anak untuk proses mixing bus terpusat.
  6. **Send Track**: Jalur efek aux khusus (Reverb/Delay return) dengan kontrol wet/dry fleksibel.
- **Kustomisasi & Optimasi Track**:
  - **Ikon & Warna Track**: Pilihan ikon representatif (`mic`, `piano`, `guitar`, `drums`, `synth`, `video`, `text`, `submix`, `send`) dan palet warna 14 corak.
  - **Tinggi Track Dinamis**: Preset Compact (64px), Normal (96px), Large (144px), Extra Large (192px) sesuai kebutuhan detail arrangement.
  - **Track Freeze / Unfreeze**: Melakukan offline render audio stem track ke WAV IndexedDB dan menonaktifkan proses synth/plugin untuk menghemat konsumsi CPU.
  - **Mix to New Audio Track (Bounce)**: Merender track beserta seluruh insert efek menjadi track audio terpisah.
  - **Track Reordering**: Memindahkan urutan track ke atas atau ke bawah pada aransemen secara instan.

---

## 4. Keamanan, Privasi & Penyimpanan Data
1. **Persetujuan Pengguna**: Perekaman audio memerlukan izin eksplisit mikrofon dari sistem operasi / browser.
2. **Penyimpanan Lokal Pertama (Offline-First)**: Berkas proyek dan audio rekaman disimpan di IndexedDB lokal browser atau media lokal desktop.
3. **Sinkronisasi Awan Opsional**: Unggah proyek atau take vokal ke Supabase bersifat *opt-in* dengan proteksi token autentikasi pengguna.
