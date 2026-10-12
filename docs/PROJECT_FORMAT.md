# Format Berkas Proyek MusikKu Studio (`.musiku`)

Dokumen ini mendefinisikan spesifikasi format berkas serialisasi proyek **MusikKu Studio DAW**, skema validasi Zod, strategi migrasi versi, penanganan referensi aset biner (*missing assets relinking*), serta mekanisme pemulihan darurat (*autosave & disaster recovery*).

---

## 1. Filosofi & Format Standar

Berkas proyek MusikKu Studio disimpan dalam format berbasis JSON terstruktur dengan ekstensi `.musiku` (MIME type: `application/json` atau `application/x-musikku-project`).

### Prinsip Utama:
1. **Pengeditan Non-Destruktif (*Non-Destructive Editing*)**:
   - Berkas audio mentah pengguna tidak pernah ditimpa atau diubah fisiknya. Klip di timeline hanya mereferensikan aset biner dengan penanda titik mulai (`offsetBeat`), durasi potong (`durationBeats`), penguatan (`gain`), dan kurva pemudaran (`fade`).
2. **Pemisahan Data Proyek vs Aset Biner Berukuran Besar**:
   - Berkas `.musiku` **TIDAK MENYIMPAN** sampel audio berukuran puluhan megabyte sebagai string Base64 di dalam JSON.
   - Aset audio biner disimpan secara terpisah di IndexedDB lokal (`audio_blobs` store) atau Supabase Object Storage, dan direferensikan di dalam proyek melalui UUID stabil `assetId`.
3. **Kompatibilitas Lintas-Platform**:
   - Proyek dapat diekspor dari browser Web dan dibuka kembali di desktop Windows atau Android tanpa kerusakan path berkas lokal.

---

## 2. Struktur Skema JSON Proyek

```json
{
  "version": 2,
  "id": "proj_a1b2c3d4_e5f6",
  "name": "Mahakarya Nusantara",
  "tempo": 128,
  "timeSignature": [4, 4],
  "sampleRate": 48000,
  "keySignature": "D minor",
  "createdAt": "2026-10-12T08:00:00.000Z",
  "updatedAt": "2026-10-12T09:30:00.000Z",
  "masterTrack": {
    "volume": 1.0,
    "pan": 0.0,
    "limiterThreshold": -0.3,
    "limiterRelease": 0.05,
    "plugins": [
      {
        "id": "plug_master_eq",
        "pluginId": "internal.eq",
        "name": "Master Bus EQ",
        "enabled": true,
        "parameters": { "lowGain": 0.0, "midGain": -1.0, "highGain": 1.5 }
      }
    ]
  },
  "buses": [
    {
      "id": "bus_drums",
      "name": "Drums Bus",
      "color": "#ef4444",
      "volume": 0.9,
      "pan": 0.0,
      "mute": false,
      "solo": false,
      "plugins": []
    },
    {
      "id": "bus_vocals",
      "name": "Vocal Bus",
      "color": "#3b82f6",
      "volume": 1.0,
      "pan": 0.0,
      "mute": false,
      "solo": false,
      "plugins": []
    }
  ],
  "tracks": [
    {
      "id": "trk_vocal_lead",
      "type": "audio",
      "name": "Lead Vocal",
      "color": "#38bdf8",
      "height": 96,
      "volume": 1.1,
      "pan": 0.0,
      "mute": false,
      "solo": false,
      "isFrozen": false,
      "outputBus": "bus_vocals",
      "inputChannelMode": "mono-left",
      "recordingMode": "takes",
      "laneCount": 3,
      "mutedLaneIndices": [0],
      "sends": { "reverb": 0.25, "delay": 0.15 },
      "plugins": [
        {
          "id": "plug_comp_1",
          "pluginId": "internal.compressor",
          "name": "TB Vocal Compressor",
          "enabled": true,
          "parameters": { "threshold": -18.0, "ratio": 4.0, "attack": 0.015, "release": 0.12 }
        }
      ],
      "automationLanes": [
        {
          "id": "auto_lane_vol",
          "parameter": "volume",
          "color": "#38bdf8",
          "points": [
            { "beat": 0, "value": 1.0, "curve": "linear" },
            { "beat": 64, "value": 1.2, "curve": "linear" }
          ]
        }
      ],
      "clips": [
        {
          "id": "clip_take_2",
          "trackId": "trk_vocal_lead",
          "name": "Vocal Chorus Take 2",
          "type": "audio",
          "color": "#38bdf8",
          "startBeat": 16.0,
          "durationBeats": 32.0,
          "offsetBeat": 0.0,
          "gain": 1.0,
          "assetId": "asset_wav_lead_take_2",
          "laneIndex": 1,
          "muted": false
        }
      ]
    }
  ],
  "markers": [
    { "id": "m1", "beat": 0.0, "label": "Intro", "color": "#10b981" },
    { "id": "m2", "beat": 16.0, "label": "Chorus 1", "color": "#3b82f6" }
  ],
  "assets": [
    {
      "id": "asset_wav_lead_take_2",
      "name": "vocal_chorus_take_2.wav",
      "mimeType": "audio/wav",
      "sizeBytes": 12582912,
      "durationSeconds": 15.0,
      "sampleRate": 48000,
      "channels": 1
    }
  ]
}
```

---

## 3. Strategi Migrasi Skema Versi Proyek

Sistem serialisasi di `src/lib/studio/schema.ts` menyertakan fungsi migrasi otomatis:
1. **Versi 1 (Legacy Projects)**:
   - Tidak memiliki field `buses`, `outputBus`, `laneCount`, atau `height`.
   - Parser otomatis menyuntikkan 4 default subgroup bus (`Drums Bus`, `Vocal Bus`, `Music Bus`, `FX Submix`), menyetel `outputBus: "master"`, dan menambahkan tinggi track default 96 px.
2. **Versi 2 (Mixcraft 10 Specification)**:
   - Mendukung 8 tipe track, multi-lane takes, 3-point sends, dan video preview sync.
   - Seluruh properti tervalidasi via Zod `safeParse`. Jika terdapat tipe data salah, parser memberikan pesan kesalahan deskriptif tanpa menghentikan aplikasi secara fatal.

---

## 4. Penanganan Referensi Aset Hilang (*Missing Assets Relinking*)

Ketika berkas proyek `.musiku` dibuka di komputer yang berbeda:
1. Engine memeriksa apakah setiap `assetId` pada array `project.assets` tersedia di IndexedDB lokal.
2. Jika ada aset yang tidak ditemukan, DAW membuka dialog **Missing Sound Files**:
   - Menampilkan nama berkas asli, durasi terduga, dan ukuran byte.
   - Memberikan opsi:
     - **Relink File...**: Pengguna memilih berkas pengganti dari disk lokal.
     - **Keep Offline / Silence**: Membiarkan klip tetap ada di timeline sebagai placeholder hening tanpa menghapus data aransemen.
     - **Download from Cloud**: Mengunduh aset secara otomatis dari Supabase Object Storage jika proyek tersambung ke akun cloud.

---

## 5. Sistem Autosave & Pemulihan Darurat (*Disaster Recovery*)

- **Autosave Rutin**: Engine secara berkala menyimpan snapshot proyek aktif ke IndexedDB setiap kali ada perubahan signifikan (debounce 3 detik).
- **Crash Recovery**: Jika sesi peramban tertutup tiba-tiba, saat membuka kembali MusikKu Studio, sistem mendeteksi snapshot autosave yang lebih baru daripada berkas tersimpan dan menawarkan dialog pemulihan instan (*"Restore unsaved project?"*).
