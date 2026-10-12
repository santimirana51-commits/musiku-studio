"use client";

import React, { useState } from "react";
import {
  Volume2,
  X,
  Sliders,
  Sparkles,
  Waves,
  Clock,
  Radio,
  Plus,
  Flame,
  Shield,
  Zap,
  Power,
  Cable,
  Unplug,
  Tv,
} from "lucide-react";
import type { StudioProject, StudioTrack, SubgroupBus, LiveTabAudioState } from "@/lib/studio/types";
import { ParametricEqDialog } from "./parametric-eq-dialog";
import { sanitizeChannelStripSettings } from "@/lib/studio/channel-strip";

interface MixerProps {
  project: StudioProject;
  trackLevels: Record<string, number>;
  busLevels?: Record<string, number>;
  masterLevel: number;
  liveTabState?: LiveTabAudioState;
  liveTabLevel?: number;
  onConnectLiveTab?: () => void;
  onDisconnectLiveTab?: () => void;
  onToggleLiveTab?: () => void;
  onUpdateLiveTabVolume?: (vol: number) => void;
  onUpdateLiveTabPan?: (pan: number) => void;
  onUpdateLiveTabMute?: (mute: boolean) => void;
  onUpdateLiveTabSolo?: (solo: boolean) => void;
  onClose: () => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onUpdateBus?: (busId: string, updates: Partial<SubgroupBus>) => void;
  onAddBus?: () => void;
  onUpdateTrackSend?: (trackId: string, sendKey: "reverb" | "delay", value: number) => void;
  onUpdateMaster: (updates: { volume?: number; pan?: number }) => void;
  onOpenPluginDialog: (trackId: string) => void;
}

