# Platform Capabilities — MusikKu

> Fase 2. Tabel kejujuran kemampuan per sumber × platform. UI WAJIB membaca tabel ini (via `capabilities` engine) sebelum menampilkan tombol/klaim. Diperbarui tiap fase.

Legenda: ✅ didukung · ❌ tidak didukung (jangan klaim/jangan tampilkan aktif) · ⚠️ terbatas (tampilkan + penjelasan).

## Web (aktual, terverifikasi Fase 2)

| Kemampuan | YouTube (IFrame resmi) | File lokal/cloud (`WebLocalEngine`) | Mic karaoke | AI Lyrics Studio |
|---|---|---|---|---|
| Play / Pause / Next / Prev / Queue | ✅ (level antrean) | ✅ | N/A | N/A |
| Stop (keluar antrean) | ✅ | ✅ | ✅ (tutup stream) | N/A |
| Seek | ❌ (level antrean; posisi milik player view) | ✅ | N/A | N/A |
| Volume / Mute | ❌ | ✅ | ✅ (gain mic/monitor) | N/A |
| Shuffle / Repeat | ❌ | ✅ (off/all/one) | N/A | N/A |
| EQ 10-band di jalur audio | ❌ permanen (cross-origin) | ✅ Web Audio API aktif via `/equalizer` | ✅ | N/A |
| Background (tab tutup/layar mati) | ❌ | ⚠️ Tab hidup / minimized (OS policy) | N/A | N/A |
| Media Session OS | ❌ (jangan klaim) | ✅ Terintegrasi `navigator.mediaSession` | N/A | N/A |
| Artwork/metadata | ✅ (thumbnail/title/channel) | ✅ (metadata impor; artwork opsional) | N/A | N/A |
| AI Lyrics Generation | N/A | N/A | N/A | ✅ Server-side proxy (Gemini/OpenAI/Fallback) |

Deteksi runtime: `detectWebCapabilities()` (`src/lib/audio/capabilities.ts`) → `{ hasAudioElement, hasAudioContext, hasMediaSession, hasIndexedDB, hasPersistentStorage }` — semua boolean jujur, tanpa polyfill palsu.

## Android (Capacitor — Siap Build)

| Kemampuan | YouTube (WebView IFrame) | File lokal (native service) |
|---|---|---|
| Background + MediaSession/notifikasi | ❌ (tetap foreground) | ✅ `PlaybackService.java` (foreground service + media notification + audio focus) |
| EQ native | ❌ | ⚠️ Web Audio API di WebView (aktif untuk file lokal/cloud) |
| File picker | N/A | ✅ Scoped storage standar, tanpa `MANAGE_EXTERNAL_STORAGE` |

## Windows (Tauri 2 — Spike Terkonfigurasi)

| Kemampuan | YouTube | File lokal |
|---|---|---|
| Bertahan saat minimize | ❌ (WebView ikut jendela) | ✅ (proses audio tetap berjalan) |
| SMTC/keyboard media | ❌ untuk YouTube | ⚠️ Tauri plugin bridge |
| Close vs minimize vs exit | — | Semantik disiapkan di `src-tauri/tauri.conf.json` |

## Validasi impor (Fase 2, Web aktual)

1. `checkMusicFile()` (ekstensi/MIME + ukuran) — gerbang cepat.
2. `probeAudioDecodable()` (`src/lib/local-library/decode-probe.ts`) — `decodeAudioData` atas salinan buffer; korup/codec tak didukung → tolak dengan pesan; tanpa decoder → izinkan + peringatan jujur (bukan klaim OK). Server tetap validasi sendiri.

## Aturan UI

- Tombol fitur `canX=false` = sembunyikan ATAU tampil nonaktif + tooltip "Tidak didukung untuk sumber ini" — jangan tampil seolah aktif.
- Status sumber selalu terlihat (`SourceBadge`: YouTube / Lokal / Cloud).
- Setiap klaim background/EQ di UI harus merujuk baris tabel ini.

---

## MusikKu Studio (DAW Multitrack Engine)

| Kemampuan DAW | Web (Browser / PWA) | Android (Capacitor) | Windows (Tauri Desktop Pro) |
|---|---|---|---|
| **Audio Engine Architecture** | In-browser Web Audio API & AudioWorklet | Android Oboe / AAudio C++ stream (Native Bridge) | **Native Rust Engine (WASAPI Exclusive / ASIO)** terpisah dari thread UI |
| **Separasi UI & Audio Thread** | Shared browser process | WebView UI + Native Audio Service | ✅ **Terpisah sepenuhnya** (Pro Audio Thread via MMCS) |
| **Multitrack Playback** | ✅ Web Audio API | ✅ Oboe / AAudio C++ Stream | ✅ Native WASAPI / ASIO |
| **Multitrack Recording** | ✅ MediaDevices API | ✅ Oboe low-latency stream + Audio Focus | ✅ Direct Hardware Driver / WASAPI |
| **Internal Synthesizers** | ✅ PolySynth ADSR (identik) | ✅ PolySynth ADSR (identik) | ✅ PolySynth ADSR (identik) |
| **Internal Effects Suite** | ✅ EQ, Comp, Limiter, Reverb, Delay | ✅ EQ, Comp, Limiter, Reverb, Delay | ✅ EQ, Comp, Limiter, Reverb, Delay |
| **External VST3 Plugins** | ❌ Tidak didukung browser | ❌ Tidak didukung Android | ✅ **Native VST3 Host Container** (Crash-isolated) |
| **Format Proyek (`.musikku`)** | ✅ Identik (Schema `1.0.0`) | ✅ Identik (Schema `1.0.0`) | ✅ Identik (Schema `1.0.0`) |
| **Offline WAV Export** | ✅ `OfflineAudioContext` | ✅ `OfflineAudioContext` | ✅ `OfflineAudioContext` & Native Stream |
| **Project Storage** | ✅ IndexedDB lokal | ✅ IndexedDB lokal | ✅ IndexedDB + Native File System |
| **Karaoke Teleprompter** | ✅ Sinkronisasi Playhead | ✅ Sinkronisasi Playhead | ✅ Sinkronisasi Playhead |
| **Cloud Project Sync** | ⚠️ Supabase (opsional) | ⚠️ Supabase (opsional) | ⚠️ Supabase (opsional) |

### Penjelasan Arsitektur Khusus Platform:
1. **Windows Pro**:
   - Audio processing dan host plugin VST3 berjalan di proses native Rust (WASAPI Exclusive / ASIO) pada thread multimedia berprioritas tinggi.
   - UI frontend (Next.js / Tauri WebView) terisolasi sepenuhnya; perubahan frame rate DOM atau GC JavaScript tidak memengaruhi stabilitas audio buffer.
   - Host VST3 memiliki proteksi isolasi crash agar kerusakan plugin pihak ketiga tidak merusak proyek aktif.
2. **Web & Android**:
   - Menggunakan backend audio khusus platform (`WebAudioBackendAdapter` dan `AndroidNativeBackendAdapter`).
   - Format proyek (`StudioProject`), timing tick musikal (960 PPQ), dan preset efek internal 100% identik sehingga proyek dapat dibuka lintas platform tanpa ketidakcocokan data.


