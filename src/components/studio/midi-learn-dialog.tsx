"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Radio,
  Sliders,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Disc,
  Activity,
  Layers,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  type MidiMapping,
  type MidiMessageEvent,
  type MidiCommandCategory,
  AVAILABLE_MIDI_COMMANDS,
  DEFAULT_MIDI_MAPPINGS,
  AKAI_MPK_PRESET,
  KORG_NANOKONTROL_PRESET,
  createOrUpdateMapping,
  deleteMapping,
  scaleCcToVolume,
  scaleCcToPan,
} from "@/lib/studio/midi-learn";
import { webMidiManager } from "@/lib/studio/web-midi";
import type { StudioTrack } from "@/lib/studio/types";

interface MidiLearnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: MidiMapping[];
  onUpdateMappings: (mappings: MidiMapping[]) => void;
  isLearningMode: boolean;
  onToggleLearningMode: (active: boolean) => void;
  activeTarget: { command: string; label: string; category: MidiCommandCategory; trackId?: string; parameter?: any } | null;
  onSetActiveTarget: (target: { command: string; label: string; category: MidiCommandCategory; trackId?: string; parameter?: any } | null) => void;
  tracks: StudioTrack[];
}

export function MidiLearnDialog({
  isOpen,
  onClose,
  mappings,
  onUpdateMappings,
  isLearningMode,
  onToggleLearningMode,
  activeTarget,
  onSetActiveTarget,
  tracks,
}: MidiLearnDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [lastReceivedEvent, setLastReceivedEvent] = useState<MidiMessageEvent | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("default");
  const [simulatedCcNumber, setSimulatedCcNumber] = useState<number>(7);
  const [simulatedCcValue, setSimulatedCcValue] = useState<number>(100);

  // Monitor incoming MIDI messages while dialog is open
  useEffect(() => {
    if (!isOpen) return;

    webMidiManager.initialize();

    const unsubscribe = webMidiManager.addListener((event) => {
      setLastReceivedEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const connectedDevices = webMidiManager.getConnectedDevices();

  const handleApplyPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    if (presetName === "default") {
      onUpdateMappings(DEFAULT_MIDI_MAPPINGS);
    } else if (presetName === "akai") {
      onUpdateMappings(AKAI_MPK_PRESET);
    } else if (presetName === "korg") {
      onUpdateMappings(KORG_NANOKONTROL_PRESET);
    }
  };

  const filteredMappings = mappings.filter((m) => {
    if (selectedCategory === "all") return true;
    return m.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/30 overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <Radio className="size-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Edit MIDI Control Surface Settings
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Mixcraft 10 Hlm. 488 & 661
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Petakan hardware knob, fader, dan tombol controller Anda untuk mengontrol fungsi DAW secara langsung.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleLearningMode(!isLearningMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                isLearningMode
                  ? "bg-purple-600 text-white shadow-purple-500/30 animate-pulse border border-purple-400"
                  : "bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white border border-white/10"
              }`}
            >
              <Radio className="size-3.5" />
              <span>{isLearningMode ? "Stop Learning" : "Mulai MIDI Learn"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Learning Status Banner */}
        {isLearningMode && (
          <div className="px-6 py-2.5 bg-purple-950/60 border-b border-purple-500/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-200">
              <span className="size-2.5 rounded-full bg-purple-400 animate-ping inline-block" />
              <span>
                <strong>Mode MIDI Learn Aktif:</strong>{" "}
                {activeTarget ? (
                  <>
                    Menunggu sinyal MIDI untuk:{" "}
                    <span className="text-white font-bold underline bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/40">
                      {activeTarget.label}
                    </span>
                    . Gerakkan knob atau tekan tombol di controller Anda!
                  </>
                ) : (
                  "Pilih perintah di daftar bawah atau klik kontrol fader/knob pada DAW untuk mulai memetakan."
                )}
              </span>
            </div>
            {activeTarget && (
              <button
                onClick={() => onSetActiveTarget(null)}
                className="text-[11px] text-purple-300 hover:text-white underline ml-4"
              >
                Batal Target
              </button>
            )}
          </div>
        )}

        {/* Toolbar: Devices, Presets, and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/10 bg-zinc-900/60 text-xs">
          {/* Hardware Device Info */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-semibold">Perangkat MIDI:</span>
            <span className="px-2 py-1 bg-zinc-800 border border-white/10 rounded-lg text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
              {connectedDevices[0]?.name || "Web MIDI Controller"}
            </span>
          </div>

          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-semibold">Profil Controller:</span>
            <select
              value={selectedPreset}
              onChange={(e) => handleApplyPreset(e.target.value)}
              className="bg-zinc-800 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="default">Default Mixcraft 10 Surface</option>
              <option value="akai">Akai MPK Mini Series</option>
              <option value="korg">Korg nanoKONTROL2 (8-Track)</option>
              <option value="custom">Kustom / Manual</option>
            </select>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-800/80 p-0.5 rounded-xl border border-white/10">
            {[
              { id: "all", label: "Semua" },
              { id: "transport", label: "Transport" },
              { id: "master", label: "Master" },
              { id: "selected_track", label: "Track Terpilih" },
              { id: "track", label: "Multitrack" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  selectedCategory === tab.id
                    ? "bg-purple-600 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area: Mappings Table + Simulator Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mappings Table */}
          <div className="rounded-xl border border-white/10 overflow-hidden bg-zinc-900/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-900/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Perintah / Target DAW</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Val (CC / Note)</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500">
                      Tidak ada pemetaan pada kategori ini. Klik &quot;Tambah Perintah&quot; untuk memetakan fungsi baru.
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((m) => {
                    const isTarget = activeTarget?.command === m.command;
                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-white/[0.03] transition ${
                          isTarget ? "bg-purple-950/40 border-l-2 border-purple-500" : ""
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2">
                          {isTarget && <span className="size-2 rounded-full bg-purple-400 animate-ping" />}
                          <span>{m.label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 capitalize">{m.category.replace("_", " ")}</td>
                        <td className="py-2.5 px-3 uppercase font-mono text-purple-300 font-bold">{m.messageType}</td>
                        <td className="py-2.5 px-3 font-mono text-zinc-300 font-bold">
                          {m.messageType === "cc" ? `CC ${m.controlNumber}` : `Note ${m.controlNumber}`}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400">
                          {m.channel === 0 ? "Omni (Semua)" : `Ch ${m.channel}`}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              onSetActiveTarget({
                                command: m.command,
                                label: m.label,
                                category: m.category,
                                trackId: m.trackId,
                                parameter: m.parameter,
                              });
                              if (!isLearningMode) onToggleLearningMode(true);
                            }}
                            title="Pelajari ulang dari controller"
                            className="px-2 py-1 rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 border border-purple-500/30 transition text-[11px] font-semibold"
                          >
                            Re-Learn
                          </button>
                          <button
                            onClick={() => onUpdateMappings(deleteMapping(mappings, m.id))}
                            title="Hapus pemetaan ini"
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Add Available Commands Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Plus className="size-3.5 text-purple-400" />
              <span>Daftar Perintah Siap Dipetakan (Mixcraft 10 Catalog)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {AVAILABLE_MIDI_COMMANDS.map((cmd) => {
                const isAlreadyMapped = mappings.some((m) => m.command === cmd.command);
                const isCurrentTarget = activeTarget?.command === cmd.command;
                return (
                  <button
                    key={cmd.command}
                    onClick={() => {
                      onSetActiveTarget({
                        command: cmd.command,
                        label: cmd.label,
                        category: cmd.category,
                      });
                      if (!isLearningMode) onToggleLearningMode(true);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                      isCurrentTarget
                        ? "border-purple-500 bg-purple-950/60 text-white shadow-sm ring-1 ring-purple-500"
                        : isAlreadyMapped
                        ? "border-emerald-500/30 bg-emerald-950/20 text-zinc-300 hover:border-emerald-500/50"
                        : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-purple-500/40 hover:text-white"
                    }`}
                  >
                    <div className="truncate pr-1">
                      <div className="text-[11px] font-bold text-white truncate">{cmd.label}</div>
                      <div className="text-[9px] text-zinc-500 capitalize">{cmd.category.replace("_", " ")}</div>
                    </div>
                    {isAlreadyMapped && <Check className="size-3 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Track Direct Mapping Quick Generator */}
          {tracks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Layers className="size-3.5 text-purple-400" />
                <span>Petakan Fader Track Tertentu (Multitrack Faders)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tracks.slice(0, 8).map((trk, idx) => (
                  <div
                    key={trk.id}
                    className="p-2.5 rounded-xl border border-white/10 bg-zinc-900/50 flex flex-col gap-1.5"
                  >
                    <span className="text-[11px] font-bold text-white truncate">
                      Track {idx + 1}: {trk.name}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          onSetActiveTarget({
                            command: `track_volume:${trk.id}`,
                            label: `${trk.name} - Volume`,
                            category: "track",
                            trackId: trk.id,
                            parameter: "volume",
                          });
                          if (!isLearningMode) onToggleLearningMode(true);
                        }}
                        className="flex-1 py-1 rounded bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/40 text-[10px] text-zinc-300 hover:text-white transition font-medium"
                      >
                        + Vol
                      </button>
                      <button
                        onClick={() => {
                          onSetActiveTarget({
                            command: `track_pan:${trk.id}`,
                            label: `${trk.name} - Pan`,
                            category: "track",
                            trackId: trk.id,
                            parameter: "pan",
                          });
                          if (!isLearningMode) onToggleLearningMode(true);
                        }}
                        className="flex-1 py-1 rounded bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/40 text-[10px] text-zinc-300 hover:text-white transition font-medium"
                      >
                        + Pan
                      </button>
                      <button
                        onClick={() => {
                          onSetActiveTarget({
                            command: `track_mute:${trk.id}`,
                            label: `${trk.name} - Mute`,
                            category: "track",
                            trackId: trk.id,
                            parameter: "mute",
                          });
                          if (!isLearningMode) onToggleLearningMode(true);
                        }}
                        className="flex-1 py-1 rounded bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/40 text-[10px] text-zinc-300 hover:text-white transition font-medium"
                      >
                        + Mute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Virtual MIDI Controller & Hardware Activity Simulator */}
          <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Simulator & Uji Hardware MIDI (Live Test)
                </span>
              </div>
              {lastReceivedEvent && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    Event: {lastReceivedEvent.type.toUpperCase()}{" "}
                    {lastReceivedEvent.controlNumber} | Ch {lastReceivedEvent.channel} | Val{" "}
                    {lastReceivedEvent.value}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* CC Slider Test */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Simulasi Knob / Fader CC:</span>
                  <span className="text-purple-300 font-bold font-mono">
                    CC #{simulatedCcNumber} = {simulatedCcValue}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={simulatedCcNumber}
                    onChange={(e) => setSimulatedCcNumber(parseInt(e.target.value) || 0)}
                    className="w-14 bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-xs text-center font-mono"
                    title="Nomor CC (0-127)"
                  />
                  <input
                    type="range"
                    min={0}
                    max={127}
                    value={simulatedCcValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSimulatedCcValue(val);
                      webMidiManager.simulateMessage({
                        channel: 1,
                        type: "cc",
                        controlNumber: simulatedCcNumber,
                        value: val,
                      });
                    }}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Transport Buttons Test */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
                <div className="text-[11px] text-zinc-400 mb-2">Simulasi Tombol MMC:</div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      webMidiManager.simulateMessage({
                        channel: 1,
                        type: "cc",
                        controlNumber: 115,
                        value: 127,
                      })
                    }
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-bold text-emerald-300 flex items-center justify-center gap-1 transition"
                  >
                    <Play className="size-3" /> Play (CC 115)
                  </button>
                  <button
                    onClick={() =>
                      webMidiManager.simulateMessage({
                        channel: 1,
                        type: "cc",
                        controlNumber: 117,
                        value: 127,
                      })
                    }
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-bold text-red-400 flex items-center justify-center gap-1 transition"
                  >
                    <Disc className="size-3" /> Rec (CC 117)
                  </button>
                </div>
              </div>

              {/* Master Volume Quick Fader */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
                <div className="text-[11px] text-zinc-400 mb-2">Master Volume (CC 7):</div>
                <button
                  onClick={() =>
                    webMidiManager.simulateMessage({
                      channel: 1,
                      type: "cc",
                      controlNumber: 7,
                      value: 100, // Unity gain
                    })
                  }
                  className="w-full py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-[11px] font-bold text-purple-300 flex items-center justify-center gap-1 transition"
                >
                  <Volume2 className="size-3" /> Kirim CC 7 = 100 (0 dB Unity)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-zinc-950 text-xs">
          <button
            onClick={() => {
              if (window.confirm("Hapus semua pemetaan MIDI kontrol permukaan?")) {
                onUpdateMappings([]);
              }
            }}
            className="text-red-400 hover:text-red-300 transition flex items-center gap-1.5 font-medium"
          >
            <Trash2 className="size-3.5" />
            <span>Hapus Semua Pemetaan</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApplyPreset("default")}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
            >
              Reset Default
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
