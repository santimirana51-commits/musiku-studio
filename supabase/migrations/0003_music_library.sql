-- MusikKu: perpustakaan musik cloud (metadata + bucket privat)
--
-- - File audio di bucket privat `music-files` (path: <user_id>/...).
-- - Akses file via signed URL berumur pendek dari API (bukan URL publik).
-- - RLS: user hanya boleh CRUD miliknya. Service-role key tidak dipakai di browser.
-- Jalankan via: supabase db push atau SQL Editor (lihat README/docs/library.md).

create table if not exists public.music_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  artist text not null default '' check (char_length(artist) <= 200),
  album text not null default '' check (char_length(album) <= 200),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in (
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/aac', 'audio/aacp'
  )),
  file_size bigint not null check (file_size > 0 and file_size <= 524288000),
  duration_seconds numeric check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 86400)),
  created_at timestamptz not null default now()
);

create index if not exists music_library_user_idx
  on public.music_library(user_id, created_at desc);

alter table public.music_library enable row level security;

drop policy if exists "music_owner_all" on public.music_library;
create policy "music_owner_all" on public.music_library for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ Storage: bucket privat + kebijakan per-user ============

insert into storage.buckets (id, name, public)
values ('music-files', 'music-files', false)
on conflict (id) do nothing;

-- Catatan: policy storage.objects membutuhkan helper storage.foldername
-- (tersedia di proyek Supabase bawaan). Path wajib diawali user_id/.

drop policy if exists "music_files_owner_insert" on storage.objects;
create policy "music_files_owner_insert" on storage.objects for insert
  with check (
    bucket_id = 'music-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "music_files_owner_read" on storage.objects;
create policy "music_files_owner_read" on storage.objects for select
  using (
    bucket_id = 'music-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "music_files_owner_update" on storage.objects;
create policy "music_files_owner_update" on storage.objects for update
  using (
    bucket_id = 'music-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'music-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "music_files_owner_delete" on storage.objects;
create policy "music_files_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'music-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
