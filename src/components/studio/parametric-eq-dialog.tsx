"use client";

import React, { useState } from "react";
import {
  X,
  Sliders,
  Activity,
  Flame,
  Shield,
  Zap,
  Repeat,
  RotateCcw,
  Volume2,
  Sparkles,
} from "lucide-react";
import type { StudioTrack, ChannelStripSettings, ChannelStripEqBand } from "@/lib/studio/types";
import {
  DEFAULT_CHANNEL_STRIP_SETTINGS,
  sanitizeChannelStripSettings,
} from "@/lib/studio/channel-strip";

interface ParametricEqDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: StudioTrack;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
}

export function ParametricEqDialog({
  isOpen,
  onClose,
  track,
  onUpdateTrack,
}: ParametricEqDialogProps) {
  if (!isOpen) return null;

  const current = sanitizeChannelStripSettings(track.channelStrip);

  const updateSettings = (updates: Partial<ChannelStripSettings>) => {
    const next = { ...current, ...updates };
    onUpdateTrack(track.id, { channelStrip: next });
  };

  const updateParametricBand = (
    bandKey: "parametricLow" | "parametricMid1" | "parametricMid2" | "parametricHigh",
    bandUpdates: Partial<ChannelStripEqBand>
  ) => {
    const existing = current[bandKey] || DEFAULT_CHANNEL_STRIP_SETTINGS[bandKey]!;
    updateSettings({
      [bandKey]: { ...existing, ...bandUpdates },
    });
  };

  // Generate SVG curve points across log frequency space (20Hz to 20kHz)
  const renderCurvePath = () => {
    const width = 500;
    const height = 140;
    const minFreqLog = Math.log10(20);
    const maxFreqLog = Math.log10(20000);

    const freqToX = (freq: number) => {
      const log = Math.log10(Math.max(20, Math.min(20000, freq)));
      return ((log - minFreqLog) / (maxFreqLog - minFreqLog)) * width;
    };

    const dbToY = (db: number) => {
      // Map +15dB to y=10, -15dB to y=130, 0dB to y=70
      const clamped = Math.max(-18, Math.min(18, db));
      return 70 - (clamped / 15) * 55;
    };

    const points: string[] = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const logFreq = minFreqLog + (i / steps) * (maxFreqLog - minFreqLog);
      const freq = Math.pow(10, logFreq);

      let totalDb = current.preGain || 0;

      if (current.eqEnabled) {
        if (current.eqMode === "parametric") {
          // Low band
          const pLow = current.parametricLow!;
          if (pLow.gain !== 0) {
            const ratio = freq / pLow.freq;
            const factor = pLow.mode === "bell" ? Math.exp(-Math.pow(Math.log2(ratio), 2)) : 1 / (1 + Math.pow(ratio, 2));
            totalDb += pLow.gain * factor;
          }
          // Mid 1 band
          const pMid1 = current.parametricMid1!;
          if (pMid1.gain !== 0) {
            const ratio = freq / pMid1.freq;
            const qFactor = Math.max(0.5, pMid1.q ?? 1.0);
            const factor = Math.exp(-Math.pow(Math.log2(ratio) * qFactor, 2));
            totalDb += pMid1.gain * factor;
          }
          // Mid 2 band
          const pMid2 = current.parametricMid2!;
          if (pMid2.gain !== 0) {
            const ratio = freq / pMid2.freq;
            const qFactor = Math.max(0.5, pMid2.q ?? 1.0);
            const factor = Math.exp(-Math.pow(Math.log2(ratio) * qFactor, 2));
            totalDb += pMid2.gain * factor;
          }
          // High band
          const pHigh = current.parametricHigh!;
          if (pHigh.gain !== 0) {
            const ratio = pHigh.freq / freq;
            const factor = pHigh.mode === "bell" ? Math.exp(-Math.pow(Math.log2(freq / pHigh.freq), 2)) : 1 / (1 + Math.pow(ratio, 2));
            totalDb += pHigh.gain * factor;
          }
        } else {
          // 3-band mode
          if (current.eqLow !== 0) {
            const ratio = freq / 100;
            totalDb += current.eqLow / (1 + Math.pow(ratio, 2));
          }
          if (current.eqMid !== 0) {
            const ratio = freq / 1000;
            totalDb += current.eqMid * Math.exp(-Math.pow(Math.log2(ratio), 2));
          }
          if (current.eqHigh !== 0) {
            const ratio = 8000 / freq;
            totalDb += current.eqHigh / (1 + Math.pow(ratio, 2));
          }
        }
      }

      const x = (i / steps) * width;
      const y = dbToY(totalDb);
      points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    return points.join(" ");
  };

  const resetFlat = () => {
    updateSettings({
      preGain: 0,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      parametricLow: { ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricLow!, gain: 0 },
      parametricMid1: { ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricMid1!, gain: 0 },
      parametricMid2: { ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricMid2!, gain: 0 },
      parametricHigh: { ...DEFAULT_CHANNEL_STRIP_SETTINGS.parametricHigh!, gain: 0 },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-2xl rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl text-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: track.color }}
            />
            <Sliders className="size-4 text-violet-400" />
            <span className="font-bold text-white text-sm">
              Mixcraft 10 Channel Strip & Parametric EQ
            </span>
            <span className="text-[11px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-white/10">
              Track: {track.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetFlat}
              title="Reset EQ & PreGain ke Flat (0 dB)"
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-white/20 hover:text-white transition"
            >
              <RotateCcw className="size-3" />
              <span>Reset Flat</span>
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* EQ Mode Switch & Bypass Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateSettings({ eqEnabled: !current.eqEnabled })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition border ${
                current.eqEnabled
                  ? "bg-violet-600/30 border-violet-500 text-violet-200"
                  : "bg-white/5 border-white/10 text-zinc-500"
              }`}
            >
              <Zap className="size-3" />
              <span>EQ {current.eqEnabled ? "ENGAGED" : "BYPASSED"}</span>
            </button>
            <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5">
              <button
                onClick={() => updateSettings({ eqMode: "3band" })}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  current.eqMode !== "parametric"
                    ? "bg-violet-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                3-Band Basic
              </button>
              <button
                onClick={() => updateSettings({ eqMode: "parametric" })}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  current.eqMode === "parametric"
                    ? "bg-violet-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                4-Band Parametric (Hlm. 370)
              </button>
            </div>
          </div>

          {/* Pre-Gain Trim (-15 to +15 dB, Hlm. 368) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-400 font-mono">Pre-Gain:</span>
            <input
              type="range"
              min={-15}
              max={15}
              step={0.5}
              value={current.preGain}
              onChange={(e) => updateSettings({ preGain: parseFloat(e.target.value) })}
              className="w-20 accent-violet-400 cursor-pointer h-1.5"
            />
            <span className="font-mono text-[10px] text-violet-300 w-12 text-right">
              {current.preGain > 0 ? `+${current.preGain.toFixed(1)}` : current.preGain.toFixed(1)} dB
            </span>
          </div>
        </div>

        {/* Frequency Response Graphic Canvas */}
        <div className="relative border-b border-white/10 bg-black/80 px-4 py-2">
          <svg viewBox="0 0 500 140" className="w-full h-36 overflow-visible">
            {/* Grid Lines */}
            <line x1="0" y1="15" x2="500" y2="15" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <line x1="0" y1="42.5" x2="500" y2="42.5" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <line x1="0" y1="70" x2="500" y2="70" stroke="rgba(255,255,255,0.2)" />
            <line x1="0" y1="97.5" x2="500" y2="97.5" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <line x1="0" y1="125" x2="500" y2="125" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />

            {/* Frequency Grid Lines */}
            {[50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000].map((f) => {
              const minLog = Math.log10(20);
              const maxLog = Math.log10(20000);
              const x = ((Math.log10(f) - minLog) / (maxLog - minLog)) * 500;
              return (
                <g key={f}>
                  <line x1={x} y1="0" x2={x} y2="140" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                  <text x={x} y="138" fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle" fontFamily="monospace">
                    {f >= 1000 ? `${f / 1000}k` : f}
                  </text>
                </g>
              );
            })}

            {/* Level labels */}
            <text x="4" y="18" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">+15dB</text>
            <text x="4" y="73" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">0dB</text>
            <text x="4" y="128" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">-15dB</text>

            {/* The Plot Path */}
            <path
              d={renderCurvePath()}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            />
          </svg>
        </div>

        {/* 4-Band Parametric Controls OR 3-Band Basic Controls */}
        <div className="p-4 bg-zinc-900/50">
          {current.eqMode === "parametric" ? (
            <div className="grid grid-cols-4 gap-3">
              {/* LOW BAND */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-blue-500/30 bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 font-mono text-[11px]">LOW BAND</span>
                  <button
                    onClick={() =>
                      updateParametricBand("parametricLow", {
                        mode: current.parametricLow?.mode === "bell" ? "shelf" : "bell",
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-blue-600/30 text-[9px] font-bold text-blue-300 hover:bg-blue-600/50 uppercase"
                  >
                    {current.parametricLow?.mode ?? "shelf"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Gain:</span>
                  <span className="font-mono text-white font-bold">
                    {current.parametricLow?.gain ?? 0} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.parametricLow?.gain ?? 0}
                  onChange={(e) =>
                    updateParametricBand("parametricLow", { gain: parseFloat(e.target.value) })
                  }
                  className="accent-blue-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Freq (30–450Hz):</span>
                  <span className="font-mono text-blue-300">
                    {current.parametricLow?.freq ?? 100} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={450}
                  step={5}
                  value={current.parametricLow?.freq ?? 100}
                  onChange={(e) =>
                    updateParametricBand("parametricLow", { freq: parseInt(e.target.value) })
                  }
                  className="accent-blue-400 cursor-pointer h-1.5"
                />
              </div>

              {/* MID 1 BAND */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 font-mono text-[11px]">MID 1 BAND</span>
                  <span className="text-[9px] font-mono text-zinc-400">Bell</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Gain:</span>
                  <span className="font-mono text-white font-bold">
                    {current.parametricMid1?.gain ?? 0} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.parametricMid1?.gain ?? 0}
                  onChange={(e) =>
                    updateParametricBand("parametricMid1", { gain: parseFloat(e.target.value) })
                  }
                  className="accent-cyan-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Freq (200–2500Hz):</span>
                  <span className="font-mono text-cyan-300">
                    {current.parametricMid1?.freq ?? 600} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={2500}
                  step={10}
                  value={current.parametricMid1?.freq ?? 600}
                  onChange={(e) =>
                    updateParametricBand("parametricMid1", { freq: parseInt(e.target.value) })
                  }
                  className="accent-cyan-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Q (0.5–3.0):</span>
                  <span className="font-mono text-cyan-300">
                    {current.parametricMid1?.q?.toFixed(1) ?? "1.0"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={current.parametricMid1?.q ?? 1.0}
                  onChange={(e) =>
                    updateParametricBand("parametricMid1", { q: parseFloat(e.target.value) })
                  }
                  className="accent-cyan-400 cursor-pointer h-1.5"
                />
              </div>

              {/* MID 2 BAND */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 font-mono text-[11px]">MID 2 BAND</span>
                  <span className="text-[9px] font-mono text-zinc-400">Bell</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Gain:</span>
                  <span className="font-mono text-white font-bold">
                    {current.parametricMid2?.gain ?? 0} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.parametricMid2?.gain ?? 0}
                  onChange={(e) =>
                    updateParametricBand("parametricMid2", { gain: parseFloat(e.target.value) })
                  }
                  className="accent-amber-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Freq (500–7000Hz):</span>
                  <span className="font-mono text-amber-300">
                    {current.parametricMid2?.freq ?? 2500} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={7000}
                  step={50}
                  value={current.parametricMid2?.freq ?? 2500}
                  onChange={(e) =>
                    updateParametricBand("parametricMid2", { freq: parseInt(e.target.value) })
                  }
                  className="accent-amber-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Q (0.5–3.0):</span>
                  <span className="font-mono text-amber-300">
                    {current.parametricMid2?.q?.toFixed(1) ?? "1.0"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={current.parametricMid2?.q ?? 1.0}
                  onChange={(e) =>
                    updateParametricBand("parametricMid2", { q: parseFloat(e.target.value) })
                  }
                  className="accent-amber-400 cursor-pointer h-1.5"
                />
              </div>

              {/* HIGH BAND */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-violet-500/30 bg-violet-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-400 font-mono text-[11px]">HIGH BAND</span>
                  <button
                    onClick={() =>
                      updateParametricBand("parametricHigh", {
                        mode: current.parametricHigh?.mode === "bell" ? "shelf" : "bell",
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-violet-600/30 text-[9px] font-bold text-violet-300 hover:bg-violet-600/50 uppercase"
                  >
                    {current.parametricHigh?.mode ?? "shelf"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Gain:</span>
                  <span className="font-mono text-white font-bold">
                    {current.parametricHigh?.gain ?? 0} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.parametricHigh?.gain ?? 0}
                  onChange={(e) =>
                    updateParametricBand("parametricHigh", { gain: parseFloat(e.target.value) })
                  }
                  className="accent-violet-400 cursor-pointer h-1.5"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Freq (1500–16k):</span>
                  <span className="font-mono text-violet-300">
                    {current.parametricHigh?.freq ?? 8000} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={1500}
                  max={16000}
                  step={100}
                  value={current.parametricHigh?.freq ?? 8000}
                  onChange={(e) =>
                    updateParametricBand("parametricHigh", { freq: parseInt(e.target.value) })
                  }
                  className="accent-violet-400 cursor-pointer h-1.5"
                />
              </div>
            </div>
          ) : (
            /* 3-Band Basic Mode Controls */
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-blue-500/30 bg-blue-950/20 text-center">
                <span className="font-bold text-blue-400 font-mono">LOW (100 Hz)</span>
                <span className="font-mono text-lg font-bold text-white">{current.eqLow} dB</span>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.eqLow}
                  onChange={(e) => updateSettings({ eqLow: parseFloat(e.target.value) })}
                  className="accent-blue-400 cursor-pointer h-2"
                />
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-center">
                <span className="font-bold text-cyan-400 font-mono">MID (1 kHz)</span>
                <span className="font-mono text-lg font-bold text-white">{current.eqMid} dB</span>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.eqMid}
                  onChange={(e) => updateSettings({ eqMid: parseFloat(e.target.value) })}
                  className="accent-cyan-400 cursor-pointer h-2"
                />
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-violet-500/30 bg-violet-950/20 text-center">
                <span className="font-bold text-violet-400 font-mono">HIGH (8 kHz)</span>
                <span className="font-mono text-lg font-bold text-white">{current.eqHigh} dB</span>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={current.eqHigh}
                  onChange={(e) => updateSettings({ eqHigh: parseFloat(e.target.value) })}
                  className="accent-violet-400 cursor-pointer h-2"
                />
              </div>
            </div>
          )}

          {/* Bottom Dynamics & Saturation Section (Hlm. 367–369) */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/10">
            {/* COMPRESSOR */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-emerald-400 font-bold font-mono text-[11px]">
                  <Shield className="size-3" />
                  <span>COMPRESSOR</span>
                </div>
                <button
                  onClick={() => updateSettings({ compressorEnabled: !current.compressorEnabled })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    current.compressorEnabled ? "bg-emerald-600 text-white" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {current.compressorEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Threshold Squashing:</span>
                <span className="font-mono text-emerald-300 font-bold">{current.compressorThreshold}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={current.compressorThreshold}
                onChange={(e) => updateSettings({ compressorThreshold: parseInt(e.target.value) })}
                className="accent-emerald-400 cursor-pointer h-1.5"
              />
            </div>

            {/* PREAMP DRIVE */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-rose-500/30 bg-rose-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-rose-400 font-bold font-mono text-[11px]">
                  <Flame className="size-3" />
                  <span>PREAMP DRIVE</span>
                </div>
                <button
                  onClick={() => updateSettings({ driveEnabled: !current.driveEnabled })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    current.driveEnabled ? "bg-rose-600 text-white" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {current.driveEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Saturation Warmth:</span>
                <span className="font-mono text-rose-300 font-bold">{current.driveAmount}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={current.driveAmount}
                onChange={(e) => updateSettings({ driveAmount: parseInt(e.target.value) })}
                className="accent-rose-400 cursor-pointer h-1.5"
              />
            </div>

            {/* CHANNELS UTILITY */}
            <div className="flex flex-col justify-between p-2 rounded-xl border border-white/10 bg-black/40">
              <div className="flex items-center justify-between text-zinc-300 font-bold font-mono text-[11px]">
                <span>CHANNELS UTILITY</span>
                <span className="text-[9px] text-zinc-500 font-normal">Hlm. 369</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSettings({ phaseInvert: !current.phaseInvert })}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition border ${
                    current.phaseInvert
                      ? "bg-amber-600/30 border-amber-500 text-amber-200"
                      : "bg-white/5 border-white/10 text-zinc-400"
                  }`}
                  title="Balikkan fase polaritas audio (Phase Invert)"
                >
                  Ø Phase
                </button>
                <button
                  onClick={() => updateSettings({ mono: !current.mono })}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition border ${
                    current.mono
                      ? "bg-sky-600/30 border-sky-500 text-sky-200"
                      : "bg-white/5 border-white/10 text-zinc-400"
                  }`}
                  title="Campurkan stereo menjadi mono"
                >
                  Mono
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
