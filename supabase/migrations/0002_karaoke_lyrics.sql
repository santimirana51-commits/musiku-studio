-- MusikKu Karaoke: tabel lirik per baris (LRC)
--
-- Kebijakan sumber: HANYA lirik yang diunggah/dibuat pengguna sendiri atau
-- berlisensi eksplisit. Tidak ada scraping situs lirik, tidak ada auto-fetch
-- lirik dari YouTube. Kolom rights_confirmed mencatat pernyataan hak pengguna.
-- Jalankan via: supabase db push atau SQL Editor (lihat README).

create table if not exists public.karaoke_lyrics (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null check (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  title text not null check (char_length(title) between 1 and 300),
  language text not null default 'id' check (char_length(language) between 2 and 10),
  source_type text not null check (source_type in ('user_upload', 'user_created', 'licensed')),
  source_reference text not null default '',
  lyrics_lrc text not null check (char_length(lyrics_lrc) between 1 and 100000),
  offset_ms int not null default 0 check (offset_ms between -30000 and 30000),
  user_id uuid not null references public.profiles(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, youtube_video_id, language)
);

create index if not exists karaoke_lyrics_video_idx
  on public.karaoke_lyrics(youtube_video_id, visibility);
create index if not exists karaoke_lyrics_user_idx
  on public.karaoke_lyrics(user_id, created_at desc);

-- ============ RLS ============

alter table public.karaoke_lyrics enable row level security;

-- Pemilik: akses penuh atas liriknya sendiri.
drop policy if exists "karaoke_owner_all" on public.karaoke_lyrics;
create policy "karaoke_owner_all" on public.karaoke_lyrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Publik (termasuk anonim): hanya baca lirik bertanda public.
drop policy if exists "karaoke_public_read" on public.karaoke_lyrics;
create policy "karaoke_public_read" on public.karaoke_lyrics for select
  using (visibility = 'public');

-- updated_at otomatis
drop trigger if exists trg_karaoke_touch on public.karaoke_lyrics;
create trigger trg_karaoke_touch before update on public.karaoke_lyrics
  for each row execute function public.touch_updated_at();
