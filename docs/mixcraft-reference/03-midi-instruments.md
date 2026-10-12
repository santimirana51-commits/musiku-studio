# Pemetaan Fitur Mixcraft 10: MIDI & Virtual Instruments

**Sumber Manual:** `Mixcraft 10 User Guide.pdf`  
- Bab 7: Virtual Instrument / MIDI Track & Header (Hlm. 97 – 123)  
- Bab 9: Details Tabs — Piano Roll, Step Editor, Score Editor (Hlm. 270 – 348)  
- Bab 17: Using Virtual Instruments, Alpha Sampler, Omni Sampler, Acoustica Vocoder (Hlm. 580 – 638)  
- Bab 22: Musical Typing Keyboard (MTK) (Hlm. 666 – 668)

---

## 1. Ikhtisar Bab & Pemetaan

Bab ini merangkum ekosistem produksi MIDI dan sintesis instrumen: pemuatan instrumen VSTi, perutean MIDI kanal 1–16 & Omni, kuantisasi otomatis saat rekaman masuk (*quantize on the way in*), penyelarasan tangga nada (*snap notes to scale*), pengeditan grafis pada Piano Roll, pembuatan beat drum pada Step Editor, penulisan not balok pada Score Editor, instrumen keyboard QWERTY virtual (*Musical Typing Keyboard*), serta instrumen sampling internal.

---

## 2. Tabel Fitur & Subfitur Terperinci

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-101` |
| **Bab dan subbab** | Tracks and Types: Virtual Instrument/MIDI Track — Header & Instrument Quick Access |
| **Halaman sumber** | Hlm. 97 – 102 |
| **Fitur referensi** | Virtual Instrument Track Header & Quick Access Button |
| **Tujuan** | Memberikan pembeda visual yang jelas untuk track MIDI serta akses cepat ke pengaturan synthesizer tanpa membuka dialog berat. |
| **Perilaku** | Dilengkapi ikon tuts keyboard di samping tombol Mute. Memiliki tombol instrumen cepat di samping slot insert efek dengan tombol power bypass dan fitur *Drag to Move* atau *[Alt]+Drag to Copy* instrumen ke track tujuan. |
| **Alur penggunaan** | Klik tombol instrumen untuk membuka editor synth, atau tahan `[Alt]` lalu seret tombol instrumen ke tombol keyboard track lain untuk menyalin seluruh suara dan preset. |
| **Input/output** | In: Drag & drop gesture; Out: Pemindahan atau penduplikasian konfigurasi synth. |
| **Ketergantungan** | Synth engine & project track model. |
| **Pemetaan MusikKu** | Tombol instrumen pada `TrackHeader` dengan dukungan drag & [Alt]+drag copy synth settings, power switch, dan dialog `plugin-dialog.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Tahan Alt + drag instrumen dari track 1 ke track 2 berhasil menduplikasi tipe synthesizer, envelope ADSR, dan cutoff filter tanpa menghapus instrumen di track 1. |
| **Test ID** | `TEST-MIDI-SYNTH-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-102` |
| **Bab dan subbab** | Tracks and Types: Recording MIDI Tracks — Quantization On The Way In |
| **Halaman sumber** | Hlm. 106 – 108 |
| **Fitur referensi** | Automatic Input Quantization |
| **Tujuan** | Merapikan ketepatan waktu permainan keyboard secara otomatis seketika not direkam (*on the way in*). |
| **Perilaku** | Menggeser posisi awal not (*note-on*) ke grid birama terdekat sesuai resolusi yang dipilih: `Off`, `1/4`, `1/8`, `1/16`, `1/32`, `1/8T`, `1/16T`. |
| **Alur penggunaan** | Buka menu masukan MIDI (panah arm track), pilih `Automatic Quantization`, tentukan resolusi, lalu rekam. |
| **Input/output** | In: Waktu penekanan not riil; Out: Posisi beat terkuantisasi presisi grid. |
| **Ketergantungan** | Lookahead scheduler & snap calculator. |
| **Pemetaan MusikKu** | Properti `quantizeOnRecord` pada `StudioTrackSchema`, dievaluasi saat memproses buffer event rekaman MIDI. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Not yang dimainkan pada beat 1.04 dengan kuantisasi 1/4 note otomatis dirapatkan tepat ke beat 1.00. |
| **Test ID** | `TEST-MIDI-QUANT-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-103` |
| **Bab dan subbab** | Tracks and Types: Recording MIDI Tracks — Snap Notes To Scale |
| **Halaman sumber** | Hlm. 108 – 109 |
| **Fitur referensi** | Snap Notes To Scale Assist |
| **Tujuan** | Mencegah musisi menekan nada sumbang (*wrong notes*) dengan menyelaraskan not yang masuk ke tangga nada proyek. |
| **Perilaku** | Mengoreksi tinggi nada (*pitch*) ke not terdekat yang valid dalam tangga nada aktif (Mayor, Minor, Pentatonis, Blues, dll.). |
| **Alur penggunaan** | Aktifkan opsi `Snap Notes To Scale` pada menu Arm instrumen virtual. |
| **Input/output** | In: Not MIDI fisik (0–127); Out: Not pitch terkalibrasi tangga nada. |
| **Ketergantungan** | Music theory scale maps (`src/lib/studio/synth.ts`). |
| **Pemetaan MusikKu** | Opsi `snapToScale` di `TrackHeader` disinkronkan dengan key signature proyek di transport bar. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Dalam kunci C Mayor, jika pengguna menekan not C# (D-flat), pitch otomatis dialihkan ke C atau D. |
| **Test ID** | `TEST-SCALE-SNAP-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-104` |
| **Bab dan subbab** | Details Tabs: Piano Roll — Editing Operations & Velocity Stalks |
| **Halaman sumber** | Hlm. 270 – 295 |
| **Fitur referensi** | Piano Roll Graphical Note Editor |
| **Tujuan** | Memungkinkan penyuntingan visual nada MIDI: menggambar not, mengubah durasi, transposisi, dan mengatur dinamika velocity. |
| **Perilaku** | Menampilkan kisi tuts vertikal (C1–B7) dan timeline horizontal. Setiap balok not dapat digeser, dipanjangkan tepinya, dan diatur batangnya (*velocity stalk*) dari 1 hingga 127. |
| **Alur penggunaan** | Dobel-klik klip MIDI di timeline untuk membuka Piano Roll di panel bawah. Gunakan alat pensil untuk menambahkan not atau klik-tarik batang velocity. |
| **Input/output** | In: Interaksi kursor mouse/touch; Out: Array `MidiNoteEvent: { pitch, startBeat, durationBeats, velocity }`. |
| **Ketergantungan** | Komponen `PianoRoll` & skema data klip `StudioClip.midiEvents`. |
| **Pemetaan MusikKu** | Komponen `src/components/studio/piano-roll.tsx` dengan zoom horizontal/vertikal dan rendering velocity SVG. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Perubahan posisi not pada Piano Roll secara instan memperbarui model proyek dan terdengar saat diputar. |
| **Test ID** | `TEST-PIANO-ROLL-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-105` |
| **Bab dan subbab** | Details Tabs: Step Editor — Step Sequencer View & Voice List |
| **Halaman sumber** | Hlm. 304 – 325 |
| **Fitur referensi** | Step Sequencer Drum Pattern Editor |
| **Tujuan** | Membangun pola ritme drum dan perkusi secara cepat berbasis kisi ketukan bergaya drum machine klasik. |
| **Perilaku** | Menampilkan daftar suara instrumen drum (*Voice List*) secara vertikal dan sel langkah 16 atau 32 step secara horizontal dengan kontrol aksen (*accent*), swing, dan tempo sync. |
| **Alur penggunaan** | Buka tab Step Editor, klik sel langkah untuk mengaktifkan ketukan, atur slider swing, lalu simpan sebagai preset pola. |
| **Input/output** | In: Klik sel langkah; Out: Trigger event perkusi pada grid birama. |
| **Ketergantungan** | Modul `step-sequencer.ts` & procedural drum synth. |
| **Pemetaan MusikKu** | Komponen `src/components/studio/step-sequencer.tsx` dengan dukungan penyimpanan pola ke IndexedDB. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Pola drum 16-step berhasil memainkan Kick, Snare, dan Hi-hat dengan sinkronisasi tempo presisi lookahead scheduler. |
| **Test ID** | `TEST-STEP-SEQ-01` |

