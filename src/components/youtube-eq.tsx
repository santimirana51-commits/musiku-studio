"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sliders,
  RotateCcw,
  Volume2,
  Power,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Settings,
  Info,
} from "lucide-react";
import {
  YOUTUBE_EQ_10_BANDS,
  YOUTUBE_EQ_PRESETS,
  DEFAULT_YOUTUBE_EQ_STATE,
  loadYoutubeEqState,
  saveYoutubeEqState,
  youtubeEqEngineSingleton,
  getGlobalEqSync,
  setGlobalEqSync,
  EQ_SYNC_EVENT,
  EQ_SYNC_KEY,
  type YoutubeEqState,
} from "@/lib/youtube-eq";
import { directStreamPlayerSingleton, type DirectPlayerState } from "@/lib/direct-stream-player";
import { isAndroidNative, openSystemEqualizerPanel } from "@/lib/native-equalizer";
import { useToast } from "@/components/toast";
import { usePlayer } from "@/components/player-context";

interface YoutubeEqProps {
  className?: string;
  defaultExpanded?: boolean;
  videoId?: string;
  onToggleDirectMode?: (active: boolean) => void;
}

export function YoutubeEq({
  className = "",
  defaultExpanded = false,
  videoId,
  onToggleDirectMode,
}: YoutubeEqProps) {
  const { toast } = useToast();
  const player = usePlayer();
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [eqState, setEqState] = useState<YoutubeEqState>(DEFAULT_YOUTUBE_EQ_STATE);
  const [isTabConnected, setIsTabConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [directState, setDirectState] = useState<DirectPlayerState>("idle");
  const [isAndroid, setIsAndroid] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsAndroid(isAndroidNative());
  }, []);

  // Subscribe ke status DirectStreamPlayer
  useEffect(() => {
    return directStreamPlayerSingleton.subscribe({
      onState: (st) => {
        setDirectState(st);
        if (st === "playing") {
          onToggleDirectMode?.(true);
        } else if (st === "ended" || st === "idle") {
          onToggleDirectMode?.(false);
        }
      },
    });
  }, [onToggleDirectMode]);

  // Hydrate state dari localStorage di client setelah mount untuk cegah React SSR Hydration Mismatch
  useEffect(() => {
    const loaded = loadYoutubeEqState();
    const isGlobalSync = getGlobalEqSync();
    loaded.enabled = isGlobalSync;
    setEqState(loaded);
    youtubeEqEngineSingleton.updateGains(loaded.gains10, isGlobalSync);
    directStreamPlayerSingleton.applyGains(loaded.gains10, isGlobalSync);

    const syncState = () => {
      const refreshed = loadYoutubeEqState();
      const globalSync = getGlobalEqSync();
      refreshed.enabled = globalSync;
      setEqState(refreshed);
      youtubeEqEngineSingleton.updateGains(refreshed.gains10, globalSync);
      directStreamPlayerSingleton.applyGains(refreshed.gains10, globalSync);
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "musikku:youtube-eq" ||
        e.key === "musikku:eq-settings" ||
        e.key === "musikku:local-eq" ||
        e.key === EQ_SYNC_KEY
      ) {
        syncState();
      }
    };

    const handleSyncEvent = (e: Event) => {
      const nextVal = (e as CustomEvent<boolean>).detail;
      if (typeof nextVal === "boolean") {
        setEqState((prev) => {
          if (prev.enabled === nextVal) return prev;
          const next = { ...prev, enabled: nextVal };
          youtubeEqEngineSingleton.updateGains(next.gains10, nextVal);
          directStreamPlayerSingleton.applyGains(next.gains10, nextVal);
          return next;
        });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncState();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EQ_SYNC_EVENT, handleSyncEvent);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EQ_SYNC_EVENT, handleSyncEvent);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    youtubeEqEngineSingleton.onConnectionChange((connected) => {
      setIsTabConnected(connected);
      if (connected) {
        toast("Audio tab YouTube berhasil terhubung ke Equalizer! Suara kini terfilter.", "success");
      } else {
        toast("Koneksi audio tab YouTube terputus.", "info");
      }
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [toast]);

  // Visualizer loop (FFT real jika terhubung, atau kurva respons EQ dinamis jika belum)
  useEffect(() => {
    let phase = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          ctx.clearRect(0, 0, width, height);

          const liveData =
            directState === "playing"
              ? directStreamPlayerSingleton.getVisualizerData()
              : isTabConnected
              ? youtubeEqEngineSingleton.getVisualizerData()
              : null;

          if (liveData && liveData.length > 0) {
            // Live Web Audio FFT spectrum bars
            const barCount = 32;
            const barWidth = width / barCount - 2;
            for (let i = 0; i < barCount; i++) {
              const binIdx = Math.floor((i / barCount) * (liveData.length * 0.7));
              const val = liveData[binIdx] / 255;
              const barHeight = Math.max(4, val * (height - 8));
              const x = i * (barWidth + 2);
              const y = height - barHeight;

              const gradient = ctx.createLinearGradient(0, height, 0, y);
              gradient.addColorStop(0, "#8b5cf6");
              gradient.addColorStop(0.5, "#d946ef");
              gradient.addColorStop(1, "#38bdf8");

              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
              ctx.fill();
            }
          } else {
            // Animated EQ Curve visualizer
            phase += 0.04;
            const pointsCount = 10;
            const points: { x: number; y: number }[] = [];

            for (let i = 0; i < pointsCount; i++) {
              const gain = eqState.enabled ? eqState.gains10[i] : 0;
              const normalized = gain / 12; // -1 to 1
              const baseY = height / 2 - normalized * (height * 0.38);
              const subtleWave = Math.sin(phase + i * 0.8) * 3;
              points.push({
                x: (i / (pointsCount - 1)) * (width - 16) + 8,
                y: Math.max(6, Math.min(height - 6, baseY + subtleWave)),
              });
            }

            // Draw area under curve
            ctx.beginPath();
            ctx.moveTo(points[0].x, height);
            ctx.lineTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            ctx.lineTo(points[points.length - 1].x, height);
            ctx.closePath();

            const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
            areaGrad.addColorStop(0, "rgba(168, 85, 247, 0.25)");
            areaGrad.addColorStop(1, "rgba(236, 72, 153, 0.02)");
            ctx.fillStyle = areaGrad;
            ctx.fill();

            // Draw line
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            ctx.strokeStyle = eqState.enabled ? "#c084fc" : "#71717a";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = eqState.enabled ? "#a855f7" : "transparent";
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTabConnected, eqState.enabled, eqState.gains10, directState]);

  const effectiveVideoId = videoId || player.current?.videoId;

  const handleGainChange = (index: number, val: number) => {
    const next = [...eqState.gains10];
    next[index] = val;
    const nextState: YoutubeEqState = {
      ...eqState,
      gains10: next,
      preset: "custom",
    };
    setEqState(nextState);
    saveYoutubeEqState(nextState);
    youtubeEqEngineSingleton.updateGains(next, nextState.enabled);
    directStreamPlayerSingleton.applyGains(next, nextState.enabled);
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(next));
    } catch {}
  };

  const handlePresetSelect = (presetId: string) => {
    const found = YOUTUBE_EQ_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    const nextState: YoutubeEqState = {
      ...eqState,
      preset: found.id,
      gains10: [...found.gains10],
    };
    setEqState(nextState);
    saveYoutubeEqState(nextState);
    youtubeEqEngineSingleton.updateGains(found.gains10, nextState.enabled);
    directStreamPlayerSingleton.applyGains(found.gains10, nextState.enabled);
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(found.gains10));
    } catch {}
    toast(`Preset ${found.label} diterapkan.`, "success");
  };

  const handleReset = () => {
    handlePresetSelect("flat");
  };

  const handleToggleEnable = () => {
    const next = !eqState.enabled;
    const nextState = { ...eqState, enabled: next };
    setEqState(nextState);
    saveYoutubeEqState(nextState);
    setGlobalEqSync(next);
    youtubeEqEngineSingleton.updateGains(eqState.gains10, next);
    directStreamPlayerSingleton.applyGains(eqState.gains10, next);
    if (!next) {
      directStreamPlayerSingleton.pause();
    }
    toast(
      next
        ? "Equalizer 10-Band diaktifkan & disinkronkan!"
        : "Bypass EQ: Memutar audio asli YouTube bawaan.",
      next ? "success" : "info"
    );
  };



  const handleOpenSystemPanel = async () => {
    toast("Membuka panel equalizer sistem ponsel...", "info");
    const ok = await openSystemEqualizerPanel();
    if (!ok) {
      toast("Panel equalizer sistem tidak didukung di perangkat ini.", "error");
    }
  };

  const handleConnectTab = async () => {
    if (isTabConnected) {
      youtubeEqEngineSingleton.disconnect();
      return;
    }

    setIsConnecting(true);
    try {
      toast("Pilih tab browser MusikKu/YouTube ini di jendela pop-up dan pastikan centang 'Bagikan audio tab'.", "info");
      await youtubeEqEngineSingleton.connectTabAudio(eqState.gains10, eqState.preamp);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error?.name === "NotAllowedError") {
        toast("Koneksi audio tab dibatalkan pengguna.", "info");
      } else {
        toast(error?.message || "Gagal menghubungkan audio tab.", "error");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-md transition-all shadow-xl ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-md shadow-violet-500/20">
            <Sliders className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold text-white sm:text-base">
                YouTube EQ <span className="text-violet-400 font-mono text-xs font-normal">(Equalizer)</span>
              </h2>
              {isAndroid ? (
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Smartphone className="size-3 text-blue-400" />
                  ANDROID HARDWARE DSP EQ
                </span>
              ) : eqState.enabled ? (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  10-BAND EQ AKTIF
                </span>
              ) : (
                <span className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-[10px] font-bold text-zinc-400 border border-white/10 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-zinc-500" />
                  AUDIO ASLI YOUTUBE (BYPASS)
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              {isAndroid
                ? "Atur 10-band frekuensi langsung ke DSP suara Android — tanpa diblokir YouTube"
                : "Kustomisasi bass boost, frekuensi 10-band & audio visualizer YouTube"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Buka Panel HP jika di Android */}
          {isAndroid && (
            <button
              onClick={handleOpenSystemPanel}
              title="Buka Panel Equalizer Bawaan HP (Dolby Atmos / SoundAlive / Mi Sound)"
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600/20 px-2.5 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-600/30 transition cursor-pointer"
            >
              <Settings className="size-3.5 text-blue-400" />
              <span>Panel HP</span>
            </button>
          )}

          {/* Tombol Sambungkan Audio Tab untuk Desktop */}
          {!isAndroid && (
            <button
              onClick={handleConnectTab}
              disabled={isConnecting}
              title="Sambungkan audio tab browser langsung ke Equalizer Web Audio tanpa perlu proxy"
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isTabConnected
                  ? "border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                  : "border-fuchsia-500/30 bg-fuchsia-600/15 text-fuchsia-200 hover:bg-fuchsia-600/25"
              }`}
            >
              <Volume2 className="size-3.5 text-fuchsia-400" />
              <span className="hidden sm:inline">
                {isConnecting ? "Menghubungkan..." : isTabConnected ? "Tab Terhubung ✓" : "Sambungkan Audio Tab"}
              </span>
              <span className="sm:hidden">
                {isTabConnected ? "Tab ✓" : "Tab Audio"}
              </span>
            </button>
          )}

          {/* Master Power / Bypass */}
          <button
            onClick={handleToggleEnable}
            title={eqState.enabled ? "Bypass Equalizer: Beralih ke audio asli YouTube" : "Aktifkan Equalizer 10-Band"}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              eqState.enabled
                ? "border-violet-500/40 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 shadow-xs shadow-violet-500/30"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Power className={`size-3.5 ${eqState.enabled ? "text-violet-400" : "text-zinc-500"}`} />
            <span>{eqState.enabled ? "Bypass EQ" : "Aktifkan EQ"}</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <span>{isOpen ? "Sembunyikan" : "Buka EQ"}</span>
            {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Equalizer Body */}
      {isOpen && (
        <div className="border-t border-white/10 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
          {!isTabConnected && !isAndroid && directState !== "playing" && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-violet-500/30 bg-violet-950/30 p-3 text-xs text-zinc-300">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="size-4 text-violet-400 shrink-0" />
                <span className="text-[11px] sm:text-xs">
                  Audio YouTube saat ini diputar melalui pemutar resmi. Untuk memfilter suara secara live di PC/Laptop dengan Web Audio EQ, klik <strong>Sambungkan Audio Tab</strong>.
                </span>
              </div>
              <button
                onClick={handleConnectTab}
                disabled={isConnecting}
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:brightness-110 transition cursor-pointer shrink-0"
              >
                {isConnecting ? "Menghubungkan..." : "Sambungkan Audio Tab"}
              </button>
            </div>
          )}

          {/* Real-time Spectrum Visualizer */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 p-3 flex flex-col justify-between h-28 w-full">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 font-bold">
                <Sparkles className="size-3 text-fuchsia-400" />
                AUDIO SPECTRUM VISUALIZER
              </span>
              <span className="text-zinc-500">
                WEB AUDIO REAL-TIME FFT SPECTRUM
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={70}
              className="w-full h-16 rounded mt-1"
            />
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-violet-400" />
                <span>PRESET SUARA:</span>
                <span className="text-white uppercase font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded">
                  {eqState.preset}
                </span>
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Reset Flat (0 dB)</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {YOUTUBE_EQ_PRESETS.map((p) => {
                const isSelected = eqState.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-500/30"
                        : "border border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10-Band Sliders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span>FREKUENSI 10-BAND (-12 dB s/d +12 dB)</span>
              <span className="text-[11px] text-zinc-500">Klik dua kali slider untuk reset ke 0 dB</span>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 pt-2">
              {YOUTUBE_EQ_10_BANDS.map((band, idx) => {
                const gain = eqState.gains10[idx] ?? 0;
                return (
                  <div
                    key={band.freq}
                    className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-black/40 p-2 py-3"
                  >
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        gain > 0
                          ? "text-fuchsia-400"
                          : gain < 0
                          ? "text-blue-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {gain > 0 ? `+${gain}` : gain}
                    </span>

                    <div className="relative flex h-36 w-6 items-center justify-center">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={gain}
                        onDoubleClick={() => handleGainChange(idx, 0)}
                        onChange={(e) => handleGainChange(idx, Number(e.target.value))}
                        style={{ writingMode: "vertical-lr", direction: "rtl" }}
                        className="h-32 w-1.5 cursor-pointer rounded-full bg-zinc-800 accent-fuchsia-500 hover:accent-violet-400 transition"
                      />
                    </div>

                    <div className="text-center">
                      <span className="block font-mono text-[10px] font-semibold text-zinc-400">
                        {band.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
