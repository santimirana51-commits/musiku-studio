# MusikKu Universal Music Controller (Ekstensi Chrome MV3)

Satu popup untuk: **player lokal ekstensi**, **tab MusikKu**, dan **tab media
lain** — dengan kapabilitas jujur per sumber (tanpa klaim palsu).

## Arsitektur

```
extension/
  manifest.json            # MV3, izin minimum (lihat tabel di bawah)
  src/
    shared/                # media-types, arbitration, eq, capture (murni, teruji)
    background/            # service-worker (wiring), registry, musiku-sync
    content/musiku-media.ts# injeksi on-demand ke tab MusikKu berizin
    offscreen/             # player lokal: IDB + audio + EQ + Media Session
    popup/                 # UI: sumber, transport, pustaka, EQ, akun
  scripts/build.sh         # tsc -> dist/ siap Load unpacked
```

- Tanpa bundler: TypeScript dikompilasi ke ES modules (`type: module` di SW
  dan `<script type="module">` di pages). Import relatif memakai sufiks `.js`.
- Direktori mandiri untuk paket Web Store (nilai EQ disalin dari web dengan
  catatan sinkron manual di `shared/eq.ts`).

## Izin & tujuan

| Izin | Untuk apa | Minimum? |
|---|---|---|
| `tabs` | Deteksi tab audible + judul/URL tab media + mute fallback | Ya |
| `storage` | Sesi Supabase + preferensi EQ (lokal, tak keluar perangkat) | Ya |
| `scripting` | Injeksi on-demand ke tab yang dipilih user (kontrol media dasar) | Ya |
| `offscreen` | Dokumen audio background MV3 (player lokal + EQ + Media Session) | Ya |
| `optional_host_permissions` localhost | Kontrol tab MusikKu lokal, diminta eksplisit via tombol | Opsional |

Tanpa `<all_urls>`, tanpa content script default, tanpa baca cookie/history.
`tabCapture` dipakai hanya bila tersedia (cek eksplisit, eksperimental).

## Batasan jujur

- Tab generik tanpa izin host: **hanya mute + buka tab** ("Kontrol terbatas").
- Tab MusikKu berizin: play/pause/seek bila ada elemen media; next/prev/EQ
  dinonaktifkan (antrean halaman tak diketahui; audio cross-origin).
- EQ hanya untuk audio lokal ekstensi. Capture tab: dicek on-demand,
  **kompatibilitas nyata belum diuji** — jangan diklaim ke pengguna.
- Tanpa bypass DRM/proteksi; hormati kebijakan situs & aturan Web Store.

## Auth Supabase

Popup → Akun: URL + anon key (publik) + email + password. Password hanya
dipakai sekali saat login (tidak disimpan); sesi (JWT + refresh) di
`chrome.storage.local`; 401 → refresh sekali → gagal = logout + pesan
"Kedaluarsa, login ulang". Service-role key dilarang masuk ekstensi.
Hitungan playlist/favorit baca-saja via REST + `Prefer: count=exact`.

## Instalasi developer

```bash
npm run build:extension   # -> extension/dist
# chrome://extensions -> Developer mode -> Load unpacked -> extension/dist
```

Untuk kontrol tab MusikKu lokal: buka popup → pilih tab localhost → setujui
permintaan host opsional saat diminta.

## Publikasi Web Store

1. Buat PNG 16/48/128 dari `assets/icon.svg`, daftarkan di manifest.
2. `npm run build:extension` lalu zip isi `dist/`.
3. Isi justifikasi izin (tabel di atas) + kebijakan privasi: tanpa analytics,
   tanpa server pihak ketiga kecuali Supabase milik pengguna sendiri.

## Uji

`npm test` mencakup ekstensi (arbitrasi, registry, sync/auth, capture-gating,
EQ, IDB store). Klaim kompatibilitas situs/EQ di luar itu tidak dibuat.
