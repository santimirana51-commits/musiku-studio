-- MusikKu initial schema
-- Jalankan via: supabase db push (lihat README) atau SQL Editor di dashboard Supabase.

-- ============ TABLES ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists playlists_user_idx on public.playlists(user_id, updated_at desc);

create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  title_snapshot text not null default '',
  channel_title_snapshot text not null default '',
  thumbnail_url_snapshot text not null default '',
  position int not null default 0,
  added_at timestamptz not null default now()
);
create index if not exists playlist_items_playlist_idx on public.playlist_items(playlist_id, position);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  title_snapshot text not null default '',
  channel_title_snapshot text not null default '',
  thumbnail_url_snapshot text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, youtube_video_id)
);
create index if not exists favorites_user_idx on public.favorites(user_id, created_at desc);

create table if not exists public.playback_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  title_snapshot text not null default '',
  channel_title_snapshot text not null default '',
  played_at timestamptz not null default now()
);
create index if not exists history_user_idx on public.playback_history(user_id, played_at desc);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  history_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Hanya menyimpan referensi video YouTube (ID + snapshot tampilan).
-- Tidak menyimpan file audio/video.

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.favorites enable row level security;
alter table public.playback_history enable row level security;
alter table public.user_preferences enable row level security;

-- profiles: pemilik bisa baca+update miliknya (kecuali role); admin bisa baca semua
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- playlists: pemilik full akses; publik read-only untuk is_public=true
drop policy if exists "playlists_owner_all" on public.playlists;
create policy "playlists_owner_all" on public.playlists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "playlists_public_read" on public.playlists;
create policy "playlists_public_read" on public.playlists for select using (is_public = true);

-- playlist_items: mengikuti hak akses playlist (owner) + baca untuk item milik playlist publik
drop policy if exists "items_owner_all" on public.playlist_items;
create policy "items_owner_all" on public.playlist_items for all using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
);

drop policy if exists "items_public_read" on public.playlist_items;
create policy "items_public_read" on public.playlist_items for select using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.is_public = true)
);

-- favorites: pemilik saja
drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all" on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- playback_history: pemilik saja
drop policy if exists "history_owner_all" on public.playback_history;
create policy "history_owner_all" on public.playback_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_preferences: pemilik saja
drop policy if exists "prefs_owner_all" on public.user_preferences;
create policy "prefs_owner_all" on public.user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ TRIGGER: auto profil + updated_at ============

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_playlists_touch on public.playlists;
create trigger trg_playlists_touch before update on public.playlists
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_prefs_touch on public.user_preferences;
create trigger trg_prefs_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- CATATAN: role admin TIDAK bisa diubah user sendiri karena policy update
-- tidak mengizinkan perubahan kolom role. Jadikan admin via SQL service_role:
--   update public.profiles set role='admin' where id='<uuid>';
-- Endpoint /api/admin juga memverifikasi role di server + ADMIN_EMAILS allowlist.
