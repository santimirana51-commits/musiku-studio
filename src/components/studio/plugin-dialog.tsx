"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Music,
  Plus,
  Trash2,
  Power,
  Cpu,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type {
  StudioProject,
  StudioTrack,
  PluginInstance,
  SynthSettings,
  Vst3PluginDescriptor,
} from "@/lib/studio/types";
import { SYNTH_PRESETS } from "@/lib/studio/synth";
import { INTERNAL_EFFECTS_CATALOG } from "@/lib/studio/effects";
import { isNativeVst3Supported, scanVst3Plugins } from "@/lib/studio/vst3-bridge";

interface PluginDialogProps {
  trackId: string; // "master" or track ID
  project: StudioProject;
  onClose: () => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onUpdatePluginParam: (trackId: string, pluginId: string, paramId: string, val: number) => void;
  onTogglePluginBypass: (trackId: string, pluginId: string, bypassed: boolean) => void;
  onAddPlugin: (trackId: string, pluginDefId: string) => void;
  onRemovePlugin: (trackId: string, pluginInstanceId: string) => void;
}

export function PluginDialog({
  trackId,
  project,
  onClose,
  onUpdateTrack,
  onUpdatePluginParam,
  onTogglePluginBypass,
  onAddPlugin,
  onRemovePlugin,
}: PluginDialogProps) {
  const isMaster = trackId === "master";
  const bus = !isMaster ? project.buses?.find((b) => b.id === trackId) : null;
  const track = isMaster || bus ? null : project.tracks.find((t) => t.id === trackId);
  const plugins = isMaster
    ? project.masterTrack.plugins
    : bus
    ? bus.plugins
    : track?.plugins || [];

  const [activeTab, setActiveTab] = useState<"effects" | "synth" | "vst3">(
    !isMaster && !bus && track?.type === "midi" ? "synth" : "effects"
  );

  const [vst3List, setVst3List] = useState<Vst3PluginDescriptor[]>([]);
  const [scanningVst3, setScanningVst3] = useState(false);
  const hasVst3Support = isNativeVst3Supported();

  useEffect(() => {
    if (hasVst3Support) {
      scanVst3Plugins().then(setVst3List);
    }
  }, [hasVst3Support]);

  const handleScanVst3 = async () => {
    setScanningVst3(true);
    const res = await scanVst3Plugins();
    setVst3List(res);
    setScanningVst3(false);
  };

  const synth = track?.synthSettings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm select-none">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-white/10 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-600/30 text-violet-300">
              <Sliders className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isMaster
                  ? "Master Bus Inserts & Processing"
                  : bus
                  ? `Subgroup Bus Inserts — ${bus.name}`
                  : `Inspector — ${track?.name}`}
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">
                {isMaster
                  ? "Stereo Output Chain"
                  : bus
                  ? "Submix Bus Audio Processing"
                  : `${track?.type.toUpperCase()} Track Processing`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab navigation */}
            {!isMaster && track?.type === "midi" && (
              <button
                onClick={() => setActiveTab("synth")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  activeTab === "synth" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Synthesizer
              </button>
            )}
            <button
              onClick={() => setActiveTab("effects")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === "effects" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Efek ({plugins.length})
            </button>
            <button
              onClick={() => setActiveTab("vst3")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === "vst3" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              VST3 Desktop
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: SYNTHESIZER (MIDI TRACKS) */}
          {activeTab === "synth" && synth && (
            <div className="space-y-4">
              {/* Presets Selector Card */}
              <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">
                      Instrument Sound Presets
                    </h3>
                  </div>
                  <select
                    onChange={(e) => {
                      const preset = SYNTH_PRESETS.find((p) => p.id === e.target.value);
                      if (preset) {
                        onUpdateTrack(trackId, { synthSettings: { ...preset.settings } });
                      }
                    }}
                    defaultValue=""
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500 hover:border-white/20 transition cursor-pointer"
                  >
                    <option value="" disabled>
                      Pilih Preset Instrumen...
                    </option>
                    {SYNTH_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.category.toUpperCase()}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Pilih preset instrumen siap pakai untuk langsung mengatur osilator, filter cutoff, dan ADSR envelope.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">
                  PolySynth Oscillator & Waveform
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {(["sine", "square", "sawtooth", "triangle"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, waveform: w },
                        })
                      }
                      className={`rounded-xl border py-2 text-xs font-bold uppercase transition ${
                        synth.waveform === w
                          ? "border-violet-500 bg-violet-600/30 text-white shadow"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* ADSR Envelope Controls */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
                  ADSR Amplitude Envelope
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">ATTACK ({synth.attack.toFixed(2)}s)</label>
                    <input
                      type="range"
                      min={0.001}
                      max={1.5}
                      step={0.01}
                      value={synth.attack}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, attack: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-fuchsia-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">DECAY ({synth.decay.toFixed(2)}s)</label>
                    <input
                      type="range"
                      min={0.01}
                      max={1.5}
                      step={0.01}
                      value={synth.decay}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, decay: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-fuchsia-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">SUSTAIN ({Math.round(synth.sustain * 100)}%)</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={synth.sustain}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, sustain: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-fuchsia-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">RELEASE ({synth.release.toFixed(2)}s)</label>
                    <input
                      type="range"
                      min={0.01}
                      max={3.0}
                      step={0.05}
                      value={synth.release}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, release: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-fuchsia-500"
                    />
                  </div>
                </div>
              </div>

              {/* Lowpass Filter Cutoff & Resonance */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-pink-300">
                  Resonant Lowpass Filter
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">CUTOFF ({Math.round(synth.filterCutoff)} Hz)</label>
                    <input
                      type="range"
                      min={50}
                      max={16000}
                      step={50}
                      value={synth.filterCutoff}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, filterCutoff: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-mono">RESONANCE Q ({synth.filterResonance.toFixed(1)})</label>
                    <input
                      type="range"
                      min={0.1}
                      max={15}
                      step={0.1}
                      value={synth.filterResonance}
                      onChange={(e) =>
                        onUpdateTrack(trackId, {
                          synthSettings: { ...synth, filterResonance: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full accent-pink-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERNAL EFFECTS RACK */}
          {activeTab === "effects" && (
            <div className="space-y-4">
              {/* Add Effect Dropdown */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="text-xs font-bold text-zinc-300">Tambah Efek Internal:</span>
                <div className="flex items-center gap-2">
                  <select
                    id="add-effect-select"
                    className="rounded-lg bg-charcoal border border-white/10 px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    {INTERNAL_EFFECTS_CATALOG.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const select = document.getElementById("add-effect-select") as HTMLSelectElement;
                      if (select) onAddPlugin(trackId, select.value);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white hover:bg-violet-500 transition"
                  >
                    <Plus className="size-3" />
                    <span>Sisipkan</span>
                  </button>
                </div>
              </div>

              {/* Plugin List Cards */}
              {plugins.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500">
                  Belum ada efek insert pada channel ini. Tambahkan efek di atas.
                </div>
              ) : (
                plugins.map((plug) => {
                  const def = INTERNAL_EFFECTS_CATALOG.find((d) => d.id === plug.pluginId);
                  return (
                    <div
                      key={plug.id}
                      className={`rounded-2xl border p-4 space-y-3 transition ${
                        plug.enabled
                          ? "border-white/10 bg-white/5"
                          : "border-white/5 bg-white/[0.02] opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onTogglePluginBypass(trackId, plug.id, plug.enabled)}
                            title={plug.enabled ? "Bypass Efek" : "Aktifkan Efek"}
                            className={`rounded-lg p-1.5 transition ${
                              plug.enabled
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            <Power className="size-3.5" />
                          </button>
                          <span className="font-bold text-white text-xs">{plug.name}</span>
                        </div>

                        <button
                          onClick={() => onRemovePlugin(trackId, plug.id)}
                          className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {/* Parameters Sliders */}
                      {def?.parameters && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                          {def.parameters.map((param) => {
                            const val = plug.parameters[param.id] ?? param.defaultValue;
                            return (
                              <div key={param.id} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                                  <span>{param.name}</span>
                                  <span className="text-white font-bold">
                                    {val.toFixed(2)} {param.unit || ""}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={param.min}
                                  max={param.max}
                                  step={(param.max - param.min) / 100}
                                  value={val}
                                  disabled={!plug.enabled}
                                  onChange={(e) =>
                                    onUpdatePluginParam(trackId, plug.id, param.id, parseFloat(e.target.value))
                                  }
                                  className="w-full accent-violet-500 cursor-pointer"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: VST3 PLUGINS (WINDOWS HOST) */}
          {activeTab === "vst3" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-indigo-400" />
                  <h3 className="font-bold text-white text-sm">Host Plugin VST3 Eksternal (Windows)</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  MusikKu Studio mendukung pemindaian dan pemuatan plugin VST3 (.vst3 DLL) yang terpasang secara lokal di sistem operasi Windows.
                </p>

                {hasVst3Support ? (
                  <div className="pt-2">
                    <button
                      onClick={handleScanVst3}
                      disabled={scanningVst3}
                      className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition"
                    >
                      <RefreshCw className={`size-3.5 ${scanningVst3 ? "animate-spin" : ""}`} />
                      <span>{scanningVst3 ? "Memindai Direktori VST3..." : "Pindai Plugin VST3 Komputer"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200 text-xs">
                    <AlertCircle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300">Batasan Platform Jujur:</p>
                      <p className="text-amber-300/80 mt-0.5">
                        Anda saat ini menjalankan MusikKu pada peramban Web/Android. Plugin binary VST3 membutuhkan sistem host desktop Windows (Tauri 2).
                        Proyek yang memakai VST3 tetap dapat dibuka di sini tanpa merusak parameter audio.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* VST3 Plugin List */}
              {hasVst3Support && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-300">Daftar Plugin VST3 Terdeteksi ({vst3List.length}):</span>
                  {vst3List.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-4 border border-dashed border-white/10 rounded-xl text-center">
                      Belum ada plugin VST3 terdeteksi di %CommonProgramFiles%/VST3. Klik tombol pindai di atas.
                    </p>
                  ) : (
                    vst3List.map((p) => (
                      <div key={p.uid} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                        <div>
                          <span className="font-bold text-white text-xs">{p.name}</span>
                          <span className="block text-[10px] text-zinc-400">{p.vendor} • {p.category}</span>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          Siap Digunakan
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
