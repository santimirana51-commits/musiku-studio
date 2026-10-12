"use client";

import React, { useState } from "react";
import {
  X,
  Flag,
  Play,
  Pause,
  Repeat,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Music,
  Activity,
  Check,
} from "lucide-react";
import type { StudioMarker, StudioProject } from "@/lib/studio/types";
import {
  sortMarkers,
  createMarker,
  updateMarker,
  deleteMarker,
  getMarkerLoopRange,
  getPreviousAndNextMarker,
  beatToBarBeat,
  MARKER_PALETTE,
  STANDARD_KEY_SIGNATURES,
  STANDARD_TIME_SIGNATURES,
} from "@/lib/studio/markers";

interface MarkerListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProject;
  currentBeat: number;
  isPlaying: boolean;
  onSeek: (beat: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onUpdateProject: (updates: Partial<StudioProject>) => void;
}

export function MarkerListDialog({
  isOpen,
  onClose,
  project,
  currentBeat,
  isPlaying,
  onSeek,
  onPlay,
  onPause,
  onUpdateProject,
}: MarkerListDialogProps) {
  const [autoLoopOnPlay, setAutoLoopOnPlay] = useState(true);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  if (!isOpen) return null;

  const sortedMarkers = sortMarkers(project.markers || []);

  const handlePlayMarker = (marker: StudioMarker) => {
    setActiveMarkerId(marker.id);
    onSeek(marker.beat);

    if (autoLoopOnPlay) {
      const loop = getMarkerLoopRange(sortedMarkers, marker.id);
      if (loop) {
        onUpdateProject({
          loopRange: {
            enabled: true,
            startBeat: loop.startBeat,
            endBeat: loop.endBeat,
          },
        });
      }
    }

    if (!isPlaying) {
      onPlay();
    }
  };

  const handleAddMarkerAtPlayhead = () => {
    const defaultColor = MARKER_PALETTE[sortedMarkers.length % MARKER_PALETTE.length].color;
    const newMarker = createMarker(
      currentBeat,
      `Marker ${sortedMarkers.length + 1}`,
      defaultColor,
      project.tempo
    );
    const updated = sortMarkers([...sortedMarkers, newMarker]);
    onUpdateProject({ markers: updated });
  };

  const handleUpdate = (markerId: string, updates: Partial<StudioMarker>) => {
    const updated = updateMarker(sortedMarkers, markerId, updates);
    onUpdateProject({ markers: updated });
  };

  const handleDelete = (markerId: string) => {
    const updated = deleteMarker(sortedMarkers, markerId);
    onUpdateProject({ markers: updated });
  };

  const handleJumpPrev = () => {
    const nav = getPreviousAndNextMarker(sortedMarkers, currentBeat);
    if (nav.previous) {
      onSeek(nav.previous.beat);
    }
  };

  const handleJumpNext = () => {
    const nav = getPreviousAndNextMarker(sortedMarkers, currentBeat);
    if (nav.next) {
      onSeek(nav.next.beat);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-zinc-950 border border-violet-500/40 rounded-2xl shadow-2xl shadow-violet-950/30 overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-950/40 via-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
              <Flag className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Marker List
                <span className="text-[10px] font-mono uppercase bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
                  Mixcraft 10 Hlm. 524–528
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Lihat dan sesuaikan seluruh penanda birama lagu, perubahan tempo BPM, sukat ketukan, dan loop section otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/10 bg-zinc-900/60 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddMarkerAtPlayhead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition shadow"
            >
              <Plus className="size-3.5" />
              <span>+ Marker di Playhead ({currentBeat.toFixed(1)}b)</span>
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer text-zinc-300 hover:text-white transition">
              <input
                type="checkbox"
                checked={autoLoopOnPlay}
                onChange={(e) => setAutoLoopOnPlay(e.target.checked)}
                className="accent-violet-500 size-3.5 rounded"
              />
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Repeat className="size-3 text-violet-400" />
                Auto-Loop Antar-Marker saat Play (Mixcraft 10 Hlm. 527)
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleJumpPrev}
              title="Lompat ke Marker Sebelumnya (Mixcraft 10 Hlm. 663)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition text-[11px] font-medium"
            >
              <ChevronLeft className="size-3.5" />
              <span>Marker Seb.</span>
            </button>
            <button
              onClick={handleJumpNext}
              title="Lompat ke Marker Berikutnya (Mixcraft 10 Hlm. 663)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition text-[11px] font-medium"
            >
              <span>Marker Berik.</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Markers Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-white/10 overflow-hidden bg-zinc-900/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-900/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-12 text-center">Play</th>
                  <th className="py-2.5 px-3 w-12 text-center">Warna</th>
                  <th className="py-2.5 px-4">Nama Marker</th>
                  <th className="py-2.5 px-3">Offset (Bar.Beat)</th>
                  <th className="py-2.5 px-3">Perubahan Tempo</th>
                  <th className="py-2.5 px-3">Sukat (Time Sig)</th>
                  <th className="py-2.5 px-3">Tangga Nada (Key)</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedMarkers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-zinc-500">
                      Belum ada marker pada proyek ini. Klik "+ Marker di Playhead" untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  sortedMarkers.map((marker, idx) => {
                    const barBeat = beatToBarBeat(marker.beat);
                    const isPlayheadHere = Math.abs(currentBeat - marker.beat) < 0.5;

                    return (
                      <tr
                        key={marker.id}
                        className={`hover:bg-white/[0.03] transition ${
                          isPlayheadHere ? "bg-violet-950/30 border-l-2 border-violet-500" : ""
                        }`}
                      >
                        {/* Play Arrow Button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handlePlayMarker(marker)}
                            title="Play mulai dari marker ini (Mixcraft 10 Hlm. 525)"
                            className={`p-1.5 rounded-lg border transition ${
                              isPlaying && activeMarkerId === marker.id
                                ? "bg-emerald-500 border-emerald-400 text-black shadow-emerald-500/30 animate-pulse"
                                : "bg-white/5 border-white/10 text-zinc-300 hover:bg-emerald-600/30 hover:text-emerald-300 hover:border-emerald-500/40"
                            }`}
                          >
                            <Play className="size-3 fill-current" />
                          </button>
                        </td>

                        {/* Color Selector */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="relative inline-block">
                            <input
                              type="color"
                              value={marker.color || "#8b5cf6"}
                              onChange={(e) => handleUpdate(marker.id, { color: e.target.value })}
                              className="size-6 rounded-full cursor-pointer bg-transparent border-0 p-0"
                              title="Pilih warna bendera marker"
                            />
                          </div>
                        </td>

                        {/* Title Input */}
                        <td className="py-2.5 px-4 font-medium">
                          <input
                            type="text"
                            value={marker.name}
                            onChange={(e) => handleUpdate(marker.id, { name: e.target.value })}
                            className="bg-zinc-800/80 border border-white/10 focus:border-violet-500 rounded px-2 py-1 text-xs text-white w-full outline-none"
                            placeholder="Nama Marker..."
                          />
                        </td>

                        {/* Offset / Beat Position */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-mono text-zinc-300">
                            <span className="text-[11px] font-bold text-violet-300">
                              Bar {barBeat.display}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              ({marker.beat}b)
                            </span>
                          </div>
                        </td>

                        {/* Tempo Change */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={!!marker.tempo}
                              onChange={(e) => {
                                handleUpdate(marker.id, {
                                  tempo: e.target.checked ? project.tempo : undefined,
                                });
                              }}
                              className="accent-violet-500 size-3 rounded"
                              title="Aktifkan perubahan tempo pada marker ini"
                            />
                            {marker.tempo ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={20}
                                  max={320}
                                  value={marker.tempo}
                                  onChange={(e) =>
                                    handleUpdate(marker.id, {
                                      tempo: parseInt(e.target.value) || 120,
                                    })
                                  }
                                  className="w-14 bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-xs text-amber-300 font-bold font-mono text-center"
                                />
                                <span className="text-[10px] text-zinc-400">BPM</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-500 italic">Sama ({project.tempo})</span>
                            )}
                          </div>
                        </td>

                        {/* Time Signature */}
                        <td className="py-2.5 px-3">
                          <select
                            value={
                              marker.timeSignature
                                ? `${marker.timeSignature[0]}/${marker.timeSignature[1]}`
                                : "none"
                            }
                            onChange={(e) => {
                              if (e.target.value === "none") {
                                handleUpdate(marker.id, { timeSignature: undefined });
                              } else {
                                const [num, den] = e.target.value.split("/").map(Number);
                                handleUpdate(marker.id, { timeSignature: [num, den] });
                              }
                            }}
                            className="bg-zinc-800 border border-white/10 rounded px-1.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                          >
                            <option value="none">Default ({project.timeSignature[0]}/{project.timeSignature[1]})</option>
                            {STANDARD_TIME_SIGNATURES.map(([num, den]) => (
                              <option key={`${num}/${den}`} value={`${num}/${den}`}>
                                {num}/{den}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Key Signature */}
                        <td className="py-2.5 px-3">
                          <select
                            value={marker.keySignature || "none"}
                            onChange={(e) => {
                              handleUpdate(marker.id, {
                                keySignature: e.target.value === "none" ? undefined : e.target.value,
                              });
                            }}
                            className="bg-zinc-800 border border-white/10 rounded px-1.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                          >
                            <option value="none">Tanpa Kunci</option>
                            {STANDARD_KEY_SIGNATURES.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <button
                            onClick={() => {
                              const loop = getMarkerLoopRange(sortedMarkers, marker.id);
                              if (loop) {
                                onUpdateProject({
                                  loopRange: {
                                    enabled: true,
                                    startBeat: loop.startBeat,
                                    endBeat: loop.endBeat,
                                  },
                                });
                              }
                            }}
                            title="Set batas loop ke seksi marker ini"
                            className="p-1 rounded bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 transition text-[10px]"
                          >
                            <Repeat className="size-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(marker.id)}
                            title="Hapus marker ini"
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-zinc-950 text-xs">
          <div className="text-zinc-500 text-[11px]">
            Total Penanda: <strong className="text-white">{sortedMarkers.length} Marker</strong> | Playhead saat ini:{" "}
            <span className="font-mono text-violet-300">Beat {currentBeat.toFixed(2)}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition shadow"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
