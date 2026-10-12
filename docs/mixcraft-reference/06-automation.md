# Pemetaan Fitur Mixcraft 10: Automation & Controller Mapping

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 12: Automation and Controller Mapping (Hlm. 462 – 495)  
- Bab 5: Clip Automation View & MIDI Learn (Hlm. 27)  
- Bab 21: Hardware Controllers & Control Surfaces (Hlm. 653 – 665)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini membahas sistem kendali parameter dinamis seiring berjalannya waktu (*automation*): garis automasi tingkat klip (*clip automation envelopes*), jalur automasi track (*track automation lanes*), pemetaan parameter plugin efek VST dan instrumen virtual, pengubah garis instan (*instant boost/trim adjuster tool*), automasi perubahan tempo bertahap (*tempo automation*), serta perekaman automasi gerakan fader/knob secara real-time via hardware controller atau fitur *MIDI Learn*.

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-AUT-201` |
| **Bab dan subbab** | Automation and Controller Mapping: Track Automation |
| **Halaman sumber** | Hlm. 471 – 476 |
| **Fitur referensi** | Track Automation Lanes (Volume, Pan, & Parameters) |
| **Tujuan** | Mengubah volume instrumen, panning, atau parameter plugin secara dinamis sepanjang lagu (misal fade-out perlahan di akhir lagu, atau filter sweep pada transisi chorus). |
| **Perilaku** | Mengklik ikon garis bergelombang (*squiggly line icon*) di header track membuka sub-lane automasi tepat di bawah track utama. Pengguna dapat mengklik garis untuk membuat titik (*breakpoints*) dan menyeretnya ke atas/bawah atau kiri/kanan. |
| **Alur penggunaan** | Klik ikon squiggly di header track, pilih parameter yang ingin diautomasi (default `Track Volume`), klik pada garis untuk membuat titik, atur nilainya. |
| **Input/output** | In: Array titik automasi `{ beat: number, value: number, curve: string }`; Out: Penjadwalan parameter `AudioParam.linearRampToValueAtTime`. |
| **Ketergantungan** | Lookahead automation scheduler & SVG lane visualizer. |
| **Pemetaan MusikKu** | Properti `automationLanes: AutomationLane[]` di `StudioTrackSchema` dan renderer garis automasi SVG interaktif di `src/components/studio/timeline.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Selama playback berlangsung, nilai volume track terevaluasi secara mulus mengikuti garis automasi tanpa tangga underrun (*zipper noise*). |
| **Test ID** | `TEST-AUTO-LANE-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-AUT-202` |
| **Bab dan subbab** | Automation and Controller Mapping: Clip Automation |
| **Halaman sumber** | Hlm. 464 – 470 |
| **Fitur referensi** | Clip-Level Automation Envelopes |
| **Tujuan** | Menerapkan kurva automasi yang melekat langsung pada klip tertentu, sehingga ketika klip dipindahkan, dipotong, atau diduplikasi, kurva automasi tetap ikut berpindah bersama klip. |
| **Perilaku** | Garis automasi dirender langsung di atas gelombang klip (waveform/MIDI) pada main clip grid. Klip dapat menampilkan kurva volume, pan, atau pitch envelope mandiri. |
| **Alur penggunaan** | Aktifkan tombol `Clip Automation View` di toolbar atau klik kanan klip > `Automation`. |
| **Input/output** | In: Titik envelope lokal relatif terhadap awal klip; Out: Modulasi gain lokal klip. |
| **Ketergantungan** | Clip domain model & timeline clip visualizer. |
| **Pemetaan MusikKu** | Properti `clip.automationPoints` di `StudioClipSchema` dengan rendering overlay garis pada komponen klip timeline. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Memindahkan klip dari beat 8 ke beat 16 membawa seluruh titik automasi klip ke posisi baru tanpa pergeseran offset. |
| **Test ID** | `TEST-CLIP-AUTO-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-AUT-203` |
| **Bab dan subbab** | Automation and Controller Mapping: Instant Boost / Increase Adjuster |
| **Halaman sumber** | Hlm. 477 – 478 |
| **Fitur referensi** | Instant Boost / Reduce Automation Line Adjuster Tool |
| **Tujuan** | Menaikkan atau menurunkan keseluruhan segmen automasi secara proporsional tanpa harus menggeser titik-titik breakpoint satu per satu. |
| **Perilaku** | Memilih rentang waktu pada garis automasi memunculkan handle penyesuaian instan di bagian atas untuk menaikkan (+dB) atau menurunkan (-dB) seluruh garis terpilih secara bersamaan. |
| **Alur penggunaan** | Seret kursor untuk menyeleksi beberapa titik pada lane automasi, seret handle pengangkat ke atas atau ke bawah. |
| **Input/output** | In: Seleksi multi-titik dan offset delta; Out: Titik-titik automasi bergeser vertikal seimbang. |
| **Ketergantungan** | Automation multi-selection logic. |
| **Pemetaan MusikKu** | Operasi penyesuaian multi-titik terintegrasi di komponen automasi timeline. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menaikkan seleksi 4 titik sebesar +2 dB menggeser seluruh nilai titik sebesar +2 dB tanpa merusak jarak waktu ketukannya. |
| **Test ID** | `TEST-AUTO-BOOST-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-AUT-204` |
| **Bab dan subbab** | Automation and Controller Mapping: Tempo Automation |
| **Halaman sumber** | Hlm. 479 – 480 |
| **Fitur referensi** | Tempo Automation Lane & Accelerando/Ritardando |
| **Tujuan** | Menciptakan perubahan tempo musikal dinamis (percepatan tempo bertahap / *accelerando*, atau perlambatan / *ritardando*). |
| **Perilaku** | Garis automasi khusus Master Track menampilkan kurva BPM. Titik-titik automasi menentukan tempo transisi halus dari tempo awal ke tempo tujuan. |
| **Alur penggunaan** | Buka automation lane pada Master Track, pilih parameter `Tempo (BPM)`, buat kurva percepatan tempo. |
| **Input/output** | In: Titik BPM `{ beat, bpm }`; Out: Modulasi kecepatan playback audio clock. |
| **Ketergantungan** | Transport engine lookahead timing calculator. |
| **Pemetaan MusikKu** | Evaluasi kalkulasi detik audio engine yang memperhitungkan gradien tempo dinamis di `src/lib/studio/audio-engine.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Transisi tempo dari 120 BPM ke 140 BPM selama 4 birama mempercepat denyut metronom secara mulus dan konsisten. |
| **Test ID** | `TEST-TEMPO-AUTO-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-AUT-205` |
| **Bab dan subbab** | Automation and Controller Mapping: MIDI Learn & Controller Assignment |
| **Halaman sumber** | Hlm. 488 – 495, 27 |
| **Fitur referensi** | MIDI Learn Mode & Hardware Controller Mapping |
| **Tujuan** | Menghubungkan knob, slider, atau fader fisik pada MIDI keyboard controller ke kontrol virtual di layar untuk mixing analog yang taktil. |
| **Perilaku** | Menekan tombol `MIDI Learn` membuat seluruh kontrol DAW berkedip ungu/biru; mengklik salah satu kontrol lalu menggerakkan knob fisik pada controller memetakan nomor MIDI CC secara permanen. |
| **Alur penggunaan** | Klik ikon `MIDI Learn` di toolbar atas, klik fader volume track 1, putar knob CC#7 pada MIDI controller, klik selesai. |
| **Input/output** | In: Pesan MIDI CC `[0xB0, ccNumber, value]`; Out: Pembaruan nilai parameter DAW. |
| **Ketergantungan** | Web MIDI API `navigator.requestMIDIAccess` & mapping table. |
| **Pemetaan MusikKu** | Mode MIDI Learn di `transport-bar.tsx` dan listener event MIDI CC di `audio-engine.ts`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Pesan MIDI CC 7 bernilai 127 menaikkan fader volume track ke 100% (unity gain) secara real-time. |
| **Test ID** | `TEST-MIDI-LEARN-01` |
