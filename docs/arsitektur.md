# Arsitektur MusikKu

Next.js 14 App Router + TypeScript + Tailwind + Supabase (Auth, Database, Storage).
Bahasa antarmuka: Indonesia. Tema: dark premium (charcoal `#0f0f14`, aksen ungu/magenta/pink).

## Struktur

```
src/
  app/                  # Halaman + API routes
    page.tsx            # Beranda (hero, kategori, populer, riwayat lokal)
    search/             # Pencarian + pagination token resmi
    watch/              # Player besar YouTube + antrean/terkait
    karaoke/            # Panggung karaoke (player + lirik + mic + EQ vokal)
    library/            # 4 sumber: YouTube / file perangkat / lokal / cloud
    playlists/ favorites/ history/ settings/ admin/ # Fitur akun
    api/                # search, videos/[id], playlists, favorites, history,
                        # admin/stats, karaoke/lyrics, library
  components/           # player-context/bar, youtube-embed, karaoke-player,
                        # lyrics-panel, mic-panel, video-card, nav, auth-*
  lib/                  # supabase client/server, validation (Zod),
                        # rate-limit, storage (localStorage), youtube (tipe),
                        # youtube-iframe (loader API bersama),
                        # karaoke/ (lrc, engine, mic, equalizer, audio-effects),
                        # local-library/ (db IndexedDB, validators),
                        # local-player/ (engine HTMLAudioElement + EQ)
supabase/migrations/    # 0001_init.sql, 0002_karaoke_lyrics.sql, 0003_music_library.sql
docs/                   # arsitektur, api, database, karaoke, library
```

## Pemutar: dua dunia yang tak bercampur

- **Musik YouTube** (`player-context` + `YouTubeEmbed` + `PlayerBar`):
  satu instance resmi dalam satu waktu — besar di `/watch`, mini di bar
  bawah di halaman lain. Pindah halaman = instance berganti dengan lanjutan
  posisi (resume). Play dari halaman lain menavigasi ke `/watch`.
- **File lokal/cloud** (`LocalAudioEngine` di `/library`): `HTMLAudioElement`
  + EQ Web Audio. Independen; saat mulai, pemutar YouTube dijeda agar tak ganda.
- **Karaoke** (`KaraokePlayer` + `KaraokeEngine`): instance sendiri di
  `/karaoke`; pemutar musik dijeda saat lagu karaoke dipilih.

Aturan keras: audio YouTube iframe (cross-origin) tidak pernah dibaca/diubah/
di-EQ aplikasi. EQ hanya untuk mic dan file lokal.

## Data & auth

- Auth Supabase (email). Anonim: favorit/riwayat/history lokal saja.
- Server mengenal user via `requireUser()` (cookie session). RLS menegakkan
  kepemilikan di semua tabel privat; bucket `music-files` privat + signed URL.
- Secret (`YOUTUBE_API_KEY`, service key) hanya di server, tak pernah ke bundle
  client (terverifikasi: tidak ada di `.next/static`).

## Kebijakan YouTube (ringkas)

Pencarian via Data API v3 resmi (cache 60 dtk, maks 25/request, rate limit);
putar via IFrame Player API resmi yang selalu terlihat; tanpa unduh, tanpa
audio-only/background, tanpa pemblokir iklan; hormati 101/150, privat,
wilayah. Detail: README + `docs/karaoke.md`.
