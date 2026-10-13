"use client";

import { useEffect, useState } from "react";
import { Sliders, RotateCcw, Check, Info, Music, Volume2, Play, Pause } from "lucide-react";
import { useToast } from "@/components/toast";
import { usePlayer } from "@/components/player-context";
import {
  EQ_BANDS,
  EQ_MIN_DB,
  EQ_MAX_DB,
  EQ_PRESETS,
  getPreset,
  matchPreset,
  DEFAULT_EQ_SETTINGS,
  loadEqSettings,
  saveEqSettings,
  type EqSettings,
} from "@/lib/karaoke/equalizer";
import { YoutubeEq } from "@/components/youtube-eq";
import {
  youtubeEqEngineSingleton,
  saveYoutubeEqState,
  getGlobalEqSync,
  EQ_SYNC_KEY,
  EQ_SYNC_EVENT,
} from "@/lib/youtube-eq";
import { directStreamPlayerSingleton } from "@/lib/direct-stream-player";

export default function EqualizerPage() {
  const { toast } = useToast();
  const player = usePlayer();
  const [settings, setSettings] = useState<EqSettings>(DEFAULT_EQ_SETTINGS);
  const [activePreset, setActivePreset] = useState<string>("flat");
  const [directState, setDirectState] = useState<string>("idle");

  useEffect(() => {
    const sync = () => {
      const s = loadEqSettings();
      const enabled = getGlobalEqSync();
      setSettings(s);
      setActivePreset(s.preset);
      directStreamPlayerSingleton.applyGains(s.gains, enabled);
      youtubeEqEngineSingleton.updateGains(s.gains, enabled);
    };

    sync();

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "musikku:eq-settings" ||
        e.key === "musikku:youtube-eq" ||
        e.key === "musikku:local-eq" ||
        e.key === EQ_SYNC_KEY
      ) {
        sync();
      }
    };

    const handleSyncChange = () => {
      sync();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EQ_SYNC_EVENT, handleSyncChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EQ_SYNC_EVENT, handleSyncChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    return directStreamPlayerSingleton.subscribe({
      onState: (st) => setDirectState(st),
    });
  }, []);

  const handleBandChange = (index: number, value: number) => {
    const nextGains = [...settings.gains];
    nextGains[index] = value;
    const matched = matchPreset(nextGains) ?? "custom";
    const nextSettings: EqSettings = {
      ...settings,
      gains: nextGains,
      preset: matched,
    };
    setSettings(nextSettings);
    setActivePreset(matched);
    saveEqSettings(nextSettings);
    // Simpan juga ke local player storage agar langsung diterapkan
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(nextGains));
    } catch {}

    // Sambungkan ke DirectStreamPlayer & YouTube EQ Engine
    directStreamPlayerSingleton.applyGains(nextGains, true);
    youtubeEqEngineSingleton.updateGains(nextGains, true);
    saveYoutubeEqState({
      enabled: true,
      bandCount: 10,
      preset: matched,
      preamp: 0,
      gains10: nextGains,
    });
  };

  const handleApplyPreset = (presetName: string) => {
    const p = getPreset(presetName);
    if (!p) return;
    const nextSettings: EqSettings = {
      ...settings,
      preset: p.name,
      gains: [...p.gains],
    };
    setSettings(nextSettings);
    setActivePreset(p.name);
    saveEqSettings(nextSettings);
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(p.gains));
    } catch {}

    // Sambungkan ke DirectStreamPlayer & YouTube EQ Engine
    directStreamPlayerSingleton.applyGains(p.gains, true);
    youtubeEqEngineSingleton.updateGains(p.gains, true);
    saveYoutubeEqState({
      enabled: true,
      bandCount: 10,
      preset: p.name,
      preamp: 0,
      gains10: [...p.gains],
    });
    toast(`Preset ${p.label} diterapkan.`, "success");
  };

  const handleReset = () => {
    handleApplyPreset("flat");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      {/* Header */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-900/30 via-fuchsia-900/20 to-pink-900/10 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
              <Sliders className="size-6 text-white" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-white md:text-2xl">Master Equalizer 10-Band</h1>
              <p className="text-xs text-zinc-400 md:text-sm">
                Atur kurva respons frekuensi audio untuk musik lokal, cloud, karaoke, dan YouTube streaming secara real-time.
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              if (directState === "playing" || player.status === "playing") {
                directStreamPlayerSingleton.pause();
                player.setStatus("paused");
              } else {
                const vid = player.current?.videoId || "dQw4w9WgXcQ";
                directStreamPlayerSingleton.applyGains(settings.gains, true);
                await directStreamPlayerSingleton.loadAndPlay(vid);
                player.setStatus("playing");
                toast(
                  "Lagu sedang diputar dengan filter EQ! Geser slider frekuensi di bawah untuk mendengar perubahannya.",
                  "success"
                );
              }
            }}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/60 hover:brightness-110 transition cursor-pointer"
          >
            {directState === "playing" || player.status === "playing" ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            <span>
              {directState === "playing" || player.status === "playing"
                ? player.current?.title
                  ? `Jeda: ${player.current.title.slice(0, 24)}...`
                  : "Jeda Audio"
                : player.current?.title
                ? `▶ Putar dengan EQ: ${player.current.title.slice(0, 24)}...`
                : "▶ Putar Demo Audio untuk Uji Suara EQ"}
            </span>
          </button>
        </div>
      </header>

      {/* Kartu Status Lagu YouTube Aktif & Tersinkron */}
      {player.current && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-950 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.current.thumbnail}
              alt=""
              className="size-14 rounded-xl object-cover border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-300">
                  Lagu YouTube Aktif · Tersinkron ke Equalizer 10-Band
                </span>
              </div>
              <p className="truncate text-sm font-bold text-white mt-0.5">
                {player.current.title}
              </p>
              <p className="truncate text-xs text-zinc-400">
                {player.current.channelTitle} · Slider frekuensi di bawah ini langsung memfilter lagu ini secara real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (directState === "playing" || player.status === "playing") {
                  directStreamPlayerSingleton.pause();
                  player.setStatus("paused");
                } else {
                  directStreamPlayerSingleton.applyGains(settings.gains, true);
                  void directStreamPlayerSingleton.loadAndPlay(player.current!.videoId);
                  player.setStatus("playing");
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
            >
              {directState === "playing" || player.status === "playing" ? (
                <>
                  <Pause className="size-3.5" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  <span>Putar</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Capability Banner (Kejujuran Kemampuan Platform — §H & §C) */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 text-emerald-400">
            <Check className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-emerald-300">Didukung Penuh (Web Audio API)</h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Aktif pada file lagu <strong>Lokal (IndexedDB)</strong>, <strong>Cloud (Supabase Storage)</strong>, <strong>Streaming Audio Langsung</strong>, dan pemrosesan <strong>Mikrofon Karaoke</strong>. Filter Biquad 10-band memfilter suara secara real-time.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
          <div className="mt-0.5 rounded-full bg-violet-500/20 p-1 text-violet-400">
            <Info className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-violet-300">Equalizer untuk YouTube</h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Tersinkronisasi otomatis menggunakan <strong>Web Audio API 10-Band EQ</strong> tanpa ekstensi dan tanpa izin share tab. Suara YouTube terfilter secara real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Modul Khusus: YouTube EQ (Equalizer) */}
      <section className="space-y-2" aria-label="YouTube EQ">
        <YoutubeEq defaultExpanded={true} videoId={player.current?.videoId} />
      </section>

      {/* Preset Selector */}
      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Preset Equalizer">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-violet-400" />
            <span className="text-sm font-bold text-white">Preset Suara</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300 uppercase">
              {activePreset}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
          >
            <RotateCcw className="size-3.5" />
            Reset ke Flat
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {EQ_PRESETS.map((p) => {
            const isSelected = activePreset === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.name)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  isSelected
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30"
                    : "border border-white/10 bg-charcoal text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 10-Band EQ Sliders */}
      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="10 Band Sliders">
        <h2 className="mb-6 font-bold text-white">Frekuensi 10-Band (-12 dB hingga +12 dB)</h2>

        <div className="grid grid-cols-5 gap-4 sm:grid-cols-10">
          {EQ_BANDS.map((band, idx) => {
            const gain = settings.gains[idx] ?? 0;
            return (
              <div key={band.freq} className="flex flex-col items-center gap-3">
                <span className="font-mono text-[11px] font-semibold text-violet-300">
                  {gain > 0 ? `+${gain}` : gain} dB
                </span>

                <div className="relative flex h-48 w-8 items-center justify-center">
                  <input
                    type="range"
                    min={EQ_MIN_DB}
                    max={EQ_MAX_DB}
                    step={1}
                    value={gain}
                    onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                    className="h-40 w-2 cursor-pointer rounded-full bg-charcoal accent-violet-500"
                  />
                </div>

                <div className="text-center">
                  <span className="block font-mono text-[10px] text-zinc-400">{band.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
