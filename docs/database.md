# Database & Storage MusikKu

Terapkan berurutan (CLI `npx supabase db push` atau SQL Editor):

1. `0001_init.sql` — profiles, playlists, playlist_items, favorites,
   playback_history, user_preferences + trigger profil otomatis.
2. `0002_karaoke_lyrics.sql` — lirik LRC per video per bahasa per user.
3. `0003_music_library.sql` — metadata musik cloud + bucket privat + policy.
4. `0004_music_upload_state.sql` — `music_library.upload_status/upload_error/updated_at` + trigger + indeks sync (lihat `docs/storage-and-sync.md`).

## Tabel inti

| Tabel | Kepemilikan | Akses publik |
|---|---|---|
| `profiles` (id, display_name, avatar_url, role) | Pemilik baca+tulis (kecuali role) | — |
| `playlists` (+`playlist_items`) | Pemilik penuh | Baca bila `is_public` (+ itemnya) |
| `favorites` (unique user+video) | Pemilik saja | — |
| `playback_history` | Pemilik saja | — |
| `user_preferences` (theme, history_enabled) | Pemilik saja | — |
| `karaoke_lyrics` (unique user+video+lang) | Pemilik penuh | Baca bila `visibility='public'` |
| `music_library` (path unique) | Pemilik penuh | — |

Semua tabel: RLS aktif. Jadikan admin via SQL service-role:
`update public.profiles set role='admin' where id='<uuid>';`
atau isi `ADMIN_EMAILS` (tanpa SQL).

## Storage

- Bucket **`music-files`**, privat (`public=false`). Path wajib
  `<user_id>/...`; policy insert/select/update/delete mengikat
  `auth.uid() = foldername(name)[1]`.
- Aplikasi hanya memakai **signed URL** berumur pendek (putar 5 mnt).
  Tidak ada URL publik.
- Tanpa service-role pun alur jalan (JWT user + RLS).

## Lokal (bukan Supabase)

- IndexedDB `musikku` / store `tracks`: blob + metadata lagu perangkat.
- `localStorage`: antrean, riwayat, favorit anonim, pencarian terakhir,
  preferensi EQ (`musikku:eq-settings`, `musikku:local-eq`).
- Hapus data situs = koleksi lokal hilang (tanpa backup otomatis).
