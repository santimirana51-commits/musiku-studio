# Pemetaan Fitur Mixcraft 10: Mixer, Routing & Effects

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 7: Tracks and Types — Send Track, Submix Track, Output Bus Track, Master Track (Hlm. 149 – 193)  
- Bab 9: Details Tabs — Mixer Tab & Channel Strip Sections (Hlm. 359 – 378)  
- Bab 16: Using Effects & Effects Sidechaining (Hlm. 530 – 579)  
- Alur Sinyal Audio 9-Tahap & 3-Point Sends (Hlm. 60 – 75)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas arsitektur konsol pencampuran suara (*mixer console*), struktur sub-kelompok bus (*submix buses*), perutean sinyal gema bersama (*aux sends/returns*), pemrosesan strip kanal terintegrasi (preamp, kompresor, equalizer 3-band & 4-band parametrik), rak plugin insert VST3/internal, pencegahan loop umpan balik sinyal, serta topologi 9 tahap alur sinyal audio lengkap dengan tiga titik pencabangan send (*Dry, Pre, Post*).

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-201` |
| **Bab dan subbab** | Tracks and Types: Submix Track & Group Bus Mixing |
| **Halaman sumber** | Hlm. 164 – 175 |
| **Fitur referensi** | Submix Tracks / Subgroup Buses Architecture |
| **Tujuan** | Mengelompokkan sekumpulan track terkait (misal multi-track Drum: Kick, Snare, Hi-hat, Toms) ke dalam satu fader master submix bersama untuk kontrol volume terpadu dan pemrosesan efek grup. |
| **Perilaku** | Trek anak dialirkan (*routed*) ke Submix Bus alih-alih langsung ke Master Bus. Mengubah volume atau mematikan (*mute*) Submix Bus mempengaruhi seluruh trek anak secara serempak. |
| **Alur penggunaan** | Klik `+ Track > SubMix Track`, seret track instrumen ke dalam folder Submix atau pilih `Output Bus > Submix 1` pada strip kanal mixer. |
| **Input/output** | In: Multi-channel track streams; Out: Submix audio sum buffer. |
| **Ketergantungan** | Audio engine bus routing graph & topological sorting. |
| **Pemetaan MusikKu** | Empat subgroup bus bawaan studio (`bus_drums`, `bus_vocals`, `bus_music`, `bus_fx`) pada `StudioProjectSchema.buses` dan konsol `src/components/studio/mixer.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Trek yang diarahkan ke Drums Bus tidak langsung masuk ke Master, melainkan melewati fader dan efek insert Drums Bus terlebih dahulu. |
| **Test ID** | `TEST-BUS-ROUTING-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-202` |
| **Bab dan subbab** | Tracks and Types: Send Track & Aux Return Architecture |
| **Halaman sumber** | Hlm. 149 – 163 |
| **Fitur referensi** | Send Tracks & Auxiliary Return Buses |
| **Tujuan** | Berbagi satu instansi efek komputasi berat (seperti reverb aula besar atau delay stereo) di antara banyak track tanpa menduplikasi plugin. |
| **Perilaku** | Setiap track audio/MIDI memiliki knob send yang mengirim sebagian porsi sinyal ke bus Send. Bus Send memproses sinyal secara basah (*100% wet*) dan mengembalikannya ke Master bus. |
| **Alur penggunaan** | Buat Send Track (atau gunakan Aux Reverb/Delay bawaan), putar knob Send pada track instrumen untuk menentukan seberapa banyak gema yang diinginkan. |
| **Input/output** | In: Porsi sinyal track $(0.0 \text{ s.d. } 1.0)$; Out: Sinyal wet efek aux yang dicampur ke master. |
| **Ketergantungan** | Parallel gain send nodes di audio engine. |
| **Pemetaan MusikKu** | Properti `track.sends: Record<string, number>` di `StudioTrackSchema`, dengan bus Aux Reverb dan Aux Delay di `src/lib/studio/audio-engine.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menaikkan knob Aux Reverb pada vokal menghasilkan ekor reverb yang jelas tanpa mengubah level asli vokal kering. |
| **Test ID** | `TEST-AUX-SEND-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-203` |
| **Bab dan subbab** | Audio Signal Flow: 9-Stage Processing Topology |
| **Halaman sumber** | Hlm. 60 – 75 |
| **Fitur referensi** | 3-Point Fader Sends (DRY, PRE, POST) |
| **Tujuan** | Memberikan fleksibilitas perutean profesional: monitoring bebas volume fader, isolasi sidechain, dan efek return seimbang. |
| **Perilaku** | **DRY Send**: Mengambil audio mentah langsung dari klip sebelum channel strip/FX; **PRE Send**: Mengambil audio pasca-FX tetapi sebelum volume fader; **POST Send**: Mengambil audio pasca-volume/pan/mute fader. |
| **Alur penggunaan** | Pilih mode pencabangan send pada pengaturan track send mixer. |
| **Input/output** | In: Sinyal pada tiap tahapan node; Out: Saluran sinyal cabang ke bus tujuan. |
| **Ketergantungan** | Topologi routing node Web Audio API. |
| **Pemetaan MusikKu** | Arsitektur 9-tahap Web Audio graph di `src/lib/studio/audio-engine.ts` dan spesifikasi resmi di `docs/audio-engine.md`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menurunkan fader volume track hingga -Inf dB membungkam POST send namun membiarkan PRE send dan DRY send tetap mengalir normal. |
| **Test ID** | `TEST-SIG-FLOW-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-204` |
| **Bab dan subbab** | Details Tabs: Mixer Channel Strip Sections — Preamp & Dynamics |
| **Halaman sumber** | Hlm. 367 – 372 |
| **Fitur referensi** | Integrated Channel Strip Compressor & Drive Preamp |
| **Tujuan** | Mengontrol dinamika instrumen dan memberikan kehangatan analog (*warmth/saturation*) langsung dari strip mixer. |
| **Perilaku** | Modul Compressor memiliki tombol daya dan knob `Thresh` (threshold); modul Drive memiliki tombol daya dan knob `Drive` untuk saturasi harmonik lembut. |
| **Alur penggunaan** | Nyalakan sakelar daya kompresor/preamp pada strip mixer, putar knob threshold atau drive sesuai kebutuhan. |
| **Input/output** | In: Audio linear; Out: Audio dengan rasio dinamika terkompresi dan saturasi tabung. |
| **Ketergantungan** | DynamicsCompressor & Waveshaper saturation curve. |
| **Pemetaan MusikKu** | Modul kompresor studio dan saturasi harmonik di `src/lib/studio/effects.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menurunkan threshold kompresor ke -30 dB meredam lonjakan transien drum snare sebesar > 6 dB secara transparan. |
| **Test ID** | `TEST-DSP-COMP-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-205` |
| **Bab dan subbab** | Details Tabs: Mixer Channel Strip Sections — 3-Band & Parametric EQ |
| **Halaman sumber** | Hlm. 372 – 376 |
| **Fitur referensi** | 3-Band Equalizer & 4-Band Surgical Parametric EQ |
| **Tujuan** | Penataan frekuensi cepat dengan 3-band EQ dan pembedahan resonansi presisi dengan 4-band Parametric EQ. |
| **Perilaku** | 3-band menyediakan knob Hi, Mid, Lo; 4-band parametrik menyediakan kontrol Gain, Frequency sweep (High: 1.5k–16k, Mid2: 0.5k–7k, Mid1: 0.2k–2.5k, Low: 30–450Hz), serta bandwidth Q. |
| **Alur penggunaan** | Buka modul EQ pada strip kanal, sesuaikan frekuensi dan putar penguatan/pelemahan gain. |
| **Input/output** | In: Audio spektrum penuh; Out: Respon frekuensi terkalibrasi. |
| **Ketergantungan** | BiquadFilterNode cascade filter array. |
| **Pemetaan MusikKu** | Equalizer 3-band dan parametrik presisi di `src/lib/studio/effects.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Pemotongan -12 dB pada Mid 1 di 500 Hz dengan Q=4.0 memunculkan takikan (*notch dip*) terisolasi pada analyser spektrum FFT. |
| **Test ID** | `TEST-DSP-EQ-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIX-206` |
| **Bab dan subbab** | Tracks and Types: Master Track — Master Brickwall Limiter |
| **Halaman sumber** | Hlm. 186 – 190 |
| **Fitur referensi** | Master Brickwall Limiter & Headroom Protection |
| **Tujuan** | Mencegah distorsi digital clipping pada output speaker/headphone saat penjumlahan banyak track menghasilkan puncak level di atas 0 dBFS. |
| **Perilaku** | Membatasi amplitudo puncak master pada threshold batas keras (default -0.3 dBFS) dengan attack instan (< 1 ms) dan rasio pembatasan 20:1. |
| **Alur penggunaan** | Master limiter aktif secara default pada Master Track Header dan dapat diatur batas threshold-nya. |
| **Input/output** | In: Master mix audio; Out: Audio terbatas bebas inter-sample clipping. |
| **Ketergantungan** | Master audio node chain. |
| **Pemetaan MusikKu** | Komponen `src/components/studio/master-track-header.tsx` dan node limiter di `audio-engine.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Output audio gabungan 8 track yang dimainkan bersamaan tidak pernah melampaui level puncak -0.3 dBFS. |
| **Test ID** | `TEST-MASTER-LIM-01` |
