# Storage & Sync — MusikKu

> Fase 3. Cakupan: library cloud (Supabase privat), penyimpanan lokal per platform, dan sync engine metadata lintas perangkat.

## 1. Penyimpanan: tiga lapis yang tidak dicampur

| Lapis | Isi | Lokasi Web aktual | Prinsip |
|---|---|---|---|
| Lokal perangkat | Blob audio + metadata impor | IndexedDB `musikku/tracks` | Tidak diunggah otomatis; hapus data situs = hilang (tanpa backup) |
| Cloud privat | File + metadata milik user | Bucket `music-files` (`<user_id>/…`) + tabel `music_library` | Hanya signed URL berumur pendek; tanpa URL publik |
| Sync metadata | Operasi antre (bukan blob) | `localStorage musikku:sync-queue` (maks 200) | Blob tidak pernah masuk payload sync |

Jangan memindahkan semua file musik ke cloud hanya untuk menyamakan perilaku antarplatform (§B misi).

## 2. Cloud library (aktual)

Alur upload 2 tahap (dipertahankan Fase 3):
1. `GET /api/library/upload-url?filename&mime&size` → validasi server → signed upload URL user-scoped.
2. Client `PUT` (progress + retry dengan URL baru) → `POST /api/library` mencatat metadata setelah server verifikasi objek ada + path milik user.

Baru di Fase 3:
- Migrasi `supabase/migrations/0004_music_upload_state.sql`: `upload_status (pending/uploading/ready/failed)`, `upload_error`, `updated_at` + trigger + indeks `(user_id, updated_at desc)`. Terapkan via `npx supabase db push` (atau SQL Editor) bersama 0001–0003.
- `POST /api/library` idempoten: konflik path unik (23505) → kembalikan baris ada + `{ deduped: true }` (200), bukan duplikat. Aman untuk retry sync queue.
- `GET /api/library/[id]/download` → signed URL + `Content-Disposition: attachment` (nama aman dari judul) untuk **offline playback yang diizinkan**. TTL 5 menit, milik sendiri saja.
- `GET /api/library` & `PATCH /api/library/[id]` kini mengembalikan `upload_status, upload_error, updated_at` (aditif, kompatibel).

Batas: `MUSIC_MAX_FILE_MB` (default 50, maks 500 — DDL). Kuota = jumlah `file_size` milik user.

## 3. Sync engine (`src/lib/sync/`)

### 3.1 Yang disinkronkan
Playlist, favorit, **metadata** cloud, preferensi, riwayat (bila `history_enabled`). Versi per tabel:

| Tabel | Kolom versi | Catatan konflik |
|---|---|---|
| playlists, user_preferences, karaoke_lyrics, music_library | `updated_at` | LWW penuh |
| favorites, playback_history | `created_at`/`played_at` | Append-only, praktis tanpa konflik tulis |
| playlist_items | `(position, added_at)` | Reorder = operasi `PATCH order` atomik, bukan per-baris |

### 3.2 Antrean offline (`queue.ts`)
- Persisten (localStorage; injeksi `SyncStorage` untuk test/native nanti). Coalesce upsert sebaris (payload terbaru, `baseUpdatedAt` pertama dipertahankan agar konflik terdeteksi). Delete tidak digabung dengan upsert.

### 3.3 Retry (`retry.ts`)
- Backoff `1s·2^attempt` (cap 5 mnt, jitter 20%), maks 10 percobaan.
- Retry: jaringan/`429`/`5xx`. Fatal (drop + catat): `400/403/404/422`. `401` → **jeda**, antrean utuh hingga login ulang.

### 3.4 Idempotency
- Setiap operasi membawa `key` (uuid client) → header `Idempotency-Key` di `SyncEngine.sender`. Server: `POST /api/library` memanfaatkan keunikan `storage_path`. Endpoint lain: kunci diteruskan hari ini, penegakan tabel idempotency server dijadwalkan bila diperlukan (tercatat sebagai utang, bukan klaim).

### 3.5 Konflik (`conflict.ts`) — aturan resmi
1. **Last-write-wins** per timestamp; sama persis → server menang (stabil).
2. **Hapus-vs-ubah → manual**: tampilkan pilihan "pulihkan / hapus juga di cloud". Engine tidak pernah auto-hapus cloud.
3. Timestamp tak valid → manual (jangan menebak).
4. Hapus lokal vs hapus cloud operasi terpisah, kecuali pengguna memilih keduanya.

### 3.6 Sesi & akun
- `401` beruntun → berhenti, lanjut setelah login. **Logout/pindah akun → `clearSyncQueue()`** (antrean milik akun lama tidak boleh terkirim ke akun baru). Kedaluwarsa sesi saat kirim → jeda + refresh sesi Supabase lalu `syncAll()` ulang.

## 4. Verifikasi & Integrasi UI (Fase 3 & 6)
- `typecheck` bersih (0 error), `lint` 0 warning/error.
- `test`: **25 files / 128 tests** (termasuk 17 unit test khusus sync: retry, queue, conflict, engine).
- **Integrasi UI Aktif:**
  - Sidebar ([src/components/nav.tsx](file:///home/miran/projec/musiku/src/components/nav.tsx)): Menampilkan status real-time antrean (`useSyncEngine`) dengan indikator warna (*hijau/tersinkron, ungu berkedip/menyinkronkan, kuning/dijeda, merah/gagal*).
  - Pengaturan ([src/app/settings/page.tsx](file:///home/miran/projec/musiku/src/app/settings/page.tsx)): Tombol "Sync now", deteksi jeda/error, dan pemanggilan `clearSyncQueue()` saat logout untuk mencegah kebocoran antrean antar akun.
- Migrasi 0004: `0004_music_upload_state.sql` siap di-push ke proyek Supabase (`upload_status`, `upload_error`, `updated_at`).
- Endpoint download offline: `/api/library/[id]/download` siap digunakan untuk unduh audio legal milik sendiri.

## 5. Catatan Kepatuhan
- Penegakan header `Idempotency-Key` diteruskan dari antrean client ke server route.
- Penghapusan data lokal dan data cloud tetap menjadi operasi terpisah demi keamanan data pengguna (§G).
- Blob file musik lokal **tidak pernah** diunggah otomatis saat sinkronisasi metadata berjalan.