export function Mixer({
  project,
  trackLevels,
  busLevels,
  masterLevel,
  liveTabState,
  liveTabLevel = 0,
  onConnectLiveTab,
  onDisconnectLiveTab,
  onToggleLiveTab,
  onUpdateLiveTabVolume,
  onUpdateLiveTabPan,
  onUpdateLiveTabMute,
  onUpdateLiveTabSolo,
  onClose,
  onUpdateTrack,
  onUpdateBus,
  onAddBus,
  onUpdateTrackSend,
  onUpdateMaster,
  onOpenPluginDialog,
}: MixerProps) {
  const [auxReverbLevel, setAuxReverbLevel] = useState(0.8);
  const [auxDelayLevel, setAuxDelayLevel] = useState(0.8);
  const [activeEqTrackId, setActiveEqTrackId] = useState<string | null>(null);

  const activeEqTrack = project.tracks.find((t) => t.id === activeEqTrackId);
  const isMasterClipping = masterLevel > 0.96;

  return (
    <div className="flex h-84 flex-col border-t-2 border-white/20 bg-charcoal/98 select-none shadow-2xl z-20 font-sans">
      {/* Mixer Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="size-4 text-violet-400" />
          <span className="font-bold text-white tracking-wide">Mixer Console</span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {project.tracks.length} Channels • {project.buses?.length || 0} Subgroup Buses • 2 Aux Returns • Master Limiter
          </span>
          {onAddBus && (
            <button
              onClick={onAddBus}
              title="Tambah Subgroup Bus Baru"
              className="flex items-center gap-1 rounded bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-[10px] font-bold text-blue-300 hover:bg-blue-600/50 hover:text-white transition ml-2"
            >
              <Plus className="size-2.5" />
              <span>Add Bus</span>
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Channel Strips Horizontal Scroll Area */}
      <div className="flex flex-1 overflow-x-auto p-2.5 gap-2.5 bg-black/50">
        {/* Track Channel Strips */}
        {project.tracks.map((track) => {
          const level = trackLevels[track.id] || 0;
          const volDb =
            track.volume <= 0.0001
              ? "-inf"
              : (20 * Math.log10(track.volume)).toFixed(1);

          const reverbSend = track.sends?.reverb ?? 0.15;
          const delaySend = track.sends?.delay ?? 0.1;

          return (
            <div
              key={track.id}
              className="flex w-32 shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-card/90 p-2 shadow-sm"
              style={{ borderTop: `3px solid ${track.color}` }}
            >
              {/* Channel Label */}
              <div className="text-center">
                <span className="block text-xs font-bold text-white truncate">
                  {track.name}
                </span>
                <span className="text-[9px] uppercase font-mono text-zinc-400">
                  {track.type}
                </span>
              </div>

              {/* Inserts Rack Button */}
              <button
                onClick={() => onOpenPluginDialog(track.id)}
                title="Buka Rak Efek & Plugin"
                className="my-0.5 rounded border border-white/10 bg-white/5 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition truncate px-1"
              >
                FX ({track.plugins.length})
              </button>

              {/* Bus I/O Section: IN & OUT Routing */}
              <div className="flex flex-col gap-0.5 my-0.5 bg-black/60 p-1 rounded-lg border border-white/5">
                {/* IN: Hardware Input Channel */}
                {track.type === "audio" && (
                  <div className="flex items-center justify-between text-[8px] text-zinc-400">
                    <span className="font-mono text-zinc-500 font-bold">IN</span>
                    <select
                      value={track.inputSource || "all"}
                      onChange={(e) => onUpdateTrack(track.id, { inputSource: e.target.value })}
                      title="Kanal Input Audio (Stereo / Mono L / Mono R)"
                      className="bg-transparent text-[8px] text-zinc-300 outline-none cursor-pointer text-right font-mono truncate max-w-20"
                    >
                      <option value="all" className="bg-zinc-900">In 1/2</option>
                      <option value="input_1" className="bg-zinc-900">Ch 1 (L)</option>
                      <option value="input_2" className="bg-zinc-900">Ch 2 (R)</option>
                    </select>
                  </div>
                )}

                {/* OUT: Output Bus Destination */}
                <div className="flex items-center justify-between text-[8px] text-zinc-400">
                  <span className="font-mono text-blue-400 font-bold">BUS</span>
                  <select
                    value={track.outputBus || "master"}
                    onChange={(e) => onUpdateTrack(track.id, { outputBus: e.target.value })}
                    title="Audio Output Bus Routing (Master atau Subgroup Bus)"
                    className="bg-transparent text-[8px] font-bold text-blue-300 outline-none cursor-pointer text-right truncate max-w-20"
                  >
                    <option value="master" className="bg-zinc-900 text-white font-bold">Master</option>
                    {(project.buses || []).map((bus) => (
                      <option key={bus.id} value={bus.id} className="bg-zinc-900 text-blue-300">
                        {bus.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Channel Strip Module (Mixcraft 10 Hlm. 367–376) */}
              {(() => {
                const cs = sanitizeChannelStripSettings(track.channelStrip);
                return (
                  <div className="flex flex-col gap-0.5 my-0.5 bg-zinc-950/80 p-1 rounded-lg border border-white/5">
                    {/* Header Row: Pre-Gain & EQ Popover Trigger */}
                    <div className="flex items-center justify-between text-[8px]">
                      <span className="font-mono text-zinc-400 font-bold">STRIP</span>
                      <button
                        onClick={() => setActiveEqTrackId(track.id)}
                        title="Buka 4-Band Parametric EQ & Channel Strip Detail (Hlm. 370)"
                        className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold transition border ${
                          cs.eqEnabled
                            ? "bg-violet-600/30 border-violet-500/50 text-violet-300"
                            : "bg-white/5 border-white/10 text-zinc-500"
                        }`}
                      >
                        <Zap className="size-2" />
                        <span>EQ {cs.eqMode === "parametric" ? "PAR" : "3B"}</span>
                      </button>
                    </div>

                    {/* Pre-Gain Slider */}
                    <div className="flex items-center justify-between text-[8px] text-zinc-400">
                      <span className="font-mono text-[7px] text-zinc-500">GAIN</span>
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        step={0.5}
                        value={cs.preGain}
                        onChange={(e) =>
                          onUpdateTrack(track.id, {
                            channelStrip: { ...cs, preGain: parseFloat(e.target.value) },
                          })
                        }
                        title={`Initial Pre-Gain Trim: ${cs.preGain} dB`}
                        className="w-12 accent-violet-400 cursor-pointer h-1"
                      />
                      <span className="font-mono text-[7px] w-4 text-right">
                        {cs.preGain > 0 ? `+${Math.round(cs.preGain)}` : Math.round(cs.preGain)}
                      </span>
                    </div>

                    {/* Comp & Drive Row */}
                    <div className="flex items-center gap-1 pt-0.5 border-t border-white/5">
                      {/* Comp Quick Toggle */}
                      <button
                        onClick={() =>
                          onUpdateTrack(track.id, {
                            channelStrip: {
                              ...cs,
                              compressorEnabled: !cs.compressorEnabled,
                              compressorThreshold: cs.compressorThreshold || 40,
                            },
                          })
                        }
                        title={`One-Knob Compressor: ${cs.compressorEnabled ? `${cs.compressorThreshold}% Squashing` : "Bypassed"}`}
                        className={`flex-1 flex items-center justify-center gap-0.5 py-0.5 rounded text-[8px] font-bold border transition ${
                          cs.compressorEnabled
                            ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
                            : "bg-white/5 border-white/10 text-zinc-500 hover:text-white"
                        }`}
                      >
                        <Shield className="size-2" />
                        <span>CMP</span>
                      </button>

                      {/* Drive Quick Toggle */}
                      <button
                        onClick={() =>
                          onUpdateTrack(track.id, {
                            channelStrip: {
                              ...cs,
                              driveEnabled: !cs.driveEnabled,
                              driveAmount: cs.driveAmount || 35,
                            },
                          })
                        }
                        title={`Preamp Saturation: ${cs.driveEnabled ? `${cs.driveAmount}% Warmth` : "Bypassed"}`}
                        className={`flex-1 flex items-center justify-center gap-0.5 py-0.5 rounded text-[8px] font-bold border transition ${
                          cs.driveEnabled
                            ? "bg-rose-600/30 border-rose-500/50 text-rose-300"
                            : "bg-white/5 border-white/10 text-zinc-500 hover:text-white"
                        }`}
                      >
                        <Flame className="size-2" />
                        <span>DRV</span>
                      </button>

                      {/* Phase Invert Toggle */}
                      <button
                        onClick={() =>
                          onUpdateTrack(track.id, {
                            channelStrip: {
                              ...cs,
                              phaseInvert: !cs.phaseInvert,
                            },
                          })
                        }
                        title="Phase Invert (Ø)"
                        className={`p-0.5 rounded text-[8px] font-bold border transition ${
                          cs.phaseInvert
                            ? "bg-amber-600/30 border-amber-500/50 text-amber-300"
                            : "bg-white/5 border-white/10 text-zinc-500"
                        }`}
                      >
                        Ø
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Aux Sends Knobs Section */}
              <div className="flex flex-col gap-1 py-1 px-1 bg-black/40 rounded-lg border border-white/5 my-0.5">
                {/* Reverb Send */}
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span className="flex items-center gap-0.5 text-cyan-400 font-mono">
                    <Sparkles className="size-2.5" /> REV
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={reverbSend}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const nextSends = { ...(track.sends || {}), reverb: val };
                      onUpdateTrack(track.id, { sends: nextSends });
                      onUpdateTrackSend?.(track.id, "reverb", val);
                    }}
                    title={`Reverb Send: ${Math.round(reverbSend * 100)}%`}
                    className="w-14 accent-cyan-400 cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-[8px] w-5 text-right">{Math.round(reverbSend * 100)}%</span>
                </div>

                {/* Delay Send */}
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span className="flex items-center gap-0.5 text-indigo-400 font-mono">
                    <Clock className="size-2.5" /> DLY
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={delaySend}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const nextSends = { ...(track.sends || {}), delay: val };
                      onUpdateTrack(track.id, { sends: nextSends });
                      onUpdateTrackSend?.(track.id, "delay", val);
                    }}
                    title={`Delay Send: ${Math.round(delaySend * 100)}%`}
                    className="w-14 accent-indigo-400 cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-[8px] w-5 text-right">{Math.round(delaySend * 100)}%</span>
                </div>
              </div>

              {/* Pan Slider */}
              <div className="flex items-center justify-between px-1 py-0.5 text-[9px] text-zinc-400">
                <span className="font-mono text-[9px]">PAN</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={track.pan}
                  onChange={(e) =>
                    onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })
                  }
                  title={`Stereo Pan: ${track.pan === 0 ? "Center" : track.pan < 0 ? `L ${Math.abs(Math.round(track.pan * 100))}` : `R ${Math.round(track.pan * 100)}`}`}
                  className="w-14 accent-violet-400 cursor-pointer h-1.5"
                />
                <span className="font-mono text-[8px] text-zinc-300 w-4 text-right">
                  {track.pan === 0 ? "C" : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 50))}` : `R${Math.round(track.pan * 50)}`}
                </span>
              </div>

              {/* Fader & Meter Vertical Area */}
              <div className="flex flex-1 items-center justify-center gap-2 py-1">
                {/* Vertical Fader */}
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) =>
                    onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })
                  }
                  className="h-20 w-4 accent-violet-500 cursor-pointer"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />

                {/* Vertical VU Meter */}
                <div className="h-20 w-2.5 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                    style={{ height: `${Math.min(100, level * 100)}%` }}
                  />
                </div>
              </div>

              {/* Value display */}
              <div className="text-center font-mono text-[10px] text-zinc-300">
                {volDb} dB
              </div>

              {/* Mute, Solo, Arm */}
              <div className="mt-1 flex items-center justify-center gap-1">
                <button
                  onClick={() => onUpdateTrack(track.id, { mute: !track.mute })}
                  className={`size-5 rounded text-[9px] font-black ${
                    track.mute ? "bg-amber-500 text-black" : "bg-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  M
                </button>
                <button
                  onClick={() => onUpdateTrack(track.id, { solo: !track.solo })}
                  className={`size-5 rounded text-[9px] font-black ${
                    track.solo ? "bg-violet-500 text-white" : "bg-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  S
                </button>
                <button
                  onClick={() => onUpdateTrack(track.id, { armRecord: !track.armRecord })}
                  className={`size-5 rounded text-[9px] font-black ${
                    track.armRecord ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  R
                </button>
              </div>
            </div>
          );
        })}

        {/* --- SUBGROUP BUS CHANNELS --- */}
        {(project.buses || []).map((bus) => {
          const level = busLevels?.[bus.id] || 0;
          const volDb =
            bus.volume <= 0.0001
              ? "-inf"
              : (20 * Math.log10(bus.volume)).toFixed(1);
          const panText =
            bus.pan === 0
              ? "C"
              : bus.pan < 0
              ? `L${Math.round(Math.abs(bus.pan) * 100)}`
              : `R${Math.round(bus.pan * 100)}`;
          const routedCount = project.tracks.filter((t) => t.outputBus === bus.id).length;

          return (
            <div
              key={bus.id}
              className="flex w-28 shrink-0 flex-col justify-between rounded-xl border border-violet-500/20 bg-gradient-to-b from-card to-zinc-950 p-2 shadow-sm border-t-2 relative"
              style={{ borderTopColor: bus.color }}
            >
              {/* Header */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: bus.color }}
                  />
                  <span className="truncate text-xs font-bold text-white" title={bus.name}>
                    {bus.name}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[9px] font-mono px-1 rounded bg-white/5 text-violet-300">
                    BUS
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">
                    {routedCount} {routedCount === 1 ? "track" : "tracks"}
                  </span>
                </div>
              </div>

              {/* Bus Inserts Button */}
              <button
                onClick={() => onOpenPluginDialog(bus.id)}
                className="my-1 rounded border border-white/10 bg-white/5 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-1"
                title={`Buka FX Insert untuk ${bus.name}`}
              >
                <Sparkles className="size-2.5 text-violet-400" />
                <span>FX ({bus.plugins.length})</span>
              </button>

              {/* Pan Slider */}
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-1">
                <span>P</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={bus.pan}
                  onChange={(e) =>
                    onUpdateBus?.(bus.id, { pan: parseFloat(e.target.value) })
                  }
                  className="w-14 accent-violet-500 cursor-pointer"
                />
                <span className="w-5 text-right font-bold text-zinc-300">{panText}</span>
              </div>

              {/* Fader & Meter Vertical Area */}
              <div className="flex flex-1 items-center justify-center gap-2 py-1">
                {/* Vertical Fader */}
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  value={bus.volume}
                  onChange={(e) =>
                    onUpdateBus?.(bus.id, { volume: parseFloat(e.target.value) })
                  }
                  className="h-20 w-4 accent-violet-500 cursor-pointer"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />

                {/* Vertical VU Meter */}
                <div className="h-20 w-2.5 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                    style={{ height: `${Math.min(100, level * 100)}%` }}
                  />
                </div>
              </div>

              {/* Value display & destination */}
              <div className="text-center font-mono text-[10px] text-zinc-300">
                {volDb} dB
              </div>
              <div className="text-center text-[8px] font-mono text-zinc-500">
                → MASTER
              </div>

              {/* Mute & Solo */}
              <div className="mt-1 flex items-center justify-center gap-1">
                <button
                  onClick={() => onUpdateBus?.(bus.id, { mute: !bus.mute })}
                  className={`size-5 rounded text-[9px] font-black ${
                    bus.mute ? "bg-amber-500 text-black" : "bg-white/10 text-zinc-400 hover:text-white"
                  }`}
                  title="Mute Bus"
                >
                  M
                </button>
                <button
                  onClick={() => onUpdateBus?.(bus.id, { solo: !bus.solo })}
                  className={`size-5 rounded text-[9px] font-black ${
                    bus.solo ? "bg-violet-500 text-white" : "bg-white/10 text-zinc-400 hover:text-white"
                  }`}
                  title="Solo Bus"
                >
                  S
                </button>
              </div>
            </div>
          );
        })}

        {/* --- AUX RETURN BUS 1: REVERB --- */}
        <div className="flex w-24 shrink-0 flex-col justify-between rounded-xl border border-cyan-500/30 bg-gradient-to-b from-card to-zinc-950 p-2 shadow-sm border-t-2 border-t-cyan-400">
          <div className="text-center">
            <span className="block text-xs font-bold text-cyan-300">AUX REV</span>
            <span className="text-[9px] font-mono text-zinc-400">Reverb Bus</span>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1.5 py-1">
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.02}
              value={auxReverbLevel}
              onChange={(e) => setAuxReverbLevel(parseFloat(e.target.value))}
              className="h-20 w-3.5 accent-cyan-400 cursor-pointer"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
            <div className="h-20 w-2 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-cyan-400 to-blue-500 transition-all duration-75"
                style={{ height: `${Math.min(100, masterLevel * 0.7 * 100)}%` }}
              />
            </div>
          </div>

          <div className="text-center font-mono text-[9px] text-cyan-200">
            {Math.round(auxReverbLevel * 100)}%
          </div>
          <div className="text-center text-[8px] text-zinc-500 font-mono">
            Decay 2.2s
          </div>
        </div>

        {/* --- AUX RETURN BUS 2: DELAY --- */}
        <div className="flex w-24 shrink-0 flex-col justify-between rounded-xl border border-indigo-500/30 bg-gradient-to-b from-card to-zinc-950 p-2 shadow-sm border-t-2 border-t-indigo-400">
          <div className="text-center">
            <span className="block text-xs font-bold text-indigo-300">AUX DLY</span>
            <span className="text-[9px] font-mono text-zinc-400">Delay Bus</span>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1.5 py-1">
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.02}
              value={auxDelayLevel}
              onChange={(e) => setAuxDelayLevel(parseFloat(e.target.value))}
              className="h-20 w-3.5 accent-indigo-400 cursor-pointer"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
            <div className="h-20 w-2 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-indigo-400 to-purple-500 transition-all duration-75"
                style={{ height: `${Math.min(100, masterLevel * 0.6 * 100)}%` }}
              />
            </div>
          </div>

          <div className="text-center font-mono text-[9px] text-indigo-200">
            {Math.round(auxDelayLevel * 100)}%
          </div>
          <div className="text-center text-[8px] text-zinc-500 font-mono">
            Feedback 45%
          </div>
        </div>

        {/* --- VIRTUAL CABLE / LIVE TAB AUDIO CHANNEL STRIP (YouTube Input) --- */}
        <div
          className={`flex w-28 shrink-0 flex-col justify-between rounded-xl border p-2 shadow-sm border-t-2 transition-all ${
            liveTabState?.isConnected
              ? liveTabState.isEnabled && !liveTabState.isMuted
                ? "border-red-500/50 bg-gradient-to-b from-red-950/20 via-card to-zinc-950 border-t-red-500 shadow-red-950/30"
                : "border-red-500/20 bg-gradient-to-b from-zinc-900 via-card to-zinc-950 border-t-zinc-600 opacity-80"
              : "border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950 border-t-zinc-700"
          }`}
        >
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Tv className={`size-3 ${liveTabState?.isConnected && liveTabState.isEnabled ? "text-red-400" : "text-zinc-500"}`} />
              <span className="block text-xs font-bold text-red-300 truncate">YOUTUBE IN</span>
            </div>
            <span className="text-[8px] font-mono text-zinc-400">Virtual Cable / Tab</span>

            {/* Power Toggle Button / Connect Button */}
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {liveTabState?.isConnected ? (
                <>
                  <button
                    onClick={onToggleLiveTab}
                    title={
                      liveTabState.isEnabled
                        ? "Klik untuk Matikan Audio YouTube (Power OFF)"
                        : "Klik untuk Hidupkan Audio YouTube (Power ON)"
                    }
                    className={`flex flex-1 items-center justify-center gap-1 py-0.5 px-1 rounded text-[9px] font-bold border transition ${
                      liveTabState.isEnabled
                        ? "bg-red-600/30 text-red-200 border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white"
                    }`}
                  >
                    <Power className={`size-2.5 ${liveTabState.isEnabled ? "text-red-400 animate-pulse" : "text-zinc-500"}`} />
                    <span>{liveTabState.isEnabled ? "ON" : "OFF"}</span>
                  </button>
                  <button
                    onClick={onDisconnectLiveTab}
                    title="Putuskan sambungan tab browser"
                    className="p-1 rounded text-zinc-400 hover:text-red-300 hover:bg-white/10 transition"
                  >
                    <Unplug className="size-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={onConnectLiveTab}
                  title="Hubungkan Audio Tab YouTube (Virtual Cable)"
                  className="flex w-full items-center justify-center gap-1 py-1 px-1 rounded bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40 text-[9px] font-bold transition"
                >
                  <Cable className="size-2.5 text-red-400" />
                  <span>Connect</span>
                </button>
              )}
            </div>
          </div>

          {/* Pan Knob / Slider */}
          <div className="my-1 flex flex-col items-center">
            <span className="text-[8px] font-mono text-zinc-400">
              PAN: {liveTabState?.pan === 0 || !liveTabState?.pan ? "C" : liveTabState.pan < 0 ? `L${Math.round(Math.abs(liveTabState.pan) * 100)}` : `R${Math.round(liveTabState.pan * 100)}`}
            </span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={liveTabState?.pan ?? 0}
              disabled={!liveTabState?.isConnected}
              onChange={(e) => onUpdateLiveTabPan?.(parseFloat(e.target.value))}
              className="h-1 w-16 accent-red-500 cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Fader & VU Meter */}
          <div className="flex flex-1 items-center justify-center gap-1.5 py-1">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={liveTabState?.volume ?? 1.0}
              disabled={!liveTabState?.isConnected}
              onChange={(e) => onUpdateLiveTabVolume?.(parseFloat(e.target.value))}
              className="h-20 w-3.5 accent-red-500 cursor-pointer disabled:opacity-40"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
            <div className="h-20 w-2 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                style={{
                  height: `${
                    liveTabState?.isConnected && liveTabState.isEnabled && !liveTabState.isMuted
                      ? Math.min(100, (liveTabLevel ?? 0) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Volume dB */}
          <div className="text-center font-mono text-[9px] text-red-200">
            {liveTabState
              ? liveTabState.volume <= 0.0001
                ? "-inf dB"
                : `${(20 * Math.log10(liveTabState.volume)).toFixed(1)} dB`
              : "0.0 dB"}
          </div>
          <div className="text-center text-[8px] text-zinc-500 font-mono">
            → MASTER FX
          </div>

          {/* Mute & Solo */}
          <div className="mt-1 flex items-center justify-center gap-1">
            <button
              disabled={!liveTabState?.isConnected}
              onClick={() => onUpdateLiveTabMute?.(!liveTabState?.isMuted)}
              className={`size-5 rounded text-[9px] font-black transition ${
                liveTabState?.isMuted
                  ? "bg-amber-500 text-black shadow-sm"
                  : "bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30"
              }`}
              title="Mute Tab Audio"
            >
              M
            </button>
            <button
              disabled={!liveTabState?.isConnected}
              onClick={() => onUpdateLiveTabSolo?.(!liveTabState?.isSolo)}
              className={`size-5 rounded text-[9px] font-black transition ${
                liveTabState?.isSolo
                  ? "bg-violet-500 text-white shadow-sm"
                  : "bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30"
              }`}
              title="Solo Tab Audio"
            >
              S
            </button>
          </div>
        </div>

        {/* --- MASTER OUTPUT CHANNEL STRIP --- */}
        <div className="flex w-32 shrink-0 flex-col justify-between rounded-xl border border-pink-500/30 bg-gradient-to-b from-card to-zinc-950 p-2 shadow-md border-t-4 border-t-pink-500 ml-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="block text-xs font-black text-pink-300">MASTER</span>
              {isMasterClipping && (
                <span className="size-2 rounded-full bg-red-500 animate-ping" title="Clipping detected!" />
              )}
            </div>
            <span className="text-[9px] font-mono text-zinc-400">Main Stereo Bus</span>
          </div>

          <button
            onClick={() => onOpenPluginDialog("master")}
            className="my-1 rounded border border-pink-500/20 bg-pink-500/10 py-0.5 text-[10px] font-semibold text-pink-300 hover:bg-pink-500/20 transition truncate px-1"
          >
            Master FX ({project.masterTrack.plugins.length})
          </button>

          {/* Master Fader & Meter */}
          <div className="flex flex-1 items-center justify-center gap-2 py-1">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={project.masterTrack.volume}
              onChange={(e) => onUpdateMaster({ volume: parseFloat(e.target.value) })}
              className="h-20 w-4 accent-pink-500 cursor-pointer"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
            {/* Master Stereo Peak Meter */}
            <div className="h-20 w-3.5 rounded-full bg-black/80 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className={`w-full rounded-full transition-all duration-75 ${
                  isMasterClipping
                    ? "bg-red-500"
                    : "bg-gradient-to-t from-emerald-400 via-amber-400 to-red-500"
                }`}
                style={{ height: `${Math.min(100, masterLevel * 100)}%` }}
              />
            </div>
          </div>

          <div className="text-center font-mono text-[10px] text-pink-200">
            {project.masterTrack.volume <= 0.0001
              ? "-inf"
              : (20 * Math.log10(project.masterTrack.volume)).toFixed(1)}{" "}
            dB
          </div>

          <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-zinc-400 font-mono bg-black/40 py-0.5 rounded border border-white/5">
            <Radio className="size-2.5 text-pink-400" />
            <span>LIMIT -0.3dB</span>
          </div>
        </div>
      </div>

      {/* 4-Band Parametric EQ & Channel Strip Detail Dialog */}
      {activeEqTrack && (
        <ParametricEqDialog
          isOpen={!!activeEqTrack}
          onClose={() => setActiveEqTrackId(null)}
          track={activeEqTrack}
          onUpdateTrack={onUpdateTrack}
        />
      )}
    </div>
  );
}