| Field | Isi |
|---|---|
| **Feature ID** | `MC10-MIDI-106` |
| **Bab dan subbab** | Musical Typing Keyboard (MTK) |
| **Halaman sumber** | Hlm. 666 – 668 |
| **Fitur referensi** | Musical Typing Keyboard (QWERTY Keyboard Input) |
| **Tujuan** | Memberikan fasilitas kepada musisi tanpa hardware MIDI controller untuk memainkan dan merekam instrumen virtual menggunakan tuts keyboard komputer biasa. |
| **Perilaku** | Baris huruf QWERTY komputer dipetakan ke 2 oktaf tuts piano (huruf A=C, W=C#, S=D, E=D#, D=E, dst.), dilengkapi tombol pengatur oktaf (Z/X), transposisi, dan velocity level. |
| **Alur penggunaan** | Tekan tombol keyboard pada toolbar transport atau shortcut `[Ctrl]+Alt+K` untuk memunculkan MTK. Tekan tuts keyboard untuk memainkan nada. |
| **Input/output** | In: Event keyboard DOM `keydown` / `keyup`; Out: Pesan MIDI Note On / Note Off. |
| **Ketergantungan** | Window keydown event listeners & PolySynth dispatcher. |
| **Pemetaan MusikKu** | Opsi perangkat masukan `Musical Typing Keyboard (MTK / QWERTY)` pada menu Arm MIDI dan keyboard dispatcher di `page.tsx`. |
| **Platform** | Web, Android, Windows |
| **Status verifikasi** | Verified |
| **Status implementasi** | Tested |
| **Kriteria penerimaan** | Menekan tuts `A` pada keyboard memicu not C4 dengan durasi sesuai waktu penahanan tombol. |
| **Test ID** | `TEST-MTK-01` |
