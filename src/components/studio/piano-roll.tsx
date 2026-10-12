"use client";

import React, { useState, useRef } from "react";
import { X, Wand2, Trash2, Volume2, Copy, ArrowUp, ArrowDown, Sparkles, BarChart2 } from "lucide-react";
import type { MidiNote, StudioClip, StudioTrack } from "@/lib/studio/types";
import type { StudioAudioEngine } from "@/lib/studio/audio-engine";
import {
  quantizeMidiNotes,
  humanizeMidiNotes,
  transposeMidiNotes,
  calculateVelocityFromPosition,
  calculateStalkHeightPercent,
  findClosestNoteAtBeat,
} from "@/lib/studio/piano-roll";

interface PianoRollProps {
  clip: StudioClip;
  track: StudioTrack;
  engine?: StudioAudioEngine | null;
  onClose: () => void;
  onUpdateClipNotes: (trackId: string, clipId: string, notes: MidiNote[]) => void;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_PRESETS: Record<string, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11], // Major / Ionian
  minor: [0, 2, 3, 5, 7, 8, 10], // Natural Minor / Aeolian
  pentatonic: [0, 2, 4, 7, 9], // Major Pentatonic
  blues: [0, 3, 5, 6, 7, 10], // Blues Scale
};

function getPitchLabel(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const name = PITCH_NAMES[pitch % 12];
  return `${name}${octave}`;
}

function isBlackKey(pitch: number): boolean {
  const p = pitch % 12;
  return p === 1 || p === 3 || p === 6 || p === 8 || p === 10;
}

