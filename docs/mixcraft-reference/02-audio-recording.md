# Pemetaan Fitur Mixcraft 10: Audio Recording & Hardware Setup

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 2: Audio Hardware Setup (Hlm. 3 – 6)  
- Bab 7: Audio Track Header & Recording Audio Tracks (Hlm. 71 – 96)  
- Bab 5: Guitar Tuner & Transport Controls (Hlm. 37 – 43)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas fondasi perekaman audio studio: konfigurasi perangkat keras (audio interface USB), arsitektur driver audio, penyiapan track untuk rekaman (*record arming*), pemilihan kanal masukan (stereo vs mono), penanganan latensi dan software monitoring, metronom dan *count-in*, alat penyetem instrumen (*guitar tuner*), serta sistem jalur comping vokal/instrumen (*multi-lane takes*).

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-001` |
| **Bab dan subbab** | Audio Hardware Setup: Choosing An Audio Driver & Setting Audio Driver Type And Latency |
| **Halaman sumber** | Hlm. 3 – 5 |
| **Fitur referensi** | Driver Selection & Latency Buffer Size |
| **Tujuan** | Memberikan latensi ultra-rendah tanpa *gapping* atau *audio dropouts* saat memonitor rekaman langsung atau memainkan instrumen virtual. |
| **Perilaku** | Mixcraft mendukung ASIO, WaveRT, dan Wave. ASIO memberikan performa terbaik di Windows desktop, sedangkan WaveRT menyediakan buffer eksklusif. |
| **Alur penggunaan** | Buka `File > Preferences... > Sound Device`, pilih driver, atur buffer size (misal 128 atau 256 sampel). |
| **Input/output** | In: Konfigurasi driver OS; Out: Latensi riil (ms), ukuran frame buffer. |
| **Ketergantungan** | Audio hardware interface & OS audio daemon. |
| **Pemetaan MusikKu** | Web & Android: Web Audio API `AudioContext` dengan kalibrasi latensi dinamis; Windows Desktop: Host WASAPI Exclusive / ASIO via Tauri 2 Rust backend. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Inisialisasi audio context tanpa underrun pada buffer kerja 256 frame. |
| **Test ID** | `TEST-DRV-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-002` |
| **Bab dan subbab** | Tracks and Types: Recording Audio Tracks — Choosing Recording Input |
| **Halaman sumber** | Hlm. 79 – 81 |
| **Fitur referensi** | Recording Input Routing (Stereo, Mono Left, Mono Right) |
| **Tujuan** | Merekam instrumen stereo (keyboard) atau sumber mono tunggal (mikrofon vokal pada channel 1 atau gitar pada channel 2) secara akurat tanpa rekaman panning miring. |
| **Perilaku** | Mengklik panah bawah tombol Arm membuka menu seleksi channel: `Stereo (1+2)`, `Mono (Left 1)`, `Mono (Right 2)`. |
| **Alur penggunaan** | Klik panah bawah di tombol `Arm` track, pilih `Stereo` atau `Mono Left`/`Mono Right`. |
| **Input/output** | In: Kanal input hardware audiointerface; Out: AudioBuffer stereo/mono. |
| **Ketergantungan** | `MediaStreamTrack` audio constraints & channel mapping. |
| **Pemetaan MusikKu** | Dropdown menu pada `TrackHeader` dengan properti `inputChannelMode: "stereo" \| "mono-left" \| "mono-right"` di Zod schema `StudioTrackSchema`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Mode mono-left hanya merekam saluran kiri dan memusatkannya di stereo panorama tanpa silence di saluran kanan. |
| **Test ID** | `TEST-REC-CH-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-003` |
| **Bab dan subbab** | Tracks and Types: Recording Audio Tracks — Recording Mode (Takes, Overdub, Replace) |
| **Halaman sumber** | Hlm. 82 – 85 |
| **Fitur referensi** | Multi-Pass Recording Modes & Takes System |
| **Tujuan** | Mendukung workflow rekaman profesional: *comping* vokal terbaik melalui multiple takes berulang tanpa kehilangan take terdahulu. |
| **Perilaku** | **Takes**: Setiap putaran loop membuat lane baru dan otomatis membisukan (*mute*) take lama; **Overdub**: Menumpuk sinyal baru; **Replace**: Menimpa rekaman lama pada durasi baru. |
| **Alur penggunaan** | Klik panah arm, pilih `Recording Mode > Takes`, aktifkan loop mode pada transport bar, lalu tekan tombol Record. |
| **Input/output** | In: Multi-pass audio recording; Out: Klip-klip take terpisah pada indeks lane masing-masing. |
| **Ketergantungan** | Timeline lanes arrangement engine & track state `laneCount`. |
| **Pemetaan MusikKu** | Properti `StudioTrack.recordingMode` ("takes" \| "overdub" \| "replace"), `laneCount`, `mutedLaneIndices`, dan `StudioClip.laneIndex`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Perekaman 3 putaran loop dalam mode Takes menghasilkan 3 klip pada 3 lane berbeda dengan lane 0 dan 1 dibisukan otomatis. |
| **Test ID** | `TEST-REC-LANES-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-004` |
| **Bab dan subbab** | Tracks and Types: Recording Audio Tracks — Lanes Management Commands |
| **Halaman sumber** | Hlm. 85 – 86, 92 |
| **Fitur referensi** | Add Lane, Delete Empty Lanes, Mute/Unmute All Lanes |
| **Tujuan** | Memberikan kontrol penuh pengorganisasian lane comping kepada musisi. |
| **Perilaku** | Pintasan `[Alt]+L` menambah lane baru; `[Alt]+K` membersihkan seluruh lane yang tidak berisi klip audio aktif; Mute All membisukan seluruh lane pada track. |
| **Alur penggunaan** | Klik kanan track > menu `Lanes`, atau gunakan hotkey `[Alt]+L` / `[Alt]+K`. |
| **Input/output** | In: Perintah pengguna; Out: Pembaruan struktur array lane track. |
| **Ketergantungan** | Track hierarchy state & timeline renderer. |
| **Pemetaan MusikKu** | Implementasi handler `handleAddLane`, `handleDeleteEmptyLanes`, `handleMuteAllLanes`, dan pintasan keyboard di `page.tsx` & `timeline.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Eksekusi `[Alt]+K` pada track dengan 4 lane di mana hanya lane 0 dan 2 yang memiliki klip akan mereduksi total lane menjadi 2 tanpa merusak posisi klip. |
| **Test ID** | `TEST-LANES-MGMT-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-005` |
| **Bab dan subbab** | Tracks and Types: Recording Audio Tracks — Software Monitoring |
| **Halaman sumber** | Hlm. 86 – 87 |
| **Fitur referensi** | Software Monitoring Switch |
| **Tujuan** | Memungkinkan musisi mendengarkan sinyal input mereka sendiri melalui headphone selama proses perekaman. |
| **Perilaku** | Tombol speaker/earphone biru menyala; sinyal masukan di-route ke bus output. Rekaman audio tetap disimpan dalam kondisi mentah (*dry capture*). |
| **Alur penggunaan** | Klik tombol software monitoring pada header track. |
| **Input/output** | In: Input stream; Out: Output buffer playback monitor. |
| **Ketergantungan** | Audio node pass-through routing. |
| **Pemetaan MusikKu** | Tombol `Software Monitoring` pada baris tengah `TrackHeader`, sinkron dengan state `softwareMonitoring: boolean`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Mengaktifkan software monitoring menyalurkan sinyal input ke output tanpa menyebabkan loop feedback tertutup. |
| **Test ID** | `TEST-REC-MON-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-REC-006` |
| **Bab dan subbab** | Mixcraft Main Window Reference: Transport — Guitar Tuner |
| **Halaman sumber** | Hlm. 37 |
| **Fitur referensi** | Integrated Guitar Tuner |
| **Tujuan** | Memfasilitasi penyeteman gitar, bass, atau instrumen akustik secara langsung sebelum melakukan rekaman. |
| **Perilaku** | Menggantikan fader volume dan nama track dengan tampilan tuner nada digital (nama not, frekuensi Hz, dan offset penyimpangan jarum -50 s.d. +50 cent). |
| **Alur penggunaan** | Klik ikon garpu tala di header track atau klik kanan > `Guitar Tuner`. |
| **Input/output** | In: Aliran audio masukan instrumen; Out: Not terdekat (misal E2, A2) dan deviasi cents. |
| **Ketergantungan** | Pitch detection algorithm (autocorrelation / YIN). |
| **Pemetaan MusikKu** | Komponen tuner visual terintegrasi di `TrackHeader` dengan deteksi pitch FFT real-time. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Nada 440.0 Hz terdeteksi sebagai not `A4` dengan deviasi 0 cent (in-tune). |
| **Test ID** | `TEST-TUNER-01` |
