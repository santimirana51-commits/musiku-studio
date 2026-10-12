# Referensi API MusikKu

Basis: sama dengan `NEXT_PUBLIC_APP_URL`. Error selalu `{ "error": "..." }`
berbahasa Indonesia. Rate limit per IP bila disebut.

## YouTube (publik, tanpa login)

| Endpoint | Metode | Keterangan |
|---|---|---|
| `/api/search?q&maxResults&pageToken` | GET | Pencarian resmi (kategori musik, hanya embeddable). 400 query invalid, 503 key belum set, 429 kuota habis / rate limit 30/mnt. Cache 60 dtk (`X-Cache: HIT`). |
| `/api/videos/[id]` | GET | Detail + cek embeddable/privasi. 400 id invalid, 404 tak ada/privat, 451 embedding dimatikan. Rate limit 60/mnt. |

## Musik (wajib login, data milik sendiri)

| Endpoint | Keterangan |
|---|---|
| `GET/POST /api/playlists` | Daftar + buat (rate limit 20/mnt saat buat). |
| `GET/PATCH/DELETE /api/playlists/[id]` | Baca (milik sendiri) / ubah / hapus. ID lain → 404 (anti-IDOR). |
| `POST /api/playlists/[id]/items` | Tambah item (posisi otomatis). |
| `PATCH /api/playlists/[id]/items` | Reorder `{ order: [itemId...] }` maks 200. |
| `DELETE /api/playlists/[id]/items/[itemId]` | Hapus item (terikat playlist). |
| `GET/POST /api/favorites` | Daftar (maks 100) + upsert per video. |
| `DELETE /api/favorites/[id]` | `:id` = UUID baris ATAU videoId (divalidasi). |
| `GET/POST/DELETE /api/history` | Riwayat cloud (hormati `history_enabled`). Anonim POST → `{ok, anonymous}` tanpa simpan. |
| `DELETE /api/history/[id]` | Hapus satu entri. |

## Karaoke lirik (GET publik/anon; tulis wajib login)

| Endpoint | Keterangan |
|---|---|
| `GET /api/karaoke/lyrics?videoId=` | Lirik untuk 1 video (public + milik sendiri). |
| `GET /api/karaoke/lyrics?videoIds=` | Ringkas `{ availability: { id: {count, languages} } }` untuk badge. |
| `POST /api/karaoke/lyrics` | Upsert milik sendiri. Wajib LRC valid + `rights_confirmed: true`. Rate limit 20/mnt. |
| `DELETE /api/karaoke/lyrics/[id]` | Hapus milik sendiri. |

## Pustaka cloud (wajib login)

| Endpoint | Keterangan |
|---|---|
| `GET /api/library` | Baris milik sendiri + `usedBytes`. |
| `GET /api/library/upload-url?filename&mime&size` | Validasi server → signed **upload** URL (PUT via XHR, progress + retry). |
| `POST /api/library` | Catat metadata setelah upload (verifikasi objek ada + path milik user). |
| `GET /api/library/[id]/url` | Signed **download** URL 5 menit (bucket privat). |
| `PATCH /api/library/[id]` | Ubah title/artist/album. |
| `DELETE /api/library/[id]` | Hapus objek + baris konsisten. |

Batas: `MUSIC_MAX_FILE_MB` (default 50). Format: mp3/wav/ogg/flac/m4a/aac
(validasi ganda client + server).

## Admin (login + admin)

| Endpoint | Keterangan |
|---|---|
| `GET /api/admin/stats` | Agregat count + 10 playlist terbaru. Otorisasi ganda: allowlist `ADMIN_EMAILS` ATAU `profiles.role='admin'`. Tanpa secret. |
