# Pemetaan Fitur Mixcraft 10: Editing & Arrangement

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 8: Clips and the Main Clip Grid (Hlm. 203 – 243)  
- Bab 9: Sound Editor — Audio Warping & Transient Detection (Hlm. 349 – 358)  
- Bab 15: Markers (Hlm. 521 – 529)  
- Bab 5: Main Clip Grid & Snap Settings (Hlm. 28 – 33)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas inti manipulasi dan penyuntingan materi audio serta MIDI di timeline: pemilihan dan pemindahan klip, pemotongan (*split*) dengan gunting atau tombol `B`, pemangkasan tepi (*trimming*), penggabungan klip (*merging*), pengaturan gain individual per klip, pemudaran (*fade-in / fade-out*), pembentangan waktu dan transposisi nada (*time stretching & pitch shifting*), serta penempatan penanda struktur lagu (*markers*).

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ARR-101` |
| **Bab dan subbab** | Clips and the Main Clip Grid: Common Operations — Splitting Clips |
| **Halaman sumber** | Hlm. 208 – 209 |
| **Fitur referensi** | Split Clips At Playhead / Caret ([B] Shortcut & Scissors Tool) |
| **Tujuan** | Memotong klip audio atau MIDI menjadi beberapa bagian untuk aransemen, pembuangan bagian yang tidak diinginkan, atau pemindahan segmen. |
| **Perilaku** | Menekan tombol `B` atau mengklik ikon gunting (*scissors*) saat klip dipilih membelah klip tepat pada posisi playhead/caret menjadi dua klip terpisah tanpa mengubah data audio fisik (*non-destructive split*). |
| **Alur penggunaan** | Pilih klip di timeline, letakkan playhead atau klik caret pada posisi pemotongan, tekan tombol `B` pada keyboard. |
| **Input/output** | In: 1 klip dengan startBeat $S$ dan duration $D$; Out: Klip A $(S, D_1)$ dan Klip B $(S + D_1, D - D_1)$ dengan offset source terhitung presisi. |
| **Ketergantungan** | Timeline arranger engine. |
| **Pemetaan MusikKu** | Fungsi `handleSplitClipAtPlayhead` di `page.tsx` dan tombol gunting di toolbar transport serta pintasan keyboard `B`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Klip vokal 16 birama dipotong di birama 8 menghasilkan dua klip 8 birama yang bersambung sempurna tanpa jeda audio (*gapless playback*). |
| **Test ID** | `TEST-CLIP-SPLIT-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ARR-102` |
| **Bab dan subbab** | Clips and the Main Clip Grid: Common Operations — Trimming & Resizing |
| **Halaman sumber** | Hlm. 206 – 208 |
| **Fitur referensi** | Non-Destructive Clip Edge Trimming |
| **Tujuan** | Menyesuaikan titik awal dan titik akhir pemutaran klip tanpa menghapus berkas audio asli dari penyimpanan. |
| **Perilaku** | Mengarahkan kursor ke tepi kiri atau kanan klip menampilkan kursor panah horizontal ganda. Menyeret tepi mengubah durasi aktif dan offset pemutaran. |
| **Alur penggunaan** | Klik dan seret tepi kiri klip untuk mengubah titik mulai, atau seret tepi kanan klip untuk memperpendek/memperpanjang durasi. |
| **Input/output** | In: Drag delta beat; Out: Pembaruan `clip.offsetBeat` dan `clip.durationBeats`. |
| **Ketergantungan** | Timeline mouse/touch event listeners. |
| **Pemetaan MusikKu** | Resize handles di tepi kiri/kanan setiap komponen klip pada `src/components/studio/timeline.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menyeret tepi kiri klip audio ke kanan sejauh 2 beat menaikkan offsetBeat sebesar 2 dan mengurangi durasi sebesar 2 beat secara konsisten. |
| **Test ID** | `TEST-CLIP-TRIM-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ARR-103` |
| **Bab dan subbab** | Clips and the Main Clip Grid: Audio Clips — Fading & Crossfading |
| **Halaman sumber** | Hlm. 210 – 212 |
| **Fitur referensi** | Automatic Crossfading & Fade In / Fade Out Curves |
| **Tujuan** | Menghilangkan bunyi letupan (*clicks & pops*) di tepi klip dan memadukan dua klip yang saling bertumpukan secara mulus. |
| **Perilaku** | Menyeret klip hingga bertumpang-tindih (*overlap*) dengan klip lain pada track yang sama secara otomatis menciptakan transisi silang (*crossfade*). Klip individual memiliki pegangan kurva fade-in dan fade-out. |
| **Alur penggunaan** | Geser klip audio melintasi tepi klip sebelahnya, sistem secara otomatis merender kurva crossfade pada area tumpang tindih. |
| **Input/output** | In: Rentang overlap beats; Out: Kurva gain eksponensial/linear pada playback engine. |
| **Ketergantungan** | Audio playback scheduler & gain interpolation. |
| **Pemetaan MusikKu** | Properti `fadeInBeats` dan `fadeOutBeats` pada `StudioClipSchema`, dievaluasi dengan linear/equal-power ramp pada Web Audio gain nodes. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Dua klip audio yang bertumpukan diputar tanpa distorsi clipping atau letupan phase transien. |
| **Test ID** | `TEST-CLIP-FADE-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ARR-104` |
| **Bab dan subbab** | Clips and the Main Clip Grid: Audio Clips — Clip Gain |
| **Halaman sumber** | Hlm. 218 – 220 |
| **Fitur referensi** | Clip-Level Gain Adjustment |
| **Tujuan** | Menyeimbangkan volume klip tertentu (misal satu frasa vokal yang terlalu pelan) tanpa perlu mengubah fader volume keseluruhan track. |
| **Perilaku** | Setiap klip memiliki pengatur penguatan (*gain slider / envelope*) tersendiri dengan rentang 0% hingga 200% (+6 dB). |
| **Alur penggunaan** | Dobel klik klip untuk membuka tab properti klip atau atur slider gain klip pada header klip di timeline. |
| **Input/output** | In: Nilai gain (0.0 s.d. 2.0); Out: Penguatan amplitudo buffer sumber. |
| **Ketergantungan** | `StudioClipSchema.gain`. |
| **Pemetaan MusikKu** | Properti `clip.gain` pada model data dan node penguatan di Web Audio buffer source. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Klip dengan gain 0.5 menghasilkan level output setengah amplitudo (-6 dB) saat diuji pada analyser node. |
| **Test ID** | `TEST-CLIP-GAIN-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-ARR-105` |
| **Bab dan subbab** | Markers |
| **Halaman sumber** | Hlm. 521 – 529 |
| **Fitur referensi** | Timeline Markers (Time, Tempo, Key, Section) |
| **Tujuan** | Menandai struktur lagu (Intro, Verse, Chorus, Bridge, Outro) serta menentukan perubahan tempo atau birama di tengah lagu. |
| **Perilaku** | Penanda visual berupa bendera warna di timeline ruler yang dapat dinamai, digeser, dan dijadikan acuan navigasi instan. |
| **Alur penggunaan** | Klik kanan pada timeline ruler, pilih `Add Marker...`, tentukan nama section dan warna marker. |
| **Input/output** | In: Beat position, label string, color; Out: Bendera penanda di timeline ruler. |
| **Ketergantungan** | Timeline ruler renderer & project markers array. |
| **Pemetaan MusikKu** | Properti `markers: StudioMarker[]` di `StudioProjectSchema` dan interaksi klik kanan ruler di `src/components/studio/timeline.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Mengklik marker melompatkan playhead tepat ke posisi ketukan awal marker yang bersangkutan. |
| **Test ID** | `TEST-MARKERS-01` |
