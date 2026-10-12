"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Square,
  Sparkles,
  Layers,
  X,
  Volume2,
  Sliders,
  ChevronRight,
  Disc,
  Plus,
  Radio,
  Clock,
  CircleDot,
  Trash2,
  Copy,
} from "lucide-react";
import type {
  StudioProject,
  StudioTrack,
  StudioClip,
  PerformanceCueQuantize,
  PerformanceSet,
} from "@/lib/studio/types";
import { renderTrackTypeIcon } from "./track-header";
import {
  getNextCueBeat,
  getTrackPerformanceClip,
  addPerformanceSet,
  deletePerformanceSet,
  duplicatePerformanceSet,
  updatePerformanceClipSlot,
} from "@/lib/studio/performance-panel";

interface PerformancePanelProps {
  project: StudioProject;
  currentBeat: number;
  isPlaying: boolean;
  onClose: () => void;
  onSelectTrack?: (trackId: string) => void;
  selectedTrackId?: string;
  onTriggerPerformanceClip?: (trackId: string, slotIndex: number) => void;
  onTriggerSet?: (setIndex: number) => void;
  onStopAll?: () => void;
  onUpdateProject?: (updates: Partial<StudioProject>) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<StudioTrack>) => void;
}

export function PerformancePanel({
  project,
  currentBeat,
  isPlaying,
  onClose,
  onSelectTrack,
  selectedTrackId,
  onTriggerPerformanceClip,
  onTriggerSet,
  onStopAll,
  onUpdateProject,
  onUpdateTrack,
}: PerformancePanelProps) {
  const sets: PerformanceSet[] =
    project.performanceSets && project.performanceSets.length > 0
      ? project.performanceSets
      : [
          { id: "set_1", name: "Set 1: Intro", color: "#8b5cf6" },
          { id: "set_2", name: "Set 2: Verse", color: "#3b82f6" },
          { id: "set_3", name: "Set 3: Chorus", color: "#ec4899" },
          { id: "set_4", name: "Set 4: Drop", color: "#10b981" },
        ];

  // Active clip index per track (-1 if stopped)
  const [activeClipPerTrack, setActiveClipPerTrack] = useState<Record<string, number>>({});
  // Queued clip index waiting for next cue boundary
  const [queuedClipPerTrack, setQueuedClipPerTrack] = useState<Record<string, number>>({});
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);

  const cueSetting: PerformanceCueQuantize = project.performanceCue || "1";
  const isSolo = !!project.isPerformanceSolo;
  const isArmed = !!project.isPerformanceArmed;

  // Cue listener: activate queued clips when playhead reaches next cue beat
  const [targetCueBeat, setTargetCueBeat] = useState<number | null>(null);

  useEffect(() => {
    if (targetCueBeat !== null && currentBeat >= targetCueBeat) {
      // Commit queued cells to active
      setActiveClipPerTrack((prev) => ({ ...prev, ...queuedClipPerTrack }));
      setQueuedClipPerTrack({});
      setTargetCueBeat(null);
    }
  }, [currentBeat, targetCueBeat, queuedClipPerTrack]);

  // Toggle clip playback in performance cell
  const handleToggleCell = (trackId: string, slotIdx: number) => {
    const current = activeClipPerTrack[trackId];
    const target = current === slotIdx ? -1 : slotIdx;

    if (cueSetting === "instant" || !isPlaying) {
      setActiveClipPerTrack((prev) => ({ ...prev, [trackId]: target }));
    } else {
      const nextBeat = getNextCueBeat(currentBeat, cueSetting, project.timeSignature[0]);
      setTargetCueBeat(nextBeat);
      setQueuedClipPerTrack((prev) => ({ ...prev, [trackId]: target }));
    }

    onTriggerPerformanceClip?.(trackId, slotIdx);
  };

  // Launch entire Set (column across all tracks, Mixcraft 10 Hlm. 412)
  const handleLaunchSet = (setIdx: number) => {
    setActiveSetIndex(setIdx);
    const updated: Record<string, number> = {};
    for (const track of project.tracks) {
      updated[track.id] = setIdx;
    }

    if (cueSetting === "instant" || !isPlaying) {
      setActiveClipPerTrack(updated);
    } else {
      const nextBeat = getNextCueBeat(currentBeat, cueSetting, project.timeSignature[0]);
      setTargetCueBeat(nextBeat);
      setQueuedClipPerTrack(updated);
    }

    onTriggerSet?.(setIdx);
  };

  // Stop all performance clips
  const handleStopAll = () => {
    setActiveSetIndex(null);
    setActiveClipPerTrack({});
    setQueuedClipPerTrack({});
    setTargetCueBeat(null);
    onStopAll?.();
  };

  return (
    <div className="flex flex-col w-80 shrink-0 border-r border-white/10 bg-zinc-950/95 text-xs select-none shadow-2xl backdrop-blur-md z-20">
      {/* Top Header Controls (Mixcraft 10 Hlm. 411–416) */}
      <div className="flex h-8 items-center justify-between border-b border-white/10 px-3 text-[11px] font-bold text-zinc-300 bg-white/5">
        <div className="flex items-center gap-1.5 text-violet-400">
          <Layers className="size-3.5" />
          <span>PERFORMANCE PANEL</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Solo Button (Mutes main timeline clips, Hlm. 414) */}
          <button
            onClick={() => onUpdateProject?.({ isPerformanceSolo: !isSolo })}
            title={isSolo ? "Solo Aktif: Hanya klip Performance yang berbunyi" : "Solo Performance Panel (Hlm. 414)"}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition border ${
              isSolo
                ? "bg-amber-600 border-amber-400 text-white shadow"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            SOLO
          </button>

          {/* Arm Button (Records sets into timeline grid, Hlm. 414) */}
          <button
            onClick={() => onUpdateProject?.({ isPerformanceArmed: !isArmed })}
            title={isArmed ? "Arm Aktif: Sesi performance terekam ke timeline" : "Arm Recording ke Main Timeline Grid (Hlm. 414)"}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold transition border ${
              isArmed
                ? "bg-red-600 border-red-400 text-white shadow animate-pulse"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <CircleDot className="size-2.5" />
            <span>ARM</span>
          </button>

          {/* Cue Quantize Selector (Hlm. 414–415) */}
          <div className="flex items-center gap-0.5 bg-black/60 px-1 py-0.5 rounded border border-white/10">
            <Clock className="size-2.5 text-violet-400" />
            <select
              value={cueSetting}
              onChange={(e) =>
                onUpdateProject?.({
                  performanceCue: e.target.value as PerformanceCueQuantize,
                })
              }
              title="Kuantisasi Cue Sinkronisasi Pemicu (Hlm. 414–415)"
              className="bg-transparent text-[9px] font-bold text-violet-300 outline-none cursor-pointer font-mono"
            >
              <option value="instant" className="bg-zinc-900">Instant</option>
              <option value="1/4" className="bg-zinc-900">1/4 Beat</option>
              <option value="1/2" className="bg-zinc-900">1/2 Beat</option>
              <option value="1" className="bg-zinc-900">1 Beat</option>
              <option value="2" className="bg-zinc-900">2 Beats</option>
              <option value="4" className="bg-zinc-900">1 Bar</option>
            </select>
          </div>

          <button
            onClick={handleStopAll}
            title="Hentikan semua klip Performance"
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition"
          >
            Stop
          </button>
          <button
            onClick={onClose}
            title="Tutup Performance Panel"
            className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-white transition"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Sets / Scenes Triggers Header (Mixcraft 10 Hlm. 412) */}
      <div className="flex items-center gap-1 border-b border-white/10 p-1.5 bg-black/40 overflow-x-auto">
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 px-1 shrink-0">
          Sets:
        </span>
        {sets.map((set, setIdx) => {
          const isCurrent = activeSetIndex === setIdx;
          return (
            <div key={set.id} className="flex-1 min-w-16 flex items-center">
              <button
                onClick={() => handleLaunchSet(setIdx)}
                title={`Luncurkan ${set.name} pada semua track (Hlm. 412)`}
                className={`w-full flex items-center justify-center gap-1 rounded py-1 text-[9px] font-bold transition truncate px-1 border ${
                  isCurrent
                    ? "bg-emerald-600 border-emerald-400 text-white shadow ring-1 ring-emerald-400"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Play className="size-2 fill-current shrink-0" />
                <span className="truncate">{set.name}</span>
              </button>
            </div>
          );
        })}
        {/* + Add Set Button (Mixcraft 10 Hlm. 413) */}
        <button
          onClick={() => {
            if (onUpdateProject) {
              const updated = addPerformanceSet(project);
              onUpdateProject(updated);
            }
          }}
          title="Tambah Set / Adegan Baru (+ Add Set, Hlm. 413)"
          className="p-1 rounded bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-violet-600/30 transition shrink-0"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* Grid of Track Rows with Performance Clip Slots */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {project.tracks.map((track) => {
          const trackHeight = track.height || 96;
          const isSelected = track.id === selectedTrackId;
          const activeIndex = activeClipPerTrack[track.id] ?? -1;
          const queuedIndex = queuedClipPerTrack[track.id] ?? -1;

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack?.(track.id)}
              style={{ height: `${trackHeight}px` }}
              className={`flex items-center gap-1.5 px-2.5 transition relative cursor-pointer ${
                isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
              }`}
            >
              {/* Track color indicator */}
              <div
                className="w-1.5 self-stretch rounded-full my-2 shrink-0"
                style={{ backgroundColor: track.color }}
              />

              {/* Track Info */}
              <div className="w-20 shrink-0 truncate">
                <div className="text-[11px] font-bold text-zinc-200 truncate flex items-center gap-1">
                  {renderTrackTypeIcon(track.type, track.icon, track.customImageUrl, "size-3")}
                  <span className="truncate">{track.name}</span>
                </div>
                <div className="text-[8px] text-zinc-500 font-mono">
                  {track.type}
                </div>
              </div>

              {/* Performance Slot Cells */}
              <div
                className="flex-1 grid gap-1 h-full py-2 overflow-x-auto"
                style={{
                  gridTemplateColumns: `repeat(${sets.length}, minmax(48px, 1fr))`,
                }}
              >
                {sets.map((_, slotIdx) => {
                  const clip = getTrackPerformanceClip(track, slotIdx);
                  const isActive = activeIndex === slotIdx;
                  const isQueued = queuedIndex === slotIdx;

                  return (
                    <button
                      key={slotIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCell(track.id, slotIdx);
                      }}
                      title={
                        clip
                          ? `Klip: ${clip.name} (Klik untuk ${isActive ? "hentikan" : "putar"})`
                          : `Slot Kosong ${slotIdx + 1}`
                      }
                      className={`relative flex flex-col items-center justify-between rounded-lg p-1 transition border text-center overflow-hidden group ${
                        isActive
                          ? "border-emerald-500 bg-emerald-950/70 text-emerald-200 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400"
                          : isQueued
                          ? "border-amber-500 bg-amber-950/60 text-amber-200 animate-pulse ring-1 ring-amber-400"
                          : clip
                          ? "border-white/15 bg-white/5 hover:border-violet-500/50 hover:bg-violet-950/30 text-zinc-300"
                          : "border-white/5 bg-black/30 hover:border-white/10 hover:bg-white/5 text-zinc-600"
                      }`}
                    >
                      {/* Active pulsing glow */}
                      {isActive && (
                        <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none animate-pulse" />
                      )}

                      {/* Header slot index */}
                      <span className="text-[8px] font-mono opacity-60">
                        {slotIdx + 1}
                      </span>

                      {/* Icon */}
                      <div className="my-auto">
                        {isActive ? (
                          <Square className="size-3 text-emerald-400 fill-emerald-400" />
                        ) : isQueued ? (
                          <Clock className="size-3 text-amber-400 animate-spin" />
                        ) : clip ? (
                          <Play className="size-3 text-zinc-400 group-hover:text-violet-400 fill-current" />
                        ) : (
                          <span className="text-[9px] text-zinc-600 group-hover:text-zinc-400">+</span>
                        )}
                      </div>

                      {/* Clip label */}
                      <span className="text-[8px] truncate max-w-full font-medium leading-none">
                        {clip ? clip.name : `Pad ${slotIdx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="border-t border-white/10 p-2 text-[10px] text-zinc-500 flex items-center justify-between bg-black/30 font-mono">
        <span>Mixcraft Live Jam</span>
        <span className="text-violet-400">
          Cue: {cueSetting === "instant" ? "Instant" : `${cueSetting} Beat`}
        </span>
      </div>
    </div>
  );
}
