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
  Activity,
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
  type YoutubeEqDiagnostics,
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
  const [isMutedOutput, setIsMutedOutput] = useState(false);
  const [directState, setDirectState] = useState<DirectPlayerState>("idle");
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [diagnostics, setDiagnostics] = useState<YoutubeEqDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsAndroid(isAndroidNative());
    setIsMobileBrowser(
      typeof navigator !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || !navigator.mediaDevices?.getDisplayMedia)
    );
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

  // Update diagnostik berkala saat panel terbuka atau tab terhubung
  useEffect(() => {
    const updateDiag = () => {
      if (isOpen || isTabConnected) {
        setDiagnostics(youtubeEqEngineSingleton.getDiagnostics());
      }
    };
    updateDiag();
    const iv = setInterval(updateDiag, 600);
    return () => clearInterval(iv);
  }, [isOpen, isTabConnected]);

  // Visualizer loop (FFT spectrum real jika ada sinyal, status standby jika hening, atau kurva respons EQ jika belum terhubung)
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

          let maxVal = 0;
          if (liveData && liveData.length > 0) {
            for (let i = 0; i < liveData.length; i++) {
              if (liveData[i] > maxVal) maxVal = liveData[i];
            }
          }
          const hasActiveSound = maxVal > 4;

          if (liveData && liveData.length > 0 && hasActiveSound) {
            // KONDISI 1: AUDIO AKTIF MEMPROSES SUARA (Live FFT Spectrum Bars)
            const barCount = 36;
            const barWidth = width / barCount - 2;
            for (let i = 0; i < barCount; i++) {
              const binIdx = Math.floor((i / barCount) * (liveData.length * 0.85));
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

              // Titik puncak (peak glow)
              if (barHeight > 8) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x, Math.max(1, y - 2), barWidth, 1.5);
              }
            }
          } else if (isTabConnected) {
            // KONDISI 2: TAB TERHUBUNG TETAPI HENING (Audio Belum Dimulai / Paused)
            phase += 0.05;
            const midY = height / 2;
            ctx.beginPath();
            ctx.strokeStyle = "rgba(234, 179, 8, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(8, midY);
            for (let x = 8; x < width - 8; x += 8) {
              const pulse = Math.sin(phase + x * 0.03) * 2;
              ctx.lineTo(x, midY + pulse);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "rgba(253, 224, 71, 0.85)";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              "Tab Terhubung — Menunggu audio YouTube diputar untuk memfilter...",
              width / 2,
              height - 8
            );
          } else {
            // KONDISI 3: BELUM TERHUBUNG (Kurva Respons Frekuensi EQ 10-Band)
            phase += 0.03;
            const pointsCount = 10;
            const points: { x: number; y: number }[] = [];

            for (let i = 0; i < pointsCount; i++) {
              const gain = eqState.enabled ? eqState.gains10[i] : 0;
              const normalized = gain / 12; // -1 to 1
              const baseY = height / 2 - normalized * (height * 0.36);
              const subtleWave = Math.sin(phase + i * 0.7) * 2;
              points.push({
                x: (i / (pointsCount - 1)) * (width - 20) + 10,
                y: Math.max(6, Math.min(height - 6, baseY + subtleWave)),
              });
            }

            // Area di bawah kurva
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
            areaGrad.addColorStop(0, "rgba(168, 85, 247, 0.2)");
            areaGrad.addColorStop(1, "rgba(236, 72, 153, 0.01)");
            ctx.fillStyle = areaGrad;
            ctx.fill();

            // Garis kurva respons
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            ctx.strokeStyle = eqState.enabled ? "#c084fc" : "#71717a";
            ctx.lineWidth = 2;
            ctx.shadowColor = eqState.enabled ? "#a855f7" : "transparent";
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = "rgba(161, 161, 170, 0.6)";
            ctx.font = "9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              eqState.enabled
                ? "Kurva Respons EQ (Klik 'Sambungkan Audio Tab' untuk live processing)"
                : "EQ Bypass — Audio asli YouTube tanpa filter",
              width / 2,
              height - 6
            );
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

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia || isMobileBrowser) {
      toast("Penangkapan audio tab hanya didukung pada peramban PC/Desktop.", "info");
      return;
    }

    setIsConnecting(true);
    try {
      directStreamPlayerSingleton.pause();
      if (!eqState.enabled) {
        const nextState = { ...eqState, enabled: true };
        setEqState(nextState);
        saveYoutubeEqState(nextState);
        setGlobalEqSync(true);
      }
      setIsMutedOutput(false);
      toast("Pilih tab browser MusikKu/YouTube ini di jendela pop-up dan pastikan centang 'Bagikan audio tab'.", "info");
      await youtubeEqEngineSingleton.connectTabAudio(eqState.gains10, eqState.preamp);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error?.name === "NotAllowedError") {
        toast("Koneksi audio tab dibatalkan pengguna.", "info");
      } else if (error?.name === "SecurityError") {
        toast("Izin penangkapan audio tab dibatasi oleh browser Anda.", "error");
      } else {
        toast(error?.message || "Gagal menghubungkan audio tab.", "error");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className={`w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-md transition-all shadow-xl ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 p-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-8 sm:size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-md shadow-violet-500/20 shrink-0">
            <Sliders className="size-4 sm:size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-base font-extrabold text-white truncate">
                YouTube EQ
              </h2>
              {isAndroid ? (
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300 border border-blue-500/30">
                  ANDROID DSP
                </span>
              ) : !eqState.enabled ? (
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[9px] font-bold text-zinc-400 border border-white/10">
                  BYPASS
                </span>
              ) : isTabConnected ? (
                diagnostics?.hasSignal ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    10-BAND EQ AKTIF
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    TAB TERHUBUNG (STANDBY)
                  </span>
                )
              ) : directState === "playing" ? (
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-300 border border-violet-500/30 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-violet-400 animate-ping" />
                  DIRECT DSP AKTIF
                </span>
              ) : (
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[9px] font-bold text-zinc-400 border border-white/10 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-zinc-500" />
                  PEMUTAR RESMI
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 hidden sm:block">
              {isAndroid
                ? "Atur 10-band frekuensi langsung ke DSP suara Android — tanpa diblokir YouTube"
                : "Kustomisasi bass boost, frekuensi 10-band & visualizer audio"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tombol Buka Panel HP jika di Android */}
          {isAndroid && (
            <button
              onClick={handleOpenSystemPanel}
              title="Buka Panel Equalizer Bawaan HP (Dolby Atmos / SoundAlive / Mi Sound)"
              className="flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-600/20 px-2 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-600/30 transition cursor-pointer"
            >
              <Settings className="size-3.5 text-blue-400" />
              <span className="hidden sm:inline">Panel HP</span>
            </button>
          )}

          {/* Tombol Sambungkan Audio Tab untuk Desktop (Khusus Layar PC/Laptop) */}
          {!isAndroid && (
            <button
              onClick={handleConnectTab}
              disabled={isConnecting}
              title="Sambungkan audio tab browser langsung ke Equalizer Web Audio (Khusus Desktop/Laptop)"
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isTabConnected
                  ? "border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                  : "border-fuchsia-500/30 bg-fuchsia-600/15 text-fuchsia-200 hover:bg-fuchsia-600/25"
              }`}
            >
              <Volume2 className="size-3.5 text-fuchsia-400" />
              <span>
                {isConnecting ? "Menghubungkan..." : isTabConnected ? "Tab Terhubung ✓" : "Sambungkan Audio Tab"}
              </span>
            </button>
          )}

          {/* Tombol Anti-Gema jika terjadi double sound di desktop */}
          {isTabConnected && (
            <button
              onClick={() => {
                const nextVal = !isMutedOutput;
                setIsMutedOutput(nextVal);
                youtubeEqEngineSingleton.setOutputMuted(nextVal);
                toast(
                  nextVal
                    ? "Mode Anti-Gema Aktif: Output Web Audio dibisukan (hanya suara asli + visualizer aktif)."
                    : "Output Web Audio EQ diaktifkan ke speaker.",
                  "info"
                );
              }}
              title="Aktifkan jika browser Anda memutar suara ganda / bergema"
              className={`hidden md:inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isMutedOutput
                  ? "border-amber-500/40 bg-amber-500/20 text-amber-200"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              <span>{isMutedOutput ? "🔇 Anti-Gema: On" : "🔊 Anti-Gema: Off"}</span>
            </button>
          )}

          {/* Tombol Diagnostik Audio & Engine */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            title="Lihat status diagnostik Web Audio, AudioContext & Sinyal"
            className={`hidden sm:inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              showDiagnostics
                ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Activity className="size-3.5 text-cyan-400" />
            <span>Diagnostik</span>
          </button>

          {/* Master Power / Bypass */}
          <button
            onClick={handleToggleEnable}
            title={eqState.enabled ? "Bypass Equalizer: Beralih ke audio asli YouTube" : "Aktifkan Equalizer 10-Band"}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              eqState.enabled
                ? "border-violet-500/40 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 shadow-xs shadow-violet-500/30"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Power className={`size-3.5 ${eqState.enabled ? "text-violet-400" : "text-zinc-500"}`} />
            <span>{eqState.enabled ? "Bypass" : "Aktif"}</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <span className="hidden sm:inline">{isOpen ? "Sembunyikan" : "Buka EQ"}</span>
            <span className="sm:hidden">{isOpen ? "Tutup" : "EQ"}</span>
            {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Equalizer Body */}
      {isOpen && (
        <div className="w-full max-w-full min-w-0 overflow-hidden border-t border-white/10 p-3 sm:p-5 space-y-3.5 animate-in fade-in duration-200">
          {/* Banner Diagnostik Web Audio & Sinyal */}
          {showDiagnostics && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-cyan-400" />
                  DIAGNOSTIK WEB AUDIO & CAPTURE
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Engine: {diagnostics?.isConnected ? "TERKONEKSI" : "STANDBY"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-black/40 border border-white/5 p-2">
                  <span className="text-zinc-400 block text-[10px]">AudioContext</span>
                  <span
                    className={`font-mono font-bold ${
                      diagnostics?.audioContextState === "running" ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {diagnostics?.audioContextState || "none"} (
                    {diagnostics?.sampleRate ? `${diagnostics.sampleRate} Hz` : "-"})
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/5 p-2">
                  <span className="text-zinc-400 block text-[10px]">Audio Track</span>
                  <span className="font-mono font-bold text-zinc-200 truncate block" title={diagnostics?.audioTrackLabel}>
                    {diagnostics?.hasAudioTrack ? `Live (${diagnostics.audioTrackCount})` : "Tidak ada"}
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/5 p-2">
                  <span className="text-zinc-400 block text-[10px]">Level Sinyal Masuk</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          (diagnostics?.signalLevel || 0) > 0
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                            : "bg-zinc-600"
                        }`}
                        style={{ width: `${diagnostics?.signalLevel || 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-zinc-300">{diagnostics?.signalLevel || 0}%</span>
                  </div>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/5 p-2">
                  <span className="text-zinc-400 block text-[10px]">Status Output</span>
                  <span
                    className={`font-mono font-bold ${
                      diagnostics?.isOutputMuted ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {diagnostics?.isOutputMuted ? "Bisu (Visual Saja)" : "Aktif ke Speaker"}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-zinc-400 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-white/5">
                <span>
                  Rantai Pemrosesan: <code>Source → Preamp → 10 Biquad Filters → Analyser → Output</code>
                </span>
                <span>
                  Penekanan Audio Tab Lokal:{" "}
                  {diagnostics?.suppressLocalPlaybackSupported ? "Didukung Browser ✓" : "Standard"}
                </span>
              </div>
            </div>
          )}

          {/* Alert jika Anti-Gema Aktif */}
          {isTabConnected && isMutedOutput && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-xs text-amber-200">
              <Info className="size-4 shrink-0 text-amber-400" />
              <span>
                <strong>Mode Anti-Gema Aktif:</strong> Output Web Audio dibisukan ke speaker. Visualizer tetap bereaksi, namun perubahan slider EQ tidak terdengar ke speaker. Matikan Anti-Gema di atas untuk mendengar efek EQ.
              </span>
            </div>
          )}

          {!isTabConnected && !isAndroid && !isMobileBrowser && directState !== "playing" && (
            <div className="hidden md:flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-violet-500/30 bg-violet-950/30 p-3 text-xs text-zinc-300">
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
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 p-2.5 sm:p-3 flex flex-col justify-between h-20 sm:h-28 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1 font-bold">
                <Sparkles className="size-3 text-fuchsia-400" />
                AUDIO SPECTRUM VISUALIZER
              </span>
              <span className="text-zinc-500 hidden sm:inline">
                WEB AUDIO REAL-TIME FFT SPECTRUM
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={70}
              className="w-full max-w-full h-12 sm:h-16 rounded mt-1"
            />
          </div>

          {/* Preset Buttons: Horizontal Swipeable on Mobile, Wrap on Desktop */}
          <div className="space-y-1.5 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-violet-400" />
                <span className="text-[11px] sm:text-xs">PRESET:</span>
                <span className="text-white uppercase font-mono text-[10px] sm:text-[11px] bg-white/10 px-2 py-0.5 rounded">
                  {eqState.preset}
                </span>
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Reset (0 dB)</span>
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar sm:flex-wrap w-full max-w-full min-w-0 touch-pan-x overscroll-contain">
              {YOUTUBE_EQ_PRESETS.map((p) => {
                const isSelected = eqState.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold shrink-0 transition cursor-pointer ${
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

          {/* 10-Band Sliders: Horizontal Swipeable on Mobile, 10 Columns on Desktop */}
          <div className="space-y-1.5 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="text-[10px] sm:text-xs">FREKUENSI 10-BAND (-12 dB s/d +12 dB)</span>
              <span className="text-[9px] sm:text-[11px] text-zinc-500">Klik 2x slider untuk 0 dB</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar sm:grid sm:grid-cols-10 w-full max-w-full min-w-0 touch-pan-x overscroll-contain">
              {YOUTUBE_EQ_10_BANDS.map((band, idx) => {
                const gain = eqState.gains10[idx] ?? 0;
                return (
                  <div
                    key={band.freq}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-black/40 p-2 py-2 min-w-[54px] flex-1 sm:min-w-0"
                  >
                    <span
                      className={`font-mono text-[10px] sm:text-[11px] font-bold ${
                        gain > 0
                          ? "text-fuchsia-400"
                          : gain < 0
                          ? "text-blue-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {gain > 0 ? `+${gain}` : gain}
                    </span>

                    <div className="relative flex h-24 sm:h-36 w-6 items-center justify-center">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={gain}
                        onDoubleClick={() => handleGainChange(idx, 0)}
                        onChange={(e) => handleGainChange(idx, Number(e.target.value))}
                        style={{ writingMode: "vertical-lr", direction: "rtl" }}
                        className="h-20 sm:h-32 w-1.5 cursor-pointer rounded-full bg-zinc-800 accent-fuchsia-500 hover:accent-violet-400 transition"
                      />
                    </div>

                    <div className="text-center">
                      <span className="block font-mono text-[9px] sm:text-[10px] font-semibold text-zinc-400 whitespace-nowrap">
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
