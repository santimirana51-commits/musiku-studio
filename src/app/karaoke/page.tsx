"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  LogOut,
  Maximize,
  Mic2,
  Minimize,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Sliders,
  Upload,
  X,
} from "lucide-react";
import { KaraokePlayer, type KaraokePlayerHandle } from "@/components/karaoke-player";
import { LyricsPanel, type LyricTextSize, type LyricTheme } from "@/components/lyrics-panel";
import { MicPanel } from "@/components/mic-panel";
import { YoutubeEq } from "@/components/youtube-eq";
import { VideoCard, VideoSkeleton, EmptyState } from "@/components/video-card";
import { usePlayer } from "@/components/player-context";
import { KaraokeEngine, type KaraokePlayerState, type LyricLine } from "@/lib/karaoke/engine";
import { parseLrc, validateLrc } from "@/lib/karaoke/lrc";
import { directStreamPlayerSingleton } from "@/lib/direct-stream-player";
import type { VideoItem } from "@/lib/youtube";

const CATEGORIES = [
  { label: "Karaoke", query: "karaoke pop indonesia" },
  { label: "Instrumental", query: "instrumental lagu indonesia" },
  { label: "Sing-Along", query: "sing along hits indonesia" },
  { label: "Lagu + Lirik", query: "lagu indonesia lirik video" },
] as const;

const RATES = [0.75, 1, 1.25, 1.5];

interface StoredLyric {
  id: string;
  youtube_video_id: string;
  title: string;
  language: string;
  source_type: string;
  offset_ms: number;
  visibility: string;
  created_at: string;
  lyrics_lrc: string;
}

function KaraokeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const musicPlayer = usePlayer();

  // ---- pencarian ----
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("Karaoke");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [availability, setAvailability] = useState<Record<string, { count: number; languages: string[] }>>({});

  // ---- lagu terpilih ----
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [stored, setStored] = useState<StoredLyric[]>([]);
  const [lyricId, setLyricId] = useState<string | null>(null);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playerState, setPlayerState] = useState<KaraokePlayerState>("unstarted");
  const [playerError, setPlayerError] = useState<string | null>(null);

  // ---- pengaturan ----
  const [offsetMs, setOffsetMs] = useState(0);
  const [textSize, setTextSize] = useState<LyricTextSize>("lg");
  const [theme, setTheme] = useState<LyricTheme>("fuchsia");
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- upload ----
  const [showUpload, setShowUpload] = useState(false);
  const [lrcText, setLrcText] = useState("");
  const [upTitle, setUpTitle] = useState("");
  const [upLang, setUpLang] = useState("id");
  const [upSource, setUpSource] = useState("user_upload");
  const [upVisibility, setUpVisibility] = useState("private");
  const [upRights, setUpRights] = useState(false);
  const [upError, setUpError] = useState<string | null>(null);
  const [upSaving, setUpSaving] = useState(false);
  const [upSavedOffset, setUpSavedOffset] = useState(false);

  const playerRef = useRef<KaraokePlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<KaraokeEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new KaraokeEngine([], {
      onActiveLine: (_l, i) => setActiveIndex(i),
      onState: () => {},
    });
  }

  useEffect(() => {
    return directStreamPlayerSingleton.subscribe({
      onTime: (t) => {
        if (directStreamPlayerSingleton.getState() === "playing") {
          engineRef.current?.update(t * 1000);
        }
      },
    });
  }, []);

  const fetchKaraoke = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&maxResults=12`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal memuat data.");
      const items: VideoItem[] = data.items ?? [];
      setResults(items);
      if (items.length > 0) {
        const ids = items.map((v) => v.videoId).join(",");
        const av = await fetch(`/api/karaoke/lyrics?videoIds=${encodeURIComponent(ids)}`);
        if (av.ok) {
          const aj = await av.json();
          setAvailability(aj.availability ?? {});
        }
      } else setAvailability({});
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = params.get("q") ?? CATEGORIES[0].query;
    setQuery(q);
    setDraft(q);
    void fetchKaraoke(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("q")]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = draft.trim().slice(0, 100);
    if (!q) return;
    setActiveCat("");
    // Lewat URL agar bisa dibagikan + satu jalur fetch via effect di atas.
    router.push(`/karaoke?q=${encodeURIComponent(q)}`);
  };

  // Engine: attach sekali dengan provider waktu live dari player.
  useEffect(() => {
    const engine = engineRef.current!;
    engine.attach({
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getPlaybackRate: () => playerRef.current?.getRate() ?? 1,
    });
    return () => engine.detach();
  }, []);

  const loadStored = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(`/api/karaoke/lyrics?videoId=${videoId}`);
      if (!res.ok) return;
      const data = await res.json();
      setStored(data.items ?? []);
    } catch {}
  }, []);

  const chooseVideo = useCallback(
    (v: VideoItem) => {
      // Sinkronkan ke pemutar musik global
      musicPlayer.syncTrack(v, "playing");
      setVideo(v);
      setStored([]);
      setLyricId(null);
      setLines([]);
      setActiveIndex(-1);
      setOffsetMs(0);
      setRate(1);
      setPlayerError(null);
      setShowUpload(false);
      setUpError(null);
      setUpTitle(v.title);
      engineRef.current?.handleVideoChange();
      void loadStored(v.videoId);
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadStored, musicPlayer.syncTrack]
  );

  // Sinkronisasi otomatis jika ada parameter ?v=... di URL (mis. dialihkan dari tombol Mode Karaoke)
  useEffect(() => {
    const vId = params.get("v");
    if (!vId) return;
    if (video?.videoId === vId) return;

    if (musicPlayer.current?.videoId === vId) {
      chooseVideo(musicPlayer.current);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/videos/${vId}`);
        const data = await res.json();
        if (alive && res.ok && data?.item) {
          chooseVideo(data.item);
        }
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [params, video?.videoId, musicPlayer.current, chooseVideo]);

  // Sinkronisasi jika track aktif diubah dari PlayerBar (mis. user menekan Next/Prev antrean)
  useEffect(() => {
    if (musicPlayer.current && video && musicPlayer.current.videoId !== video.videoId) {
      chooseVideo(musicPlayer.current);
    }
  }, [musicPlayer.current, video, chooseVideo]);

  // Sinkronisasi kontrol Play/Pause dari PlayerBar global ke pemutar karaoke
  useEffect(() => {
    if (!video) return;
    if (musicPlayer.status === "playing" && playerState !== "playing" && playerState !== "buffering") {
      playerRef.current?.play();
    } else if (musicPlayer.status === "paused" && playerState === "playing") {
      playerRef.current?.pause();
    }
  }, [musicPlayer.status, video, playerState]);

  // Terapkan lirik terpilih ke engine.
  useEffect(() => {
    const rec = stored.find((s) => s.id === lyricId) ?? null;
    if (!rec) {
      setLines([]);
      engineRef.current?.setLines([]);
      return;
    }
    const parsed = parseLrc(rec.lyrics_lrc);
    setLines(parsed.lines);
    engineRef.current?.setLines(parsed.lines);
    setOffsetMs(rec.offset_ms ?? 0);
    engineRef.current?.setOffsetMs(rec.offset_ms ?? 0);
  }, [lyricId, stored]);

  const applyOffset = (ms: number) => {
    setOffsetMs(ms);
    engineRef.current?.setOffsetMs(ms);
  };

  const seekBy = (sec: number) => {
    const t = playerRef.current?.getCurrentTime() ?? 0;
    playerRef.current?.seekTo(Math.max(0, t + sec));
  };

  const changeRate = (r: number) => {
    playerRef.current?.setRate(r);
    setRate(playerRef.current?.getRate() ?? r);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else if (stageRef.current?.requestFullscreen) {
        await stageRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onFile = async (f: File | undefined) => {
    setUpError(null);
    if (!f) return;
    if (f.size > 100_000) {
      setUpError("Ukuran file melebihi 100 KB.");
      return;
    }
    try {
      const text = await f.text();
      setLrcText(text);
      const v = validateLrc(text);
      if (!v.ok) setUpError(v.message);
    } catch {
      setUpError("Gagal membaca file.");
    }
  };

  const saveLyric = async () => {
    if (!video) return;
    setUpError(null);
    setUpSaving(true);
    try {
      const res = await fetch("/api/karaoke/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_video_id: video.videoId,
          title: upTitle || video.title,
          language: upLang || "id",
          source_type: upSource,
          source_reference: "",
          lyrics_lrc: lrcText,
          offset_ms: offsetMs,
          visibility: upVisibility,
          rights_confirmed: upRights,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan lirik.");
      await loadStored(video.videoId);
      setLyricId(data.item?.id ?? null);
      setShowUpload(false);
      setLrcText("");
    } catch (e) {
      setUpError(e instanceof Error ? e.message : "Gagal menyimpan lirik.");
    } finally {
      setUpSaving(false);
    }
  };

  // Simpan offset ke lirik milik sendiri (upsert via POST penuh).
  const saveOffset = async () => {
    const rec = stored.find((s) => s.id === lyricId);
    if (!video || !rec) return;
    setUpError(null);
    setUpSavedOffset(false);
    try {
      const res = await fetch("/api/karaoke/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_video_id: rec.youtube_video_id,
          title: rec.title,
          language: rec.language,
          source_type: rec.source_type,
          source_reference: "",
          lyrics_lrc: rec.lyrics_lrc,
          offset_ms: offsetMs,
          visibility: rec.visibility,
          rights_confirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan offset.");
      await loadStored(video.videoId);
      setUpSavedOffset(true);
    } catch (e) {
      setUpError(e instanceof Error ? e.message : "Gagal menyimpan offset.");
    }
  };

  const activeLyric = useMemo(() => stored.find((s) => s.id === lyricId) ?? null, [stored, lyricId]);
  const playing = playerState === "playing";

  const handleOpenInStudio = () => {
    if (!video) return;
    if (typeof window !== "undefined") {
      const payload = {
        title: video.title,
        lrcRaw: activeLyric?.lyrics_lrc || "",
        offsetMs,
        lines: lines.map((l) => ({ timeSec: l.timeMs / 1000, text: l.text })),
      };
      sessionStorage.setItem("musikku_studio_incoming_lyrics", JSON.stringify(payload));
      router.push("/studio?import_karaoke=1");
    }
  };

  const handleExitKaraoke = useCallback(() => {
    try {
      playerRef.current?.pause();
    } catch {}
    setVideo(null);
    setLines([]);
    setLyricId(null);
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-700/40 via-fuchsia-700/20 to-pink-600/20 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500">
              <Mic2 className="size-6 text-white" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-white md:text-3xl">
                Karaoke{" "}
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  MusikKu
                </span>
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExitKaraoke}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 hover:border-white/20 transition shadow-sm cursor-pointer"
            title="Keluar dari mode karaoke dan kembali"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>Keluar Karaoke</span>
          </button>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          Bernyanyi mengikuti lirik tersinkron per baris di atas player resmi YouTube.
          Lirik hanya dari unggahan/buatan pengguna berizin — bukan auto-fetch.
        </p>
        {/* Pencarian lagu karaoke */}
        <form onSubmit={submitSearch} role="search" aria-label="Cari lagu karaoke" className="mt-4 flex max-w-xl gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Cari lagu karaoke… (mis. noah karaoke)"
              aria-label="Kata kunci lagu karaoke"
              maxLength={100}
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white"
          >
            Cari
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => {
                setActiveCat(c.label);
                setQuery(c.query);
                setDraft(c.query);
                void fetchKaraoke(c.query);
              }}
              aria-pressed={activeCat === c.label}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeCat === c.label
                  ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-fuchsia-500/40 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Banner cepat lagu yang sedang diputar di Mini Player */}
        {musicPlayer.current && !video && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-violet-900/40 via-fuchsia-900/30 to-pink-900/20 p-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={musicPlayer.current.thumbnail}
                alt=""
                className="size-12 rounded-xl object-cover border border-white/10 shadow shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                  Sedang Diputar di Mini Player
                </p>
                <p className="truncate text-sm font-bold text-white">
                  {musicPlayer.current.title}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {musicPlayer.current.channelTitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => chooseVideo(musicPlayer.current!)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 transition cursor-pointer shrink-0"
            >
              <Mic2 className="size-4" />
              <span>Karaokekan Lagu Ini</span>
            </button>
          </div>
        )}
      </section>

      {/* Stage karaoke */}
      {video ? (
        <div ref={stageRef} className="space-y-4 rounded-3xl bg-charcoal p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={handleExitKaraoke}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-600/15 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-600/25 hover:border-red-500/40 transition shadow-sm cursor-pointer"
              title="Keluar dari mode karaoke dan kembali"
            >
              <LogOut className="size-4" aria-hidden />
              <span>Keluar Karaoke</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVideo(null);
                setLines([]);
                setLyricId(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/15 hover:text-white transition cursor-pointer"
              title="Kembali ke daftar pencarian lagu karaoke"
            >
              <Music2 className="size-4" aria-hidden />
              <span>Ganti Lagu</span>
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white px-1">{video.title}</span>

            {/* Mode YouTube Button */}
            <Link
              href={`/watch?v=${video.videoId}`}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-600/15 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-600/25 transition shadow-sm cursor-pointer"
              title="Tonton video klip ini di Mode YouTube resmi"
            >
              <span>Mode YouTube</span>
            </Link>

            {/* Buka di Studio DAW Button */}
            <button
              type="button"
              onClick={handleOpenInStudio}
              title="Buka lirik lagu ini di MusikKu Studio DAW untuk rekaman vokal multitrack dan mixing profesional"
              className="flex items-center gap-1.5 rounded-xl border border-fuchsia-500/40 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 px-3 py-2 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-600/40 transition shadow-sm cursor-pointer"
            >
              <Sliders className="size-4 text-fuchsia-300" aria-hidden />
              <span className="hidden sm:inline">Buka di Studio DAW</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh area karaoke"}
              aria-pressed={isFullscreen}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 cursor-pointer"
            >
              {isFullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
              {isFullscreen ? "Keluar Penuh" : "Layar Penuh"}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              <KaraokePlayer
                ref={playerRef}
                videoId={video.videoId}
                onState={(s) => {
                  setPlayerState(s);
                  engineRef.current?.handlePlayerState(s);
                  if (s === "playing") {
                    musicPlayer.setStatus("playing");
                  } else if (s === "paused" || s === "ended") {
                    musicPlayer.setStatus("paused");
                  }
                }}
                onError={setPlayerError}
              />
              {playerError && (
                <p className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{playerError}</p>
              )}
              {/* Transport */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-card p-3">
                <button onClick={() => seekBy(-10)} aria-label="Mundur 10 detik" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
                  -10 dtk
                </button>
                <button
                  onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}
                  aria-label={playing ? "Jeda" : "Putar"}
                  className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white"
                >
                  {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
                </button>
                <button onClick={() => seekBy(10)} aria-label="Maju 10 detik" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
                  +10 dtk
                </button>
                <span className="ml-1 text-xs text-zinc-400">Kecepatan:</span>
                <div className="flex gap-1" role="group" aria-label="Kecepatan putar">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRate(r)}
                      aria-pressed={rate === r}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${rate === r ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
                <span className="w-full text-[11px] text-zinc-500 sm:w-auto">
                  Status: {playerState} • sinkron per baris, tanpa reload
                </span>
              </div>
              <YoutubeEq
                defaultExpanded={true}
                videoId={video?.videoId}
                onToggleDirectMode={(active) => {
                  if (active) {
                    playerRef.current?.pause();
                  }
                }}
              />
              <MicPanel />
            </div>

            <div className="space-y-3">
              {/* Bahasa + offset + tampilan */}
              <div className="rounded-2xl border border-white/10 bg-card p-3 text-xs text-zinc-300">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="font-semibold">
                    Bahasa{" "}
                    <select
                      value={lyricId ?? ""}
                      onChange={(e) => setLyricId(e.target.value || null)}
                      className="ml-1 rounded-lg bg-white/10 px-2 py-1.5 text-white"
                    >
                      <option value="">— tanpa lirik —</option>
                      {stored.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.language} • {s.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="font-semibold">
                    Teks{" "}
                    <select
                      value={textSize}
                      onChange={(e) => setTextSize(e.target.value as LyricTextSize)}
                      className="ml-1 rounded-lg bg-white/10 px-2 py-1.5 text-white"
                    >
                      <option value="sm">Kecil</option>
                      <option value="md">Sedang</option>
                      <option value="lg">Besar</option>
                      <option value="xl">Sangat besar</option>
                    </select>
                  </label>
                  <span className="font-semibold">Tema</span>
                  <div className="flex gap-1" role="group" aria-label="Warna tema lirik">
                    {(["violet", "fuchsia", "pink"] as LyricTheme[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        aria-pressed={theme === t}
                        aria-label={`Tema ${t}`}
                        className={`size-6 rounded-full ${t === "violet" ? "bg-violet-500" : t === "fuchsia" ? "bg-fuchsia-500" : "bg-pink-500"} ${theme === t ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-60"}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Minus className="size-4 text-zinc-500" aria-hidden />
                  <input
                    type="range"
                    min={-5000}
                    max={5000}
                    step={100}
                    value={offsetMs}
                    onChange={(e) => applyOffset(Number(e.target.value))}
                    aria-label="Offset sinkronisasi lirik (milidetik)"
                    className="flex-1"
                  />
                  <Plus className="size-4 text-zinc-500" aria-hidden />
                  <span className="w-20 text-right font-mono" aria-live="polite">
                    {offsetMs > 0 ? `+${offsetMs}` : offsetMs} ms
                  </span>
                </div>
                {activeLyric && (
                  <button onClick={saveOffset} className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white hover:bg-white/15">
                    Simpan offset
                  </button>
                )}
                {upSavedOffset && <span className="ml-2 text-emerald-300">Offset tersimpan.</span>}
              </div>

              <LyricsPanel lines={lines} activeIndex={activeIndex} theme={theme} textSize={textSize} />

              {/* Upload */}
              {!showUpload ? (
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-fuchsia-500/40 px-4 py-3 text-sm font-bold text-fuchsia-200 hover:bg-fuchsia-500/10"
                >
                  <Upload className="size-4" aria-hidden /> Unggah / buat LRC
                </button>
              ) : (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-card p-4 text-xs text-zinc-300">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="font-semibold">
                      Judul
                      <input value={upTitle} onChange={(e) => setUpTitle(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white" maxLength={300} />
                    </label>
                    <label className="font-semibold">
                      Bahasa (mis. id/en)
                      <input value={upLang} onChange={(e) => setUpLang(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white" maxLength={10} />
                    </label>
                    <label className="font-semibold">
                      Sumber
                      <select value={upSource} onChange={(e) => setUpSource(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white">
                        <option value="user_upload">File LRC milik saya</option>
                        <option value="user_created">Lirik buatan saya</option>
                        <option value="licensed">Berlisensi eksplisit</option>
                      </select>
                    </label>
                    <label className="font-semibold">
                      Visibilitas
                      <select value={upVisibility} onChange={(e) => setUpVisibility(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white">
                        <option value="private">Privat</option>
                        <option value="public">Publik</option>
                      </select>
                    </label>
                  </div>
                  <label className="block font-semibold">
                    File .lrc (maks 100 KB)
                    <input
                      type="file"
                      accept=".lrc,text/plain"
                      onChange={(e) => void onFile(e.target.files?.[0])}
                      className="mt-1 w-full text-zinc-400"
                    />
                  </label>
                  <label className="block font-semibold">
                    …atau tempel / ketik LRC ([mm:ss.xx] teks)
                    <textarea
                      value={lrcText}
                      onChange={(e) => setLrcText(e.target.value)}
                      rows={6}
                      placeholder={"[00:10.00] Baris pertama\n[00:15.50] Baris kedua"}
                      className="mt-1 w-full rounded-lg bg-white/10 p-2 font-mono text-white"
                    />
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={upRights} onChange={(e) => setUpRights(e.target.checked)} className="mt-0.5" />
                    <span>
                      Saya menyatakan berhak mengunggah/membagikan lirik ini (karya sendiri, milik
                      sendiri, atau berlisensi). Tanpa scraping situs lirik.
                    </span>
                  </label>
                  {upError && <p className="text-red-400">{upError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={saveLyric}
                      disabled={upSaving}
                      className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                      {upSaving ? "Menyimpan…" : "Simpan lirik"}
                    </button>
                    <button onClick={() => setShowUpload(false)} className="rounded-xl bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/15">
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Hasil pencarian */}
      <section aria-label="Lagu karaoke">
        <h2 className="mb-3 text-lg font-bold text-white">
          {query ? `Hasil: ${query}` : "Pilih lagu karaoke"}
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <VideoSkeleton key={i} />)}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-sm text-red-200">
            <p className="font-semibold">Tidak dapat memuat konten.</p>
            <p className="mt-1">{loadError}</p>
            <button onClick={() => fetchKaraoke(query)} className="mt-3 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white">Coba lagi</button>
          </div>
        ) : results.length === 0 ? (
          <EmptyState title="Belum ada hasil" hint="Coba kategori lain." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {results.map((v) => {
              const av = availability[v.videoId];
              return (
                <div key={v.videoId} className="relative">
                  <VideoCard video={v} onPlay={() => chooseVideo(v)} />
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${av ? "bg-emerald-500/90 text-white" : "bg-black/70 text-zinc-300"}`}
                    title={av ? `Lirik tersedia (${av.languages.join(", ")})` : "Belum ada lirik tersimpan"}
                  >
                    {av ? `Lirik ✓ ${av.languages.join("/")}` : "Tanpa lirik"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 pb-4 text-center text-[11px] text-zinc-600">
        <Music2 className="size-4 shrink-0" aria-hidden />
        <span>
          Karaoke memakai player resmi YouTube yang selalu terlihat. Tidak semua video mendukung
          embedding/karaoke; tidak ada pemutaran latar saat layar mati. Sinkronisasi per baris —
          bukan per kata. Kembali ke <Link href="/" className="underline">mode musik biasa</Link>.
        </span>
      </p>
    </div>
  );
}

export default function KaraokePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Memuat karaoke…</p>}>
      <KaraokeInner />
    </Suspense>
  );
}
