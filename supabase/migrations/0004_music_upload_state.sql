-- MusikKu Fase 3: status upload + versioning untuk sync engine.
--
-- - `upload_status`: state unggah terlihat client (pending/uploading/ready/failed).
--   Alur upload tetap 2 tahap (signed URL + POST metadata); kolom ini mencatat
--   hasil akhir agar UI/sync bisa menampilkan status offline & retry jujur.
-- - `upload_error`: pesan kegagalan terakhir ("" bila tidak ada).
-- - `updated_at`: versioning last-write-wins untuk sync lintas perangkat.
--   (Tabel lain sudah punya updated_at: playlists, profiles, user_preferences,
--   karaoke_lyrics. playback_history/favorites/playlist_items memakai
--   created_at/added_at sebagai versi — lihat docs/storage-and-sync.md.)
-- Jalankan via: supabase db push atau SQL Editor (lihat README).

alter table public.music_library
  add column if not exists upload_status text not null default 'ready'
    check (upload_status in ('pending', 'uploading', 'ready', 'failed'));

alter table public.music_library
  add column if not exists upload_error text not null default '';

alter table public.music_library
  add column if not exists updated_at timestamptz not null default now();

create index if not exists music_library_user_updated_idx
  on public.music_library(user_id, updated_at desc);

drop trigger if exists trg_music_library_touch on public.music_library;
create trigger trg_music_library_touch before update on public.music_library
  for each row execute function public.touch_updated_at();
