"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Mic,
  Disc3,
  Sliders,
  Layers,
  Volume2,
  VolumeX,
  FolderTree,
  FileAudio,
  Check,
  Loader2,
  Music,
} from "lucide-react";
import type { StudioClip, StudioProject } from "@/lib/studio/types";
import {
  DEFAULT_STEM_SEPARATION_OPTIONS,
  type StemSeparationOptions,
  type StemType,
  STEM_METADATA,
} from "@/lib/studio/stem-separation";

interface StemSeparationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProject;
  trackId: string | null;
  clip: StudioClip | null;
  onSeparate: (
    trackId: string,
    clipId: string,
    options: StemSeparationOptions
  ) => Promise<void>;
  isProcessing?: boolean;
  processingProgress?: number;
  processingStatus?: string;
}

export function StemSeparationDialog({
  isOpen,
  onClose,
  project,
  trackId,
  clip,
  onSeparate,
  isProcessing = false,
  processingProgress = 0,
  processingStatus = "Menyiapkan pemisahan stem...",
}: StemSeparationDialogProps) {
  const [options, setOptions] = useState<StemSeparationOptions>({
    ...DEFAULT_STEM_SEPARATION_OPTIONS,
  });

  if (!isOpen || !clip || !trackId) return null;

  const sourceTrack = project.tracks.find((t) => t.id === trackId);
  const selectedCount = Object.values(options.models).filter(Boolean).length;

  const handleToggleModel = (type: StemType) => {
    setOptions((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        [type]: !prev.models[type],
      },
    }));
  };

  const handlePreset = (preset: "standard" | "five" | "karaoke" | "dnb") => {
    switch (preset) {
      case "standard":
        setOptions((prev) => ({
          ...prev,
          models: {
            vocals: true,
            drums: true,
            bass: true,
            piano: false,
            other: true,
          },
        }));
        break;
      case "five":
        setOptions((prev) => ({
          ...prev,
          models: {
            vocals: true,
            drums: true,
            bass: true,
            piano: true,
            other: true,
          },
        }));
        break;
      case "karaoke":
        setOptions((prev) => ({
          ...prev,
          models: {
            vocals: true,
            drums: false,
            bass: false,
            piano: false,
            other: true,
          },
        }));
        break;
      case "dnb":
        setOptions((prev) => ({
          ...prev,
          models: {
            vocals: false,
            drums: true,
            bass: true,
            piano: false,
            other: true,
          },
        }));
        break;
    }
  };

  const handleStartSeparate = async () => {
    if (selectedCount === 0 || isProcessing) return;
    await onSeparate(trackId, clip.id, options);
  };

  const stemCards: {
    type: StemType;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      type: "vocals",
      title: "Vocals",
      description: "Isolasi vokal utama dan harmoni backing melalui formant bandpass & center stereo weighting.",
      icon: <Mic className="size-4" />,
      color: "from-pink-500/20 to-pink-950/40 border-pink-500/40 text-pink-400",
    },
    {
      type: "drums",
      title: "Drums & Percussion",
      description: "Ekstraksi pukulan transient cepat (kick punch, snare crack, hi-hats, dan cymbals).",
      icon: <Disc3 className="size-4" />,
      color: "from-amber-500/20 to-amber-950/40 border-amber-500/40 text-amber-400",
    },
    {
      type: "bass",
      title: "Bass & Low-End",
      description: "Isolasi harmonik bass guitar, synth sub-bass, dan 808 di bawah frekuensi 220 Hz.",
      icon: <Sliders className="size-4" />,
      color: "from-blue-500/20 to-blue-950/40 border-blue-500/40 text-blue-400",
    },
    {
      type: "piano",
      title: "Piano & Keys",
      description: "Resonansi harmonik nada sustained tuts akustik dan instrumen keyboard stereo.",
      icon: <Music className="size-4" />,
      color: "from-emerald-500/20 to-emerald-950/40 border-emerald-500/40 text-emerald-400",
    },
    {
      type: "other",
      title: "Other Instruments",
      description: "Gitar, synthesizer, efek suara, dan seluruh lapisan musikal residual bebas kehilangan sinyal.",
      icon: <Sparkles className="size-4" />,
      color: "from-violet-500/20 to-violet-950/40 border-violet-500/40 text-violet-400",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-zinc-950 border border-violet-500/40 rounded-2xl shadow-2xl shadow-violet-950/40 overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-950/50 via-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 shadow-inner">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Separate Music into Stems
                <span className="text-[10px] font-mono uppercase bg-violet-500/20 text-violet-300 px-2.5 py-0.5 rounded-full border border-violet-500/30 font-semibold tracking-wider">
                  Mixcraft 10 Pro Studio (Hlm. 650–652)
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Pisahkan lagu menjadi trek stem instrumen diskrit menggunakan pemisahan sumber AI & DSP non-destruktif.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Source Clip Info Card */}
        <div className="px-6 py-3 bg-zinc-900/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Klip Target:</span>
            <span className="font-semibold text-white px-2 py-0.5 rounded bg-white/10 font-mono">
              {clip.name}
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">Trek:</span>
            <span className="text-zinc-300">{sourceTrack?.name ?? trackId}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
            <span>Mulai: {clip.startBeat.toFixed(1)}b</span>
            <span>Durasi: {clip.durationBeats.toFixed(1)}b</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Stem Model Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Model Pemisahan Stem (Stem Separation Models)
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handlePreset("standard")}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                >
                  4 Stems
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("five")}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                >
                  5 Stems (+ Piano)
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("karaoke")}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                >
                  Karaoke
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("dnb")}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                >
                  Drums & Bass
                </button>
              </div>
            </div>

            {/* Stem Model Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {stemCards.map((sc) => {
                const isSelected = options.models[sc.type];
                return (
                  <button
                    key={sc.type}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleToggleModel(sc.type)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? `bg-gradient-to-br ${sc.color} ring-1 ring-white/20`
                        : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/20 hover:bg-zinc-900/70"
                    }`}
                  >
                    <div
                      className={`mt-0.5 size-4 rounded flex items-center justify-center border transition ${
                        isSelected
                          ? "bg-violet-600 border-violet-400 text-white"
                          : "border-zinc-600 bg-zinc-800"
                      }`}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={isSelected ? "text-white" : "text-zinc-400"}>
                          {sc.icon}
                        </span>
                        <span
                          className={`font-semibold text-xs ${
                            isSelected ? "text-white" : "text-zinc-300"
                          }`}
                        >
                          {sc.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        {sc.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options / Checkboxes (Mixcraft 10 Hlm. 650) */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block mb-2">
              Pengaturan Trek & Routing (Project Routing Options)
            </span>

            {/* Create Stems In New Submix Track */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/15 cursor-pointer transition">
              <input
                type="checkbox"
                checked={options.createSubmixTrack}
                disabled={isProcessing}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, createSubmixTrack: e.target.checked }))
                }
                className="mt-0.5 accent-violet-500 size-4 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FolderTree className="size-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Create Stems In New Submix Track
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Membuat trek Submix induk baru dan trek anak untuk setiap jenis stem yang dipisahkan, mempermudah pengaturan volume grup dan efek bersama (Mixcraft 10 Hlm. 650).
                </p>
              </div>
            </label>

            {/* Mute Source Clip */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/15 cursor-pointer transition">
              <input
                type="checkbox"
                checked={options.muteSourceClip}
                disabled={isProcessing}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, muteSourceClip: e.target.checked }))
                }
                className="mt-0.5 accent-violet-500 size-4 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <VolumeX className="size-4 text-amber-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Mute Source Clip
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Membisukan klip sumber asli secara otomatis sehingga hanya trek stem yang dipisahkan yang terdengar pada aransemen (Mixcraft 10 Hlm. 650).
                </p>
              </div>
            </label>

            {/* Additional format options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.keepSameFormat ?? true}
                  disabled={isProcessing}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, keepSameFormat: e.target.checked }))
                  }
                  className="accent-violet-500 size-3.5 rounded"
                />
                <span className="flex items-center gap-1.5">
                  <FileAudio className="size-3.5 text-zinc-400" />
                  Keep Stem Format Same As Source
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.useOriginalAudio ?? false}
                  disabled={isProcessing}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, useOriginalAudio: e.target.checked }))
                  }
                  className="accent-violet-500 size-3.5 rounded"
                />
                <span>Use Original Audio From File</span>
              </label>
            </div>
          </div>

          {/* Processing Progress Bar */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-violet-300 flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-violet-400" />
                  {processingStatus}
                </span>
                <span className="font-mono font-bold text-violet-300">
                  {Math.round(processingProgress)}%
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, Math.min(100, processingProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-zinc-900/60">
          <span className="text-xs text-zinc-400">
            {selectedCount} dari 5 model dipilih
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartSeparate}
              disabled={selectedCount === 0 || isProcessing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 shadow-lg shadow-violet-900/40 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memisahkan Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Separate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