export function PianoRoll({
  clip,
  track,
  engine,
  onClose,
  onUpdateClipNotes,
}: PianoRollProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeScale, setActiveScale] = useState<keyof typeof SCALE_PRESETS>("chromatic");
  const [snapDiv, setSnapDiv] = useState<number>(4); // 4 = 1/16, 2 = 1/8, 1 = 1/4, 8 = 1/32
  const [showVelocityLane, setShowVelocityLane] = useState(true);
  const notesGridRef = useRef<HTMLDivElement>(null);
  const velocityScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const notes = clip.notes || [];

  // Range: C2 (36) to C6 (84)
  const minPitch = 36;
  const maxPitch = 84;
  const pitches: number[] = [];
  for (let p = maxPitch; p >= minPitch; p--) {
    pitches.push(p);
  }

  const durationBeats = Math.max(4, clip.durationBeats);
  const pixelsPerBeat = 80;
  const rowHeight = 20;

  const syncScroll = (source: "notes" | "velocity") => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (source === "notes" && notesGridRef.current && velocityScrollRef.current) {
      velocityScrollRef.current.scrollLeft = notesGridRef.current.scrollLeft;
    } else if (source === "velocity" && notesGridRef.current && velocityScrollRef.current) {
      notesGridRef.current.scrollLeft = velocityScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleStalkMouseDown = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setSelectedNoteId(noteId);
    const targetNote = notes.find((n) => n.id === noteId);
    if (!targetNote) return;
    handleAuditionPitch(targetNote.pitch);

    const stalkEl = e.currentTarget;
    const laneEl = stalkEl.closest('[data-role="velocity-stalk-grid"]') as HTMLElement;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();

    const updateVelocity = (clientY: number) => {
      const bottom = laneRect.bottom;
      const height = laneRect.height;
      const relYFromBottom = bottom - clientY;
      const clampedVel = calculateVelocityFromPosition(relYFromBottom, height);
      onUpdateClipNotes(
        track.id,
        clip.id,
        notes.map((n) => (n.id === noteId ? { ...n, velocity: clampedVel } : n))
      );
    };

    const onMouseMove = (moveEvt: MouseEvent) => {
      updateVelocity(moveEvt.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleVelocityLaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const beat = clickX / pixelsPerBeat;

    const closestNote = findClosestNoteAtBeat(notes, beat, 0.6);
    const target = closestNote || (selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null);
    if (target) {
      const relYFromBottom = rect.height - clickY;
      const clampedVel = calculateVelocityFromPosition(relYFromBottom, rect.height);
      setSelectedNoteId(target.id);
      handleAuditionPitch(target.pitch);
      onUpdateClipNotes(
        track.id,
        clip.id,
        notes.map((n) => (n.id === target.id ? { ...n, velocity: clampedVel } : n))
      );
    }
  };

  const handleAuditionPitch = (pitch: number) => {
    if (engine) {
      void engine.previewSynthPitch(pitch, track.synthSettings, 0.35);
    }
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, pitch: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawBeat = clickX / pixelsPerBeat;
    const snappedBeat = Math.max(0, Math.floor(rawBeat * snapDiv) / snapDiv);

    const newNote: MidiNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pitch,
      startBeat: snappedBeat,
      durationBeats: 1.0 / snapDiv * 2,
      velocity: 95,
    };

    onUpdateClipNotes(track.id, clip.id, [...notes, newNote]);
    setSelectedNoteId(newNote.id);
    handleAuditionPitch(pitch);
  };

  const handleDeleteNote = (noteId: string) => {
    onUpdateClipNotes(
      track.id,
      clip.id,
      notes.filter((n) => n.id !== noteId)
    );
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const handleDuplicateNote = (note: MidiNote) => {
    const dup: MidiNote = {
      ...note,
      id: `note_${Date.now()}_dup`,
      startBeat: note.startBeat + note.durationBeats,
    };
    onUpdateClipNotes(track.id, clip.id, [...notes, dup]);
    setSelectedNoteId(dup.id);
    handleAuditionPitch(dup.pitch);
  };

  const handleTranspose = (semitones: number) => {
    const updated = transposeMidiNotes(notes, semitones, minPitch, maxPitch, selectedNoteId);
    onUpdateClipNotes(track.id, clip.id, updated);
    if (selectedNoteId) {
      const active = updated.find((n) => n.id === selectedNoteId);
      if (active) handleAuditionPitch(active.pitch);
    }
  };

  const handleQuantize = (strength = 1.0, quantizeLength = true) => {
    const quantized = quantizeMidiNotes(notes, snapDiv, strength, quantizeLength);
    onUpdateClipNotes(track.id, clip.id, quantized);
  };

  const handleHumanize = () => {
    const humanized = humanizeMidiNotes(notes, snapDiv);
    onUpdateClipNotes(track.id, clip.id, humanized);
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId);
  const scalePitches = SCALE_PRESETS[activeScale] || SCALE_PRESETS.chromatic;

  return (
    <div className="flex h-[420px] flex-col border-t-2 border-violet-500/50 bg-charcoal/95 select-none shadow-2xl z-30 font-sans">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: track.color }} />
            Piano Roll — {clip.name} ({track.name})
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {notes.length} Notasi
          </span>

          {/* Scale Assistance */}
          <div className="flex items-center gap-1.5 ml-2 text-[11px] text-zinc-400">
            <Sparkles className="size-3 text-violet-400" />
            <span>Skala:</span>
            <select
              value={activeScale}
              onChange={(e) => setActiveScale(e.target.value as keyof typeof SCALE_PRESETS)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs text-white outline-none focus:border-violet-500"
            >
              <option value="chromatic">Kromatik (Semua)</option>
              <option value="major">C Mayor / Ionian</option>
              <option value="minor">A Minor / Natural</option>
              <option value="pentatonic">Pentatonik</option>
              <option value="blues">Blues Scale</option>
            </select>
          </div>

          {/* Snap Selector */}
          <div className="flex items-center gap-1.5 ml-2 text-[11px] text-zinc-400">
            <span>Grid:</span>
            <select
              value={snapDiv}
              onChange={(e) => setSnapDiv(parseInt(e.target.value))}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs text-white outline-none focus:border-violet-500"
            >
              <option value={1}>1/4 (Beat)</option>
              <option value={2}>1/8</option>
              <option value={4}>1/16 (Standar)</option>
              <option value={8}>1/32</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedNote && (
            <div className="flex items-center gap-2 border-r border-white/10 pr-3 text-[11px] text-zinc-400">
              <Volume2 className="size-3" />
              <span>Vel:</span>
              <input
                type="range"
                min={1}
                max={127}
                value={selectedNote.velocity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onUpdateClipNotes(
                    track.id,
                    clip.id,
                    notes.map((n) => (n.id === selectedNote.id ? { ...n, velocity: val } : n))
                  );
                }}
                className="w-14 accent-violet-500 cursor-pointer"
              />
              <span className="font-mono text-white font-bold">{selectedNote.velocity}</span>

              <button
                onClick={() => handleDuplicateNote(selectedNote)}
                title="Duplikasi not terpilih"
                className="text-zinc-400 hover:text-white p-1"
              >
                <Copy className="size-3" />
              </button>

              <button
                onClick={() => handleDeleteNote(selectedNote.id)}
                title="Hapus not"
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )}

          {/* Transpose buttons */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
            <button
              onClick={() => handleTranspose(1)}
              title="Transposisi +1 semi-nada"
              className="flex items-center gap-0.5 rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-white/10"
            >
              <ArrowUp className="size-3" />
              <span>+1</span>
            </button>
            <button
              onClick={() => handleTranspose(-1)}
              title="Transposisi -1 semi-nada"
              className="flex items-center gap-0.5 rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-white/10"
            >
              <ArrowDown className="size-3" />
              <span>-1</span>
            </button>
            <button
              onClick={() => handleTranspose(12)}
              title="Transposisi +1 Oktaf"
              className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/10"
            >
              +12
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleQuantize(1.0, true)}
              title={`Kuantisasi 100% not ke grid (Mixcraft 10 Hlm. 280)`}
              className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition"
            >
              <Wand2 className="size-3" />
              <span>Kuantisasi (100%)</span>
            </button>
            <button
              onClick={() => handleQuantize(0.5, true)}
              title="Kuantisasi Lembut 50% (Human Groove Quantize, Mixcraft 10 Hlm. 281)"
              className="rounded-lg border border-violet-500/20 bg-white/5 px-1.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-white/10 transition"
            >
              50%
            </button>
            <button
              onClick={handleHumanize}
              title="Humanize: Variasikan timing mikro dan velocity secara acak alami (Mixcraft 10 Hlm. 282)"
              className="flex items-center gap-1 rounded-lg border border-pink-500/30 bg-pink-500/10 px-2 py-1 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 transition"
            >
              <Sparkles className="size-3" />
              <span>Humanize</span>
            </button>
            <button
              onClick={() => setShowVelocityLane(!showVelocityLane)}
              title="Tampilkan / Sembunyikan Jalur Velocitas Stalk (Mixcraft 10 Hlm. 285-290)"
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                showVelocityLane
                  ? "border-violet-500/40 bg-violet-500/20 text-violet-300 shadow-sm"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              <BarChart2 className="size-3" />
              <span>Velocitas</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white ml-1"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Piano Roll Grid & Keys */}
      <div
        ref={notesGridRef}
        onScroll={() => syncScroll("notes")}
        className="flex flex-1 overflow-auto"
      >
        {/* Piano Keys Sidebar */}
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-white/10 bg-black/85">
          {pitches.map((p) => {
            const black = isBlackKey(p);
            const inScale = scalePitches.includes(p % 12);
            return (
              <button
                key={p}
                onClick={() => handleAuditionPitch(p)}
                className={`w-full flex items-center justify-end pr-2 text-[10px] font-mono border-b cursor-pointer transition ${
                  black
                    ? "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                    : "bg-zinc-200 text-zinc-900 border-zinc-300 font-bold hover:bg-white"
                } ${inScale ? "" : "opacity-40"}`}
                style={{ height: `${rowHeight}px` }}
              >
                {getPitchLabel(p)}
              </button>
            );
          })}
        </div>

        {/* Note Grid */}
        <div
          className="relative min-w-full"
          style={{ width: `${durationBeats * pixelsPerBeat}px` }}
        >
          {/* Rows */}
          {pitches.map((p) => {
            const black = isBlackKey(p);
            const inScale = scalePitches.includes(p % 12);
            return (
              <div
                key={p}
                onClick={(e) => handleGridClick(e, p)}
                className={`relative border-b cursor-crosshair transition-colors ${
                  black
                    ? "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                    : "bg-transparent border-white/[0.08] hover:bg-white/[0.04]"
                } ${!inScale ? "bg-black/30" : ""}`}
                style={{ height: `${rowHeight}px` }}
              >
                {/* Beat vertical subdivisions */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: Math.ceil(durationBeats * snapDiv) }).map((_, step) => (
                    <div
                      key={step}
                      className={`h-full border-l ${
                        step % snapDiv === 0 ? "border-white/15" : "border-white/[0.03]"
                      }`}
                      style={{ width: `${pixelsPerBeat / snapDiv}px` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Notes Overlay */}
          {notes.map((note) => {
            const top = (maxPitch - note.pitch) * rowHeight;
            const left = note.startBeat * pixelsPerBeat;
            const width = Math.max(12, note.durationBeats * pixelsPerBeat);
            const isSelected = selectedNoteId === note.id;

            return (
              <div
                key={note.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNoteId(note.id);
                  handleAuditionPitch(note.pitch);
                }}
                className={`absolute rounded-xs flex items-center px-1 text-[9px] font-bold text-white shadow cursor-pointer select-none transition ${
                  isSelected
                    ? "bg-fuchsia-500 ring-2 ring-white z-20"
                    : "bg-violet-600 hover:bg-violet-500"
                }`}
                style={{
                  top: `${top + 1}px`,
                  left: `${left}px`,
                  width: `${width}px`,
                  height: `${rowHeight - 2}px`,
                  opacity: Math.max(0.4, note.velocity / 127),
                }}
              >
                <span className="truncate">{getPitchLabel(note.pitch)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Velocity Stalks Sub-Lane (Mixcraft 10 Hlm. 285–290) */}
      {showVelocityLane && (
        <div
          ref={velocityScrollRef}
          onScroll={() => syncScroll("velocity")}
          className="flex h-20 shrink-0 overflow-x-auto overflow-y-hidden border-t border-white/10 bg-black/90 select-none"
        >
          {/* Velocity Header / Scale sidebar */}
          <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-white/10 bg-zinc-950 flex flex-col justify-between py-1.5 px-2 text-[9px] font-mono text-zinc-500">
            <div className="flex items-center justify-between">
              <span className="font-bold text-violet-400">VEL</span>
              <span>127</span>
            </div>
            <div className="flex items-center justify-end text-[8px] text-zinc-600">
              <span>64</span>
            </div>
            <div className="flex items-center justify-end text-[8px]">
              <span>1</span>
            </div>
          </div>

          {/* Stalks Grid */}
          <div
            data-role="velocity-stalk-grid"
            onClick={handleVelocityLaneClick}
            className="relative cursor-crosshair"
            style={{ width: `${durationBeats * pixelsPerBeat}px` }}
          >
            {/* Beat subdivisions background */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: Math.ceil(durationBeats * snapDiv) }).map((_, step) => (
                <div
                  key={step}
                  className={`h-full border-l ${
                    step % snapDiv === 0 ? "border-white/10" : "border-white/[0.02]"
                  }`}
                  style={{ width: `${pixelsPerBeat / snapDiv}px` }}
                />
              ))}
            </div>

            {/* 50% guideline (velocity 64) */}
            <div className="absolute left-0 right-0 top-1/2 border-b border-white/[0.04] pointer-events-none" />

            {/* Velocity Stalks for each note */}
            {notes.map((note) => {
              const left = note.startBeat * pixelsPerBeat;
              const isSelected = selectedNoteId === note.id;
              const heightPercent = calculateStalkHeightPercent(note.velocity);

              return (
                <div
                  key={`vel_${note.id}`}
                  onMouseDown={(e) => handleStalkMouseDown(e, note.id)}
                  title={`${getPitchLabel(note.pitch)} — Vel: ${note.velocity}`}
                  className="absolute bottom-0 flex flex-col items-center group cursor-ns-resize z-10"
                  style={{
                    left: `${left + 4}px`,
                    height: `${heightPercent}%`,
                    width: "14px",
                    transform: "translateX(-50%)",
                  }}
                >
                  {/* Stalk Handle Pip */}
                  <div
                    className={`size-2.5 rounded-full border shadow-sm transition-transform group-hover:scale-125 ${
                      isSelected
                        ? "bg-fuchsia-400 border-white ring-2 ring-fuchsia-400/50"
                        : "bg-violet-400 border-violet-200 group-hover:bg-violet-300"
                    }`}
                  />
                  {/* Stalk Stem Line */}
                  <div
                    className={`w-0.5 flex-1 transition-colors ${
                      isSelected ? "bg-fuchsia-400" : "bg-violet-500/70 group-hover:bg-violet-400"
                    }`}
                  />
                  {/* Hover Velocity Tooltip */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black/90 text-white font-mono text-[9px] px-1 py-0.5 rounded border border-white/20 pointer-events-none transition whitespace-nowrap z-30">
                    {note.velocity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
