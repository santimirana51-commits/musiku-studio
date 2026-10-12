"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Music,
  Mic2,
  Video,
  Type,
  Snowflake,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  Flag,
  Target,
  Repeat,
  Plus,
  X,
  Activity,
  Upload,
  Volume2,
  VolumeX,
  Layers,
  List,
  Sparkles,
  GitMerge,
  MoveHorizontal,
} from "lucide-react";
import type {
  StudioClip,
  StudioProject,
  StudioTrack,
  StudioMarker,
  PunchRange,
  LoopRange,
  AutomationLane,
  TrackRegion,
} from "@/lib/studio/types";
import {
  adjustAutomationPoints,
  scaleAutomationPoints,
  invertAutomationPoints,
  getParameterBounds,
} from "@/lib/studio/automation";
import {
  splitRegionAtBeat,
  moveRegionAndClips,
  deleteRegion,
} from "@/lib/studio/track-regions";
import {
  applyAutoCrossfades,
  mergeClipsOnTrack,
  removeSpacesBetweenClips,
  duplicateAndMergeClip,
} from "@/lib/studio/clip-operations";
import { MarkerListDialog } from "./marker-list-dialog";

interface TimelineProps {
  project: StudioProject;
  currentBeat: number;
  selectedTrackId?: string;
  selectedClipId?: string;
  selectedClipIds?: string[];
  onSelectClips?: (clipIds: string[]) => void;
  onMergeClips?: (trackId: string, clipIds: string[]) => void;
  onRemoveSpaces?: (trackId: string, clipIds?: string[]) => void;
  onDuplicateAndMergeClip?: (trackId: string, clipId: string) => void;
  onSeek: (beat: number) => void;
  onSelectTrack: (trackId: string) => void;
  onSelectClip: (clip: StudioClip, track: StudioTrack) => void;
  onOpenPianoRoll: (clip: StudioClip, track: StudioTrack) => void;
  onUpdateClip: (trackId: string, clipId: string, updates: Partial<StudioClip>) => void;
  onDeleteClip: (trackId: string, clipId: string) => void;
  onDuplicateClip: (trackId: string, clip: StudioClip) => void;
  onSplitClip?: (trackId: string, clipId: string, splitBeat: number) => void;
  onImportAudioFile?: (trackId: string, file: File, atBeat?: number) => void;
  onUpdateProject?: (updates: Partial<StudioProject>) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<StudioTrack>) => void;
  showMasterTrack?: boolean;
  expandedAutomationTrackIds?: Set<string>;
  onToggleAutomationTrackId?: (trackId: string) => void;
  onAddLane?: (trackId: string) => void;
  onDeleteBottomLane?: (trackId: string) => void;
  onDeleteEmptyLanes?: (trackId: string) => void;
  onMuteLane?: (trackId: string, laneIndex: number) => void;
  onUnmuteLane?: (trackId: string, laneIndex: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onSeparateStems?: (trackId: string, clip: StudioClip) => void;
}

export function Timeline({
  project,
  currentBeat,
  selectedTrackId,
  selectedClipId,
  onSeek,
  onSelectTrack,
  onSelectClip,
  onOpenPianoRoll,
  onUpdateClip,
  onDeleteClip,
  onDuplicateClip,
  onSplitClip,
  onImportAudioFile,
  onUpdateProject,
  onUpdateTrack,
  onAddLane,
  onDeleteBottomLane,
  onDeleteEmptyLanes,
  onMuteLane,
  onUnmuteLane,
  showMasterTrack = false,
  expandedAutomationTrackIds: externalExpandedAutomation,
  onToggleAutomationTrackId,
  isPlaying = false,
  onPlay,
  onPause,
  onSeparateStems,
  selectedClipIds: externalSelectedClipIds,
  onSelectClips,
  onMergeClips,
  onRemoveSpaces,
  onDuplicateAndMergeClip,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(48); // Zoom
  const [snapBeat, setSnapBeat] = useState(1); // 1 = 1 beat, 0.5 = 1/2, 0.25 = 1/4
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [isMarkerListOpen, setIsMarkerListOpen] = useState(false);
  const [markerNameInput, setMarkerNameInput] = useState("");
  const [markerTempoInput, setMarkerTempoInput] = useState("");
  const [selectedAutomationParam, setSelectedAutomationParam] = useState<Record<string, string>>({});
  const [internalExpandedAutomation, setInternalExpandedAutomation] = useState<Set<string>>(new Set());
  const expandedAutomationTrackIds = externalExpandedAutomation ?? internalExpandedAutomation;
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [internalSelectedClipIds, setInternalSelectedClipIds] = useState<string[]>([]);
  const activeSelectedClipIds = externalSelectedClipIds ?? internalSelectedClipIds;

  const toggleAutomation = (trackId: string) => {
    if (onToggleAutomationTrackId) {
      onToggleAutomationTrackId(trackId);
    } else {
      setInternalExpandedAutomation((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
    }
  };

  const QUICK_MARKER_TAGS = ["Intro", "Verse 1", "Verse 2", "Chorus", "Bridge", "Drop", "Outro"];
  const MARKER_COLORS = ["#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#f43f5e"];

  // Dragging state for clips
  const [draggingClip, setDraggingClip] = useState<{
    trackId: string;
    clipId: string;
    startClientX: number;
    initialStartBeat: number;
    initialDuration: number;
    initialOffsetBeat?: number;
    isResizing: boolean;
    isResizingLeft?: boolean;
  } | null>(null);

  // Dragging state for automation breakpoints
  const [draggingPoint, setDraggingPoint] = useState<{
    trackId: string;
    laneId: string;
    pointIndex: number;
    parameterId: string;
    startClientX: number;
    startClientY: number;
    initialBeat: number;
    initialValue: number;
  } | null>(null);

  // Track Regions Song Arranger state (Mixcraft 10 Hlm. 199)
  const [showTrackRegions, setShowTrackRegions] = useState(true);
  const [regionMenu, setRegionMenu] = useState<{
    x: number;
    y: number;
    region: TrackRegion;
  } | null>(null);
  const [draggingRegion, setDraggingRegion] = useState<{
    region: TrackRegion;
    startClientX: number;
    initialStartBeat: number;
    isAlt: boolean;
    currentDeltaBeats: number;
  } | null>(null);

  const [clipContextMenu, setClipContextMenu] = useState<{
    x: number;
    y: number;
    trackId: string;
    laneIndex?: number;
    clip?: StudioClip;
  } | null>(null);
  const clipContextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (clipContextMenuRef.current && !clipContextMenuRef.current.contains(e.target as Node)) {
        setClipContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const totalBeats = Math.max(32, ...project.tracks.flatMap((t) => t.clips.map((c) => c.startBeat + c.durationBeats + 4)));
  const totalWidth = totalBeats * pixelsPerBeat;
  const beatsPerBar = project.timeSignature[0] || 4;

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawBeat = clickX / pixelsPerBeat;
    const snapped = snapBeat > 0 ? Math.round(rawBeat / snapBeat) * snapBeat : rawBeat;
    onSeek(Math.max(0, snapped));
  };

  const handleRulerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawBeat = clickX / pixelsPerBeat;
    const snapped = snapBeat > 0 ? Math.round(rawBeat / snapBeat) * snapBeat : Math.round(rawBeat);
    const color = MARKER_COLORS[project.markers.length % MARKER_COLORS.length];
    const newMarker: StudioMarker = {
      id: `m_${Date.now()}`,
      name: `Marker ${project.markers.length + 1}`,
      beat: Math.max(0, snapped),
      color,
    };
    const updated = [...project.markers, newMarker].sort((a, b) => a.beat - b.beat);
    onUpdateProject?.({ markers: updated });
  };

  const handleAddMarker = (name: string, tempo?: number) => {
    const color = MARKER_COLORS[project.markers.length % MARKER_COLORS.length];
    const newMarker: StudioMarker = {
      id: `m_${Date.now()}`,
      name: name || `Marker ${project.markers.length + 1}`,
      beat: Math.round(currentBeat),
      color,
      tempo: tempo && tempo > 0 ? Math.max(20, Math.min(320, tempo)) : undefined,
    };
    const updated = [...project.markers, newMarker].sort((a, b) => a.beat - b.beat);
    onUpdateProject?.({ markers: updated });
    setIsAddingMarker(false);
    setMarkerNameInput("");
    setMarkerTempoInput("");
  };

  const handleDeleteMarker = (id: string) => {
    const updated = project.markers.filter((m) => m.id !== id);
    onUpdateProject?.({ markers: updated });
  };

  const handleTogglePunch = () => {
    const current = project.punchRange || { enabled: false, startBeat: 4, endBeat: 8 };
    onUpdateProject?.({
      punchRange: {
        ...current,
        enabled: !current.enabled,
      },
    });
  };

  const handleToggleLoop = () => {
    onUpdateProject?.({
      loopRange: {
        ...project.loopRange,
        enabled: !project.loopRange.enabled,
      },
    });
  };

  // Mouse move and mouse up for dragging & resizing clips and automation points
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingClip) {
        const deltaX = e.clientX - draggingClip.startClientX;
        const deltaBeats = deltaX / pixelsPerBeat;

        if (draggingClip.isResizing) {
          const rawDur = draggingClip.initialDuration + deltaBeats;
          const snapped = snapBeat > 0 ? Math.round(rawDur / snapBeat) * snapBeat : rawDur;
          const newDur = Math.max(snapBeat || 0.25, snapped);
          onUpdateClip(draggingClip.trackId, draggingClip.clipId, { durationBeats: newDur });
        } else if (draggingClip.isResizingLeft) {
          const rawDelta = deltaBeats;
          const snappedDelta = snapBeat > 0 ? Math.round(rawDelta / snapBeat) * snapBeat : rawDelta;
          const maxShift = Math.max(0, draggingClip.initialDuration - 0.25);
          const clampedShift = Math.min(maxShift, snappedDelta);
          const newStart = Math.max(0, draggingClip.initialStartBeat + clampedShift);
          const actualShift = newStart - draggingClip.initialStartBeat;
          const newDur = Math.max(0.25, draggingClip.initialDuration - actualShift);
          const newOffset = Math.max(0, (draggingClip.initialOffsetBeat || 0) + actualShift);
          onUpdateClip(draggingClip.trackId, draggingClip.clipId, {
            startBeat: newStart,
            durationBeats: newDur,
            offsetBeat: newOffset,
          });
        } else {
          const rawStart = draggingClip.initialStartBeat + deltaBeats;
          const snapped = snapBeat > 0 ? Math.round(rawStart / snapBeat) * snapBeat : rawStart;
          const newStart = Math.max(0, snapped);
          onUpdateClip(draggingClip.trackId, draggingClip.clipId, { startBeat: newStart });
        }
      } else if (draggingPoint && onUpdateTrack) {
        const deltaX = e.clientX - draggingPoint.startClientX;
        const deltaBeats = deltaX / pixelsPerBeat;
        const rawBeat = draggingPoint.initialBeat + deltaBeats;
        const snappedBeat = snapBeat > 0 ? Math.round(rawBeat / snapBeat) * snapBeat : rawBeat;
        const newBeat = Math.max(0, snappedBeat);

        const deltaY = draggingPoint.startClientY - e.clientY;
        const targetTrack = project.tracks.find((t) => t.id === draggingPoint.trackId);
        if (targetTrack && targetTrack.automationLanes) {
          const lane = targetTrack.automationLanes.find((l) => l.id === draggingPoint.laneId);
          if (lane) {
            const bounds = getParameterBounds(draggingPoint.parameterId);
            const valueSpan = bounds.max - bounds.min;
            const deltaValue = (deltaY / 64) * valueSpan;
            const rawVal = draggingPoint.initialValue + deltaValue;
            const newValue = parseFloat(Math.max(bounds.min, Math.min(bounds.max, rawVal)).toFixed(3));

            const updatedPoints = lane.points.map((pt, idx) =>
              idx === draggingPoint.pointIndex ? { ...pt, beat: newBeat, value: newValue } : pt
            );
            const updatedLanes = targetTrack.automationLanes.map((l) =>
              l.id === lane.id ? { ...l, points: updatedPoints } : l
            );
            onUpdateTrack(targetTrack.id, { automationLanes: updatedLanes });
          }
        }
      } else if (draggingRegion) {
        const deltaX = e.clientX - draggingRegion.startClientX;
        const deltaBeatsRaw = deltaX / pixelsPerBeat;
        const snap = snapBeat > 0 ? snapBeat : 1;
        const snappedDelta = Math.round(deltaBeatsRaw / snap) * snap;
        setDraggingRegion((prev) =>
          prev ? { ...prev, currentDeltaBeats: snappedDelta, isAlt: e.altKey } : null
        );
      }
    };

    const handleMouseUp = () => {
      if (draggingClip) {
        if (onUpdateTrack) {
          const trk = project.tracks.find((t) => t.id === draggingClip.trackId);
          if (trk) {
            const crossfaded = applyAutoCrossfades(trk);
            onUpdateTrack(crossfaded.id, { clips: crossfaded.clips });
          }
        }
        setDraggingClip(null);
      }
      if (draggingPoint) setDraggingPoint(null);
      if (draggingRegion) {
        if (Math.abs(draggingRegion.currentDeltaBeats) >= 0.25 && onUpdateProject) {
          const updated = moveRegionAndClips(
            project,
            draggingRegion.region.id,
            draggingRegion.currentDeltaBeats,
            draggingRegion.isAlt
          );
          onUpdateProject(updated);
        }
        setDraggingRegion(null);
      }
    };

    if (draggingClip || draggingPoint || draggingRegion) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    draggingClip,
    draggingPoint,
    draggingRegion,
    pixelsPerBeat,
    snapBeat,
    onUpdateClip,
    onUpdateTrack,
    onUpdateProject,
    project,
  ]);

  const handleAddAutomationPoint = (
    track: StudioTrack,
    laneId: string,
    beat: number,
    value: number,
    parameterId: string = "volume"
  ) => {
    if (!onUpdateTrack) return;
    const lanes = track.automationLanes || [];
    const lane = lanes.find((l) => l.id === laneId);
    let updatedLanes: typeof lanes;

    if (!lane) {
      const bounds = getParameterBounds(parameterId);
      const newLane: AutomationLane = {
        id: laneId,
        target: (parameterId as any) || "volume",
        name: bounds.label,
        parameterId,
        enabled: true,
        points: [
          {
            beat: 0,
            value:
              parameterId === "volume"
                ? track.volume
                : parameterId === "pan"
                ? track.pan
                : bounds.defaultValue,
          },
          { beat, value },
        ].sort((a, b) => a.beat - b.beat),
      };
      updatedLanes = [...lanes, newLane];
    } else {
      const newPoints = [...lane.points, { beat, value }].sort((a, b) => a.beat - b.beat);
      updatedLanes = lanes.map((l) => (l.id === laneId ? { ...l, points: newPoints } : l));
    }
    onUpdateTrack(track.id, { automationLanes: updatedLanes });
  };

  const handleDeleteAutomationPoint = (
    track: StudioTrack,
    laneId: string,
    pointIndex: number
  ) => {
    if (!onUpdateTrack) return;
    const lane = track.automationLanes?.find((l) => l.id === laneId);
    if (!lane || lane.points.length <= 1) return;
    const updatedPoints = lane.points.filter((_, idx) => idx !== pointIndex);
    const updatedLanes = (track.automationLanes || []).map((l) =>
      l.id === laneId ? { ...l, points: updatedPoints } : l
    );
    onUpdateTrack(track.id, { automationLanes: updatedLanes });
  };

  const handleAdjustAutomationLane = (
    track: StudioTrack,
    laneId: string,
    delta: number,
    min = 0.0,
    max = 1.5
  ) => {
    if (!onUpdateTrack) return;
    const lane = track.automationLanes?.find((l) => l.id === laneId);
    if (!lane) return;
    const updatedPoints = adjustAutomationPoints(lane.points, delta, min, max);
    const updatedLanes = (track.automationLanes || []).map((l) =>
      l.id === laneId ? { ...l, points: updatedPoints } : l
    );
    onUpdateTrack(track.id, { automationLanes: updatedLanes });
  };

  const handleInvertAutomationLane = (
    track: StudioTrack,
    laneId: string,
    min = 0.0,
    max = 1.5
  ) => {
    if (!onUpdateTrack) return;
    const lane = track.automationLanes?.find((l) => l.id === laneId);
    if (!lane) return;
    const updatedPoints = invertAutomationPoints(lane.points, min, max);
    const updatedLanes = (track.automationLanes || []).map((l) =>
      l.id === laneId ? { ...l, points: updatedPoints } : l
    );
    onUpdateTrack(track.id, { automationLanes: updatedLanes });
  };

  const handleResetAutomationLane = (
    track: StudioTrack,
    laneId: string,
    defaultValue: number
  ) => {
    if (!onUpdateTrack) return;
    const updatedLanes = (track.automationLanes || []).map((l) =>
      l.id === laneId ? { ...l, points: [{ beat: 0, value: defaultValue }] } : l
    );
    onUpdateTrack(track.id, { automationLanes: updatedLanes });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-charcoal select-none">
      {/* Timeline Controls Bar (Snap, Zoom, Loop, Punch, Markers) */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-black/40 px-3 py-1.5 text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400">SNAP:</span>
          <select
            value={snapBeat}
            onChange={(e) => setSnapBeat(parseFloat(e.target.value))}
            className="rounded bg-white/10 px-2 py-0.5 text-xs text-white focus:outline-none"
          >
            <option value="1" className="bg-charcoal">1 Beat (1/4)</option>
            <option value="0.5" className="bg-charcoal">1/2 Beat (1/8)</option>
            <option value="0.25" className="bg-charcoal">1/4 Beat (1/16)</option>
            <option value="0" className="bg-charcoal">Off (Free)</option>
          </select>

          {/* Loop Range Toggle */}
          <button
            onClick={handleToggleLoop}
            title="Toggle Loop Cycle"
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono transition border ${
              project.loopRange.enabled
                ? "border-violet-500/50 bg-violet-600/30 text-violet-300 font-bold"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <Repeat className="size-2.5" />
            <span>LOOP: {project.loopRange.startBeat} - {project.loopRange.endBeat}b</span>
          </button>

          {/* Punch In / Out Toggle & Locators */}
          <button
            onClick={handleTogglePunch}
            title="Auto-Punch In / Punch Out Recording Locators"
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono transition border ${
              project.punchRange?.enabled
                ? "border-rose-500/60 bg-rose-600/25 text-rose-300 font-bold shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <Target className="size-2.5" />
            <span>PUNCH: {project.punchRange?.enabled ? `${project.punchRange.startBeat} - ${project.punchRange.endBeat}b` : "OFF"}</span>
          </button>

          {/* Track Regions Song Arranger Toggle (Mixcraft 10 Hlm. 199) */}
          <button
            onClick={() => setShowTrackRegions((v) => !v)}
            title="Tampilkan / Sembunyikan Bilah Song Track Regions (Mixcraft 10 Hlm. 199)"
            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
              showTrackRegions
                ? "border-sky-500/60 bg-sky-600/30 text-sky-200 font-bold shadow-sm"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="size-2.5" />
            <span>REGIONS {showTrackRegions ? "ON" : "OFF"}</span>
          </button>

          {/* Add Marker Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setIsAddingMarker((v) => !v)}
              title="Tambah Section Marker (Verse, Chorus, dll) di Playhead"
              className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:border-violet-500/50 hover:bg-violet-600/20 hover:text-white transition"
            >
              <Flag className="size-2.5 text-violet-400" />
              <span>+ Marker</span>
            </button>

            {isAddingMarker && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-48 rounded-xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 text-[11px] font-bold text-white">
                  <span>Marker @ {currentBeat.toFixed(1)}b</span>
                  <button onClick={() => setIsAddingMarker(false)} className="text-zinc-400 hover:text-white">
                    <X className="size-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {QUICK_MARKER_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleAddMarker(tag)}
                      className="rounded bg-white/5 px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-violet-600 hover:text-white transition text-left truncate"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Nama Custom..."
                      value={markerNameInput}
                      onChange={(e) => setMarkerNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && markerNameInput.trim()) {
                          const bpm = markerTempoInput ? parseInt(markerTempoInput) : undefined;
                          handleAddMarker(markerNameInput.trim(), bpm);
                        }
                      }}
                      className="flex-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => {
                        if (markerNameInput.trim()) {
                          const bpm = markerTempoInput ? parseInt(markerTempoInput) : undefined;
                          handleAddMarker(markerNameInput.trim(), bpm);
                        }
                      }}
                      className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-500"
                    >
                      Add
                    </button>
                  </div>
                  {/* Tempo Change Option (Mixcraft 10 Hlm. 479) */}
                  <div className="flex items-center justify-between text-[9px] text-zinc-400 pt-1 border-t border-white/5">
                    <span>Tempo BPM:</span>
                    <input
                      type="number"
                      placeholder="BPM opsional"
                      min={20}
                      max={320}
                      value={markerTempoInput}
                      onChange={(e) => setMarkerTempoInput(e.target.value)}
                      className="w-16 rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-amber-300 font-mono outline-none focus:ring-1 focus:ring-amber-500 text-right"
                    />
                  </div>
                  {/* Quick link to open full Marker List */}
                  <div className="pt-1.5 mt-1 border-t border-white/10">
                    <button
                      onClick={() => {
                        setIsAddingMarker(false);
                        setIsMarkerListOpen(true);
                      }}
                      className="w-full rounded bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 py-1 text-[10px] text-violet-300 font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <List className="size-3" />
                      <span>Buka Marker List Manager...</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Marker List Window Trigger (Mixcraft 10 Hlm. 524) */}
          <button
            onClick={() => setIsMarkerListOpen(true)}
            title="Buka Jendela Marker List (Mixcraft 10 Hlm. 524–528)"
            className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:border-violet-500/50 hover:bg-violet-600/20 hover:text-white transition"
          >
            <List className="size-2.5 text-violet-400" />
            <span>Marker List</span>
          </button>

          {/* Split Selected Clip at Playhead (Scissors) */}
          <button
            onClick={() => {
              if (selectedTrackId && selectedClipId && onSplitClip) {
                onSplitClip(selectedTrackId, selectedClipId, currentBeat);
              }
            }}
            disabled={!selectedClipId}
            title={selectedClipId ? "Belah klip terpilih di posisi playhead (B)" : "Pilih klip terlebih dahulu"}
            className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:border-amber-500/50 hover:bg-amber-600/20 hover:text-white transition disabled:opacity-40 disabled:pointer-events-none"
          >
            <Scissors className="size-2.5 text-amber-400" />
            <span>Split Clip</span>
          </button>

          {/* Toggle Automation Lanes */}
          <button
            onClick={() => {
              if (selectedTrackId) {
                toggleAutomation(selectedTrackId);
              } else if (project.tracks[0]) {
                toggleAutomation(project.tracks[0].id);
              }
            }}
            title="Buka/Tutup Garis Otomasi Parameter (Volume & Pan)"
            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
              expandedAutomationTrackIds.size > 0
                ? "border-cyan-500/50 bg-cyan-600/20 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
            }`}
          >
            <Activity className="size-2.5 text-cyan-400" />
            <span>Automation{expandedAutomationTrackIds.size > 0 ? ` (${expandedAutomationTrackIds.size})` : ""}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPixelsPerBeat((p) => Math.max(24, p - 8))}
            title="Zoom Out"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="font-mono text-[10px] text-zinc-500">{pixelsPerBeat}px</span>
          <button
            onClick={() => setPixelsPerBeat((p) => Math.min(128, p + 8))}
            title="Zoom In"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Tracks & Timeline Body */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-x-auto overflow-y-auto"
      >
        <div
          className="relative min-h-full"
          style={{ width: `${totalWidth}px` }}
        >
          {/* Top Beat Ruler with Markers Sub-lane */}
          <div
            onClick={handleRulerClick}
            onDoubleClick={handleRulerDoubleClick}
            className="sticky top-0 z-20 flex flex-col border-b border-white/15 bg-card/95 backdrop-blur cursor-pointer"
          >
            {/* Bars & Beats Numbers */}
            <div className="flex h-6">
              {Array.from({ length: Math.ceil(totalBeats) }).map((_, b) => {
                const isBar = b % beatsPerBar === 0;
                const barNum = Math.floor(b / beatsPerBar) + 1;
                return (
                  <div
                    key={b}
                    className={`relative flex items-center border-l ${
                      isBar ? "border-white/40 text-white font-bold" : "border-white/10 text-zinc-500"
                    }`}
                    style={{ width: `${pixelsPerBeat}px` }}
                  >
                    <span className="pl-1 text-[10px] font-mono">
                      {isBar ? barNum : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Section Markers & Punch Badges Sub-lane */}
            <div className="relative h-5 border-t border-white/5 bg-black/40">
              {project.markers.map((marker) => (
                <div
                  key={marker.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(marker.beat);
                  }}
                  className="group absolute top-0.5 z-30 flex items-center -translate-x-1 cursor-pointer transition hover:scale-105"
                  style={{ left: `${marker.beat * pixelsPerBeat}px` }}
                >
                  <div
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md border"
                    style={{
                      backgroundColor: marker.color || "#8b5cf6",
                      borderColor: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <Flag className="size-2" />
                    <span>{marker.name}</span>
                    {marker.tempo && (
                      <span className="rounded bg-black/50 px-1 font-mono text-[8px] text-amber-300 font-bold ml-0.5">
                        {marker.tempo} BPM
                      </span>
                    )}
                    {onUpdateProject && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMarker(marker.id);
                        }}
                        title="Hapus marker"
                        className="opacity-0 group-hover:opacity-100 ml-0.5 hover:text-rose-200 cursor-pointer font-bold"
                      >
                        ×
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Punch In / Out Ruler Badges */}
              {project.punchRange?.enabled && (
                <>
                  <div
                    className="absolute top-0.5 z-30 pointer-events-none -translate-x-1"
                    style={{ left: `${project.punchRange.startBeat * pixelsPerBeat}px` }}
                  >
                    <span className="rounded bg-rose-600 px-1 py-0.5 text-[8px] font-black text-white shadow">
                      P-IN
                    </span>
                  </div>
                  <div
                    className="absolute top-0.5 z-30 pointer-events-none -translate-x-1"
                    style={{ left: `${project.punchRange.endBeat * pixelsPerBeat}px` }}
                  >
                    <span className="rounded bg-rose-600 px-1 py-0.5 text-[8px] font-black text-white shadow">
                      P-OUT
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Track Regions Song Arranger Bar (Mixcraft 10 Hlm. 199–202) */}
            {showTrackRegions && (
              <div className="relative h-6 border-t border-white/10 bg-zinc-950/90 flex items-center overflow-hidden select-none">
                {(project.regions || []).map((region) => {
                  const isThisDragging = draggingRegion?.region.id === region.id;
                  const currentDelta = isThisDragging ? draggingRegion.currentDeltaBeats : 0;
                  const effectiveStart = Math.max(0, region.startBeat + currentDelta);
                  const effectiveEnd = Math.max(effectiveStart + 1, region.endBeat + currentDelta);
                  const leftPx = effectiveStart * pixelsPerBeat;
                  const widthPx = Math.max(24, (effectiveEnd - effectiveStart) * pixelsPerBeat);

                  return (
                    <div
                      key={region.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingRegion({
                          region,
                          startClientX: e.clientX,
                          initialStartBeat: region.startBeat,
                          isAlt: e.altKey,
                          currentDeltaBeats: 0,
                        });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRegionMenu({
                          x: e.clientX,
                          y: e.clientY,
                          region,
                        });
                      }}
                      title={`${region.name} (Bar ${Math.floor(region.startBeat / 4) + 1}–${Math.floor(region.endBeat / 4) + 1}). Drag: geser aransemen; [Alt]+Drag: duplikasi section!`}
                      className={`group absolute top-0.5 bottom-0.5 z-25 flex items-center justify-between rounded px-2 text-[9px] font-bold text-white shadow-sm border border-white/30 cursor-grab active:cursor-grabbing hover:brightness-110 transition ${
                        isThisDragging ? "ring-2 ring-white ring-offset-1 opacity-90 z-30" : ""
                      }`}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                        backgroundColor: region.color || "#8b5cf6",
                      }}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{region.name}</span>
                        <span className="text-[8px] opacity-75 font-mono">
                          (B{Math.floor(region.startBeat / 4) + 1}–{Math.floor(region.endBeat / 4) + 1})
                        </span>
                        {isThisDragging && (
                          <span className="rounded bg-black/60 px-1 font-mono text-[8px] text-amber-300">
                            {draggingRegion.isAlt ? "Copy" : "Move"}: {currentDelta >= 0 ? `+${currentDelta}` : currentDelta}b
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateProject && project.regions) {
                              const updated = splitRegionAtBeat(project.regions, currentBeat);
                              onUpdateProject({ ...project, regions: updated });
                            }
                          }}
                          title="Split Section di Playhead (Mixcraft 10 Hlm. 200)"
                          className="hover:text-amber-200 cursor-pointer text-[10px]"
                        >
                          ✂
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Loop Zone Overlay */}
          {project.loopRange.enabled && (
            <div
              className="absolute top-0 bottom-0 bg-violet-500/10 border-x border-violet-500/30 pointer-events-none z-10"
              style={{
                left: `${project.loopRange.startBeat * pixelsPerBeat}px`,
                width: `${(project.loopRange.endBeat - project.loopRange.startBeat) * pixelsPerBeat}px`,
              }}
            />
          )}

          {/* Punch Zone Overlay */}
          {project.punchRange?.enabled && (
            <div
              className="absolute top-0 bottom-0 bg-rose-500/10 border-x-2 border-rose-500/50 pointer-events-none z-15"
              style={{
                left: `${project.punchRange.startBeat * pixelsPerBeat}px`,
                width: `${Math.max(1, (project.punchRange.endBeat - project.punchRange.startBeat) * pixelsPerBeat)}px`,
              }}
            />
          )}

          {/* Vertical Marker Guide Lines */}
          {project.markers.map((marker) => (
            <div
              key={`guide_${marker.id}`}
              className="absolute top-0 bottom-0 pointer-events-none z-10 border-l border-dashed opacity-35"
              style={{
                left: `${marker.beat * pixelsPerBeat}px`,
                borderColor: marker.color || "#8b5cf6",
              }}
            />
          ))}

          {/* Playhead Vertical Line */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center transition-transform duration-75 ease-linear"
            style={{
              transform: `translateX(${currentBeat * pixelsPerBeat}px)`,
            }}
          >
            {/* Playhead Top Triangle */}
            <div className="size-0 border-x-4 border-x-transparent border-t-6 border-t-pink-500 shadow-sm" />
            <div className="w-0.5 flex-1 bg-pink-500/90 shadow-sm shadow-pink-500/50" />
          </div>

          {/* Track Lanes */}
          <div className="flex flex-col">
            {(() => {
              const isAnyTrackSoloed = project.tracks.some((t) => t.solo);
              return project.tracks.map((track) => {
                const isTrackSilenced = track.mute || (isAnyTrackSoloed && !track.solo);
                const laneCount = Math.max(track.laneCount || 1, ...track.clips.map((c) => (c.laneIndex ?? 0) + 1));
                const trackH = track.height || 96;
                const laneH = Math.max(34, Math.floor((trackH - 6) / laneCount));

                return (
                  <React.Fragment key={track.id}>
                    <div
                      onClick={() => onSelectTrack(track.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const clickedLane = Math.min(laneCount - 1, Math.max(0, Math.floor(clickY / laneH)));
                        setClipContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          trackId: track.id,
                          laneIndex: clickedLane,
                        });
                      }}
                      onDragOver={(e) => {
                        if (track.type === "audio") {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          if (dragOverTrackId !== track.id) setDragOverTrackId(track.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTrackId === track.id) setDragOverTrackId(null);
                      }}
                      onDrop={(e) => {
                        setDragOverTrackId(null);
                        if (track.type !== "audio" || !onImportAudioFile) return;
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dropX = e.clientX - rect.left;
                          const rawBeat = dropX / pixelsPerBeat;
                          const snapped = snapBeat > 0 ? Math.round(rawBeat / snapBeat) * snapBeat : rawBeat;
                          onImportAudioFile(track.id, file, Math.max(0, snapped));
                        }
                      }}
                      className={`relative border-b border-white/10 transition ${
                        isTrackSilenced ? "opacity-60" : ""
                      } ${
                        selectedTrackId === track.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                      }`}
                      style={{
                        height: `${trackH}px`,
                        backgroundImage: track.isFrozen
                          ? "repeating-linear-gradient(45deg, rgba(56, 189, 248, 0.04), rgba(56, 189, 248, 0.04) 10px, transparent 10px, transparent 20px)"
                          : isTrackSilenced
                          ? "repeating-linear-gradient(45deg, rgba(80, 80, 80, 0.04), rgba(80, 80, 80, 0.04) 10px, transparent 10px, transparent 20px)"
                          : undefined,
                      }}
                    >
                  {/* Drag-over dropzone indicator */}
                  {dragOverTrackId === track.id && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-pink-400 bg-pink-500/20 backdrop-blur-xs pointer-events-none">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-pink-200">
                        <Upload className="size-4 animate-bounce" />
                        Lepaskan berkas audio di sini untuk diimpor ke track {track.name}
                      </span>
                    </div>
                  )}

                  {/* Horizontal Grid Lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: Math.ceil(totalBeats) }).map((_, b) => (
                      <div
                        key={b}
                        className={`h-full border-l ${
                          b % beatsPerBar === 0 ? "border-white/[0.08]" : "border-white/[0.03]"
                        }`}
                        style={{ width: `${pixelsPerBeat}px` }}
                      />
                    ))}
                  </div>

                  {/* Mixcraft 10 Multi-Lane Sub-Dividers and Badges */}
                  {laneCount > 1 &&
                    Array.from({ length: laneCount - 1 }).map((_, idx) => (
                      <div
                        key={`lane_sub_${idx}`}
                        className="absolute left-0 right-0 border-b border-white/[0.07] pointer-events-none flex items-center px-2 z-0"
                        style={{ top: `${(idx + 1) * laneH}px` }}
                      >
                        <span className="text-[8px] font-mono font-bold text-zinc-500 bg-black/60 px-1 py-0.5 rounded">
                          Lane {idx + 2}
                        </span>
                      </div>
                    ))}
                  {laneCount > 1 && (
                    <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-zinc-500 bg-black/60 px-1 py-0.5 rounded pointer-events-none z-10">
                      Lane 1
                    </span>
                  )}

                  {/* Clips on this Track */}
                  {track.clips.map((clip) => {
                    const clipLeft = clip.startBeat * pixelsPerBeat;
                    const clipWidth = Math.max(16, clip.durationBeats * pixelsPerBeat);
                    const isClipSelected = selectedClipId === clip.id || activeSelectedClipIds.includes(clip.id);
                    const clipLaneIndex = Math.min(laneCount - 1, clip.laneIndex ?? 0);
                    const clipTop = 3 + clipLaneIndex * laneH;
                    const clipHeight = Math.max(28, laneH - 6);
                    const isClipMuted =
                      clip.muted ||
                      (track.mutedLaneIndices && track.mutedLaneIndices.includes(clipLaneIndex));

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrack(track.id);
                          onSelectClip(clip, track);
                          if (e.ctrlKey || e.metaKey || e.shiftKey) {
                            const next = activeSelectedClipIds.includes(clip.id)
                              ? activeSelectedClipIds.filter((id) => id !== clip.id)
                              : [...activeSelectedClipIds, clip.id];
                            setInternalSelectedClipIds(next);
                            onSelectClips?.(next);
                          } else {
                            setInternalSelectedClipIds([clip.id]);
                            onSelectClips?.([clip.id]);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setClipContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            trackId: track.id,
                            laneIndex: clipLaneIndex,
                            clip,
                          });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (clip.type === "midi") {
                            onOpenPianoRoll(clip, track);
                          }
                        }}
                        onMouseDown={(e) => {
                          // Prevent starting drag from resize handles
                          const role = (e.target as HTMLElement).dataset.role;
                          if (role === "resize" || role === "resize-left") return;
                          setDraggingClip({
                            trackId: track.id,
                            clipId: clip.id,
                            startClientX: e.clientX,
                            initialStartBeat: clip.startBeat,
                            initialDuration: clip.durationBeats,
                            initialOffsetBeat: clip.offsetBeat || 0,
                            isResizing: false,
                            isResizingLeft: false,
                          });
                        }}
                        className={`group absolute rounded-xl border p-1.5 cursor-grab active:cursor-grabbing overflow-hidden transition-all shadow-md select-none flex flex-col justify-between ${
                          isClipSelected
                            ? "ring-2 ring-white border-white brightness-110 z-10"
                            : "border-white/20 hover:border-white/40"
                        }`}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`,
                          top: `${clipTop}px`,
                          height: `${clipHeight}px`,
                          backgroundColor:
                            isTrackSilenced || isClipMuted
                              ? "rgba(60, 60, 60, 0.45)"
                              : `${track.color}35`,
                          borderColor:
                            isTrackSilenced || isClipMuted
                              ? "rgba(120, 120, 120, 0.45)"
                              : track.color,
                          backgroundImage:
                            isTrackSilenced || isClipMuted
                              ? "repeating-linear-gradient(45deg, rgba(140, 140, 140, 0.18), rgba(140, 140, 140, 0.18) 6px, transparent 6px, transparent 12px)"
                              : undefined,
                        }}
                      >
                        {/* Left Trim Handle (Non-destructive Start Trim, Mixcraft 10 Hlm. 206) */}
                        <div
                          data-role="resize-left"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingClip({
                              trackId: track.id,
                              clipId: clip.id,
                              startClientX: e.clientX,
                              initialStartBeat: clip.startBeat,
                              initialDuration: clip.durationBeats,
                              initialOffsetBeat: clip.offsetBeat || 0,
                              isResizing: false,
                              isResizingLeft: true,
                            });
                          }}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 transition rounded-l-xl z-20"
                          title="Trim Awal Klip (Mixcraft 10 Hlm. 206)"
                        />

                        {/* Visual Fade In Triangle Overlay (Mixcraft 10 Hlm. 210) */}
                        {clip.fadeInBeats && clip.fadeInBeats > 0 && (
                          <div
                            className="pointer-events-none absolute left-0 top-0 bottom-0 bg-white/20 border-r border-white/40 z-10"
                            style={{
                              width: `${Math.min(clipWidth, clip.fadeInBeats * pixelsPerBeat)}px`,
                              clipPath: "polygon(0 100%, 100% 0, 100% 100%)",
                            }}
                          />
                        )}

                        {/* Visual Fade Out Triangle Overlay (Mixcraft 10 Hlm. 210) */}
                        {clip.fadeOutBeats && clip.fadeOutBeats > 0 && (
                          <div
                            className="pointer-events-none absolute right-0 top-0 bottom-0 bg-white/20 border-l border-white/40 z-10"
                            style={{
                              width: `${Math.min(clipWidth, clip.fadeOutBeats * pixelsPerBeat)}px`,
                              clipPath: "polygon(0 0, 100% 100%, 0 100%)",
                            }}
                          />
                        )}

                        {/* Clip Header Label */}
                        <div className="flex items-center justify-between gap-1 overflow-hidden pointer-events-none relative z-10">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-white truncate">
                            {clip.type === "midi" ? (
                              <Music className="size-2.5 text-violet-300" />
                            ) : clip.type === "video" ? (
                              <Video className="size-2.5 text-cyan-300" />
                            ) : clip.type === "video-text" ? (
                              <Type className="size-2.5 text-blue-300" />
                            ) : (
                              <Mic2 className="size-2.5 text-pink-300" />
                            )}
                            <span className="truncate">{clip.name}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {clip.reversed && (
                              <span className="text-[7.5px] font-mono font-bold text-cyan-300 bg-black/60 px-1 py-0.2 rounded border border-cyan-500/30">
                                REV
                              </span>
                            )}
                            {Boolean(clip.pitchShiftSemitones) && (
                              <span className="text-[7.5px] font-mono font-bold text-violet-300 bg-black/60 px-1 py-0.2 rounded border border-violet-500/30">
                                {clip.pitchShiftSemitones! > 0 ? `+${clip.pitchShiftSemitones}` : clip.pitchShiftSemitones}st
                              </span>
                            )}
                            {isClipMuted && (
                              <span className="text-[7.5px] font-mono font-bold text-amber-300 bg-black/60 px-1 py-0.2 rounded border border-amber-500/30">
                                MUTED
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-zinc-400">
                              {clip.durationBeats.toFixed(1)}b
                            </span>
                          </span>
                        </div>

                        {/* Visual Content: Waveform or MIDI Note Ticks */}
                        <div className="flex-1 flex items-center overflow-hidden py-1 pointer-events-none opacity-80 relative z-10">
                          {track.isFrozen ? (
                            <div className="h-full w-full flex items-center justify-center gap-1 text-[9px] font-mono text-sky-300 font-bold">
                              <Snowflake className="size-3" />
                              <span>AUDIO FROZEN</span>
                            </div>
                          ) : clip.type === "midi" ? (
                            <div className="h-full w-full flex items-center gap-0.5 overflow-hidden">
                              {(clip.notes || []).map((n, i) => (
                                <div
                                  key={n.id || i}
                                  className="h-2 rounded-xs bg-white/70"
                                  style={{
                                    width: `${Math.max(4, n.durationBeats * (pixelsPerBeat / 4))}px`,
                                    opacity: n.velocity / 127,
                                  }}
                                />
                              ))}
                            </div>
                          ) : clip.type === "video" ? (
                            <div className="h-full w-full flex items-center justify-around border border-cyan-400/30 rounded bg-cyan-950/20 px-1 text-[9px] text-cyan-300 font-mono">
                              🎬 Video Stream Frame ({clip.durationBeats.toFixed(1)}b)
                            </div>
                          ) : clip.type === "video-text" ? (
                            <div className="h-full w-full flex items-center justify-center border border-blue-400/30 rounded bg-blue-950/20 px-1 text-[9px] text-blue-300 italic font-sans truncate">
                              &ldquo;{clip.textOverlay || clip.name}&rdquo;
                            </div>
                          ) : (
                            /* Audio Waveform Mock Preview */
                            <div className="h-full w-full flex items-center justify-around overflow-hidden gap-0.5">
                              {Array.from({ length: Math.min(40, Math.floor(clipWidth / 4)) }).map((_, i) => {
                                const h = 20 + Math.sin(i * 0.8) * 60;
                                return (
                                  <div
                                    key={i}
                                    className="w-0.5 bg-pink-300/80 rounded-full"
                                    style={{ height: `${h}%` }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Right Resize / Trim Handle (Mixcraft 10 Hlm. 206) */}
                        <div
                          data-role="resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingClip({
                              trackId: track.id,
                              clipId: clip.id,
                              startClientX: e.clientX,
                              initialStartBeat: clip.startBeat,
                              initialDuration: clip.durationBeats,
                              initialOffsetBeat: clip.offsetBeat || 0,
                              isResizing: true,
                              isResizingLeft: false,
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 transition rounded-r-xl z-20"
                          title="Resize / Trim Akhir Klip (Mixcraft 10 Hlm. 206)"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Automation Sub-Lane */}
                {expandedAutomationTrackIds.has(track.id) && (() => {
                  const activeParam = selectedAutomationParam[track.id] || "volume";
                  const bounds = getParameterBounds(activeParam);

                  const currentLane = track.automationLanes?.find(
                    (l) => l.parameterId === activeParam || l.target === activeParam
                  ) || {
                    id: `lane_${track.id}_${activeParam}`,
                    target: activeParam as any,
                    parameterId: activeParam,
                    name: bounds.label,
                    enabled: true,
                    points: [
                      {
                        beat: 0,
                        value:
                          activeParam === "volume"
                            ? track.volume
                            : activeParam === "pan"
                            ? track.pan
                            : bounds.defaultValue,
                      },
                    ],
                  };
                  const sortedPoints = [...currentLane.points].sort((a, b) => a.beat - b.beat);
                  const laneHeight = 64;

                  const valToY = (val: number) => {
                    const norm = Math.max(0, Math.min(1, (val - bounds.min) / (bounds.max - bounds.min)));
                    return laneHeight - norm * laneHeight;
                  };

                  const yToVal = (y: number) => {
                    const norm = Math.max(0, Math.min(1, (laneHeight - y) / laneHeight));
                    return bounds.min + norm * (bounds.max - bounds.min);
                  };

                  // Build SVG path
                  let pathD = "";
                  if (sortedPoints.length > 0) {
                    const firstX = sortedPoints[0].beat * pixelsPerBeat;
                    const firstY = valToY(sortedPoints[0].value);
                    pathD = `M 0 ${firstY} L ${firstX} ${firstY}`;
                    for (let i = 1; i < sortedPoints.length; i++) {
                      const px = sortedPoints[i].beat * pixelsPerBeat;
                      const py = valToY(sortedPoints[i].value);
                      pathD += ` L ${px} ${py}`;
                    }
                    const lastX = sortedPoints[sortedPoints.length - 1].beat * pixelsPerBeat;
                    const lastY = valToY(sortedPoints[sortedPoints.length - 1].value);
                    pathD += ` L ${totalWidth} ${lastY}`;
                  }

                  const refY = valToY(bounds.defaultValue);

                  return (
                    <div className="relative h-16 border-b border-cyan-500/30 bg-black/60 select-none">
                      {/* Background Beat Grids */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: Math.ceil(totalBeats) }).map((_, b) => (
                          <div
                            key={b}
                            className={`h-full border-l ${
                              b % beatsPerBar === 0 ? "border-cyan-500/15" : "border-white/[0.02]"
                            }`}
                            style={{ width: `${pixelsPerBeat}px` }}
                          />
                        ))}
                      </div>

                      {/* Header Badge & Instant Adjuster Tool (Mixcraft 10 Hlm. 477–478) */}
                      <div className="sticky left-2 top-1 z-10 inline-flex items-center gap-2 rounded-lg bg-cyan-950/90 px-2.5 py-1 text-[10px] font-bold text-cyan-300 border border-cyan-500/30 backdrop-blur shadow-md">
                        <Activity className="size-3 text-cyan-400" />

                        {/* Parameter Selector */}
                        <select
                          value={activeParam}
                          onChange={(e) =>
                            setSelectedAutomationParam((prev) => ({
                              ...prev,
                              [track.id]: e.target.value,
                            }))
                          }
                          className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 outline-none"
                        >
                          <option value="volume">Track Volume</option>
                          <option value="pan">Pan (L/R)</option>
                          <option value="reverb">Aux Reverb Send</option>
                          <option value="delay">Aux Delay Send</option>
                        </select>

                        {/* Instant Boost / Reduce Tools (Mixcraft 10 Hlm. 477–478) */}
                        <div className="flex items-center gap-1 border-l border-cyan-500/30 pl-2">
                          <button
                            onClick={() =>
                              handleAdjustAutomationLane(
                                track,
                                currentLane.id,
                                (bounds.max - bounds.min) * 0.1,
                                bounds.min,
                                bounds.max
                              )
                            }
                            title="Instant Boost +10% (Mixcraft 10 Hlm. 477)"
                            className="rounded bg-cyan-900/40 hover:bg-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200 border border-cyan-500/20"
                          >
                            +10%
                          </button>
                          <button
                            onClick={() =>
                              handleAdjustAutomationLane(
                                track,
                                currentLane.id,
                                -(bounds.max - bounds.min) * 0.1,
                                bounds.min,
                                bounds.max
                              )
                            }
                            title="Instant Reduce -10% (Mixcraft 10 Hlm. 477)"
                            className="rounded bg-cyan-900/40 hover:bg-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200 border border-cyan-500/20"
                          >
                            -10%
                          </button>
                          <button
                            onClick={() =>
                              handleInvertAutomationLane(
                                track,
                                currentLane.id,
                                bounds.min,
                                bounds.max
                              )
                            }
                            title="Invert Curve (Balikkan kurva secara simetris)"
                            className="rounded bg-cyan-900/40 hover:bg-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200 border border-cyan-500/20"
                          >
                            Invert
                          </button>
                          <button
                            onClick={() =>
                              handleResetAutomationLane(
                                track,
                                currentLane.id,
                                bounds.defaultValue
                              )
                            }
                            title="Reset garis ke nilai standar"
                            className="rounded bg-cyan-900/40 hover:bg-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200 border border-cyan-500/20"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* SVG Automation Graph */}
                      <svg
                        className="absolute inset-0 h-full cursor-crosshair"
                        style={{ width: `${totalWidth}px` }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const clickY = e.clientY - rect.top;
                          const rawBeat = clickX / pixelsPerBeat;
                          const snapped = snapBeat > 0 ? Math.round(rawBeat / snapBeat) * snapBeat : rawBeat;
                          const val = yToVal(clickY);
                          handleAddAutomationPoint(
                            track,
                            currentLane.id,
                            Math.max(0, snapped),
                            parseFloat(val.toFixed(3)),
                            activeParam
                          );
                        }}
                      >
                        {/* Reference Line at Default/Unity Value */}
                        <line
                          x1={0}
                          y1={refY}
                          x2={totalWidth}
                          y2={refY}
                          stroke="rgba(6, 182, 212, 0.25)"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />

                        {/* Automation Line */}
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Breakpoint Handles */}
                        {sortedPoints.map((pt, idx) => {
                          const cx = pt.beat * pixelsPerBeat;
                          const cy = valToY(pt.value);

                          return (
                            <g key={idx}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r="4.5"
                                className="fill-cyan-400 stroke-zinc-900 stroke-2 hover:fill-white cursor-grab active:cursor-grabbing transition-all"
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAutomationPoint(track, currentLane.id, idx);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDraggingPoint({
                                    trackId: track.id,
                                    laneId: currentLane.id,
                                    pointIndex: idx,
                                    parameterId: activeParam,
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    initialBeat: pt.beat,
                                    initialValue: pt.value,
                                  });
                                }}
                              />
                              <text
                                x={cx + 6}
                                y={cy - 4}
                                fill="#67e8f9"
                                fontSize="8"
                                fontFamily="monospace"
                                className="pointer-events-none select-none font-bold"
                              >
                                {pt.value.toFixed(2)}{bounds.unit}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          });
        })()}

        {/* Master Track Arrangement Lane */}
        {showMasterTrack && (
          <div
            className="relative border-b border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-zinc-950 to-zinc-900/90 h-24 select-none"
            style={{ width: `${totalWidth}px` }}
          >
            {/* Horizontal Grid Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: Math.ceil(totalBeats) }).map((_, b) => (
                <div
                  key={b}
                  className={`h-full border-l ${
                    b % beatsPerBar === 0 ? "border-amber-500/10" : "border-white/[0.02]"
                  }`}
                  style={{ width: `${pixelsPerBeat}px` }}
                />
              ))}
            </div>

            {/* Master Track status banner */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex items-center justify-between text-xs text-amber-300/80 pointer-events-none font-mono">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                <span>MASTER OUTPUT BUS LANE</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                Volume: {Math.round(project.masterTrack.volume * 100)}% • Limiter Active (-0.3dB)
              </span>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>

      {/* --- CLIP GRID & LANES CONTEXT MENU (Mixcraft 10) --- */}
      {clipContextMenu && (
        <div
          ref={clipContextMenuRef}
          className="fixed z-50 w-64 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl text-xs select-none"
          style={{ top: `${clipContextMenu.y}px`, left: `${clipContextMenu.x}px` }}
        >
          <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase tracking-wider border-b border-white/10 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Layers className="size-3 text-violet-400" />
              <span>Lane {(clipContextMenu.laneIndex ?? 0) + 1}</span>
            </span>
            <span
              title="Denny Laine: Rhythm guitarist & bassist in Wings in the 70s, and singer in The Moody Blues! (Acoustica Mixcraft Manual Easter Egg)"
              className="text-[9px] text-pink-400/80 cursor-help"
            >
              Denny Laine
            </span>
          </div>

          {/* Lanes Operations */}
          <div className="py-1 space-y-0.5 border-b border-white/10">
            <div className="px-2 py-0.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
              Lanes Menu
            </div>
            <button
              onClick={() => {
                onAddLane?.(clipContextMenu.trackId);
                setClipContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="size-3 text-emerald-400" />
                <span>Lanes &gt; Add</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Alt+L</span>
            </button>
            <button
              onClick={() => {
                onDeleteBottomLane?.(clipContextMenu.trackId);
                setClipContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
            >
              <span>Lanes &gt; Delete</span>
            </button>
            <button
              onClick={() => {
                onDeleteEmptyLanes?.(clipContextMenu.trackId);
                setClipContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
            >
              <span>Lanes &gt; Delete Empty Lanes</span>
              <span className="text-[10px] text-zinc-500 font-mono">Alt+K</span>
            </button>
            <button
              onClick={() => {
                onMuteLane?.(clipContextMenu.trackId, clipContextMenu.laneIndex ?? 0);
                setClipContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
            >
              <span className="flex items-center gap-1.5">
                <VolumeX className="size-3 text-amber-400" />
                <span>Lanes &gt; Mute All</span>
              </span>
            </button>
            <button
              onClick={() => {
                onUnmuteLane?.(clipContextMenu.trackId, clipContextMenu.laneIndex ?? 0);
                setClipContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
            >
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3 text-cyan-400" />
                <span>Lanes &gt; Unmute All</span>
              </span>
            </button>
          </div>

          {/* Clip Operations if a clip was clicked */}
          {clipContextMenu.clip ? (
            <div className="py-1 space-y-0.5">
              <div className="px-2 py-0.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                Clip: {clipContextMenu.clip.name}
              </div>
              {onSplitClip && (
                <button
                  onClick={() => {
                    onSplitClip(clipContextMenu.trackId, clipContextMenu.clip!.id, currentBeat);
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Scissors className="size-3 text-violet-400" />
                    <span>Split Clip at Playhead</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">B</span>
                </button>
              )}
              <button
                onClick={() => {
                  onDuplicateClip(clipContextMenu.trackId, clipContextMenu.clip!);
                  setClipContextMenu(null);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Copy className="size-3 text-sky-400" />
                  <span>Duplicate Clip</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Ctrl+D</span>
              </button>
              <button
                onClick={() => {
                  onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, {
                    muted: !clipContextMenu.clip!.muted,
                  });
                  setClipContextMenu(null);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
              >
                <span>{clipContextMenu.clip.muted ? "Unmute Clip" : "Mute Clip"}</span>
              </button>

              {/* Mixcraft 10 Merge Selected Clips [Ctrl+W] (Hlm. 210, 703) */}
              {activeSelectedClipIds.length >= 2 && onMergeClips && (
                <button
                  onClick={() => {
                    onMergeClips(clipContextMenu.trackId, activeSelectedClipIds);
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-emerald-300 hover:bg-emerald-500/20 transition text-xs font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <GitMerge className="size-3 text-emerald-400" />
                    <span>Merge Selected Clips ({activeSelectedClipIds.length})</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Ctrl+W</span>
                </button>
              )}

              {/* Mixcraft 10 Remove Spaces Between Clips [Ctrl+J] (Hlm. 703) */}
              {onRemoveSpaces && (
                <button
                  onClick={() => {
                    onRemoveSpaces(
                      clipContextMenu.trackId,
                      activeSelectedClipIds.length >= 2 ? activeSelectedClipIds : undefined
                    );
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-cyan-300 hover:bg-cyan-500/20 transition text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <MoveHorizontal className="size-3 text-cyan-400" />
                    <span>Remove Spaces Between Clips</span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Ctrl+J</span>
                </button>
              )}

              {/* Mixcraft 10 Double Length Loop (Duplicate & Merge — Hlm. 5453) */}
              {onDuplicateAndMergeClip && (
                <button
                  onClick={() => {
                    onDuplicateAndMergeClip(clipContextMenu.trackId, clipContextMenu.clip!.id);
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-amber-300 hover:bg-amber-500/20 transition text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <Copy className="size-3 text-amber-400" />
                    <span>Double Length Loop (2x)</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">2x Loop</span>
                </button>
              )}

              {/* Fade Presets (Mixcraft 10 Hlm. 210) */}
              <div className="border-t border-white/5 pt-1 mt-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Fade In</span>
                  <span className="text-zinc-500 font-mono">{(clipContextMenu.clip.fadeInBeats || 0)}b</span>
                </div>
                <div className="grid grid-cols-4 gap-1 px-2 py-0.5">
                  {[0, 0.5, 1, 2].map((beats) => (
                    <button
                      key={beats}
                      onClick={() => {
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, { fadeInBeats: beats });
                        setClipContextMenu(null);
                      }}
                      className={`text-[9px] rounded py-0.5 transition font-mono ${
                        (clipContextMenu.clip!.fadeInBeats || 0) === beats
                          ? "bg-violet-600 text-white font-bold"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {beats === 0 ? "Off" : `${beats}b`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-0.5">
                <div className="px-2 py-0.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Fade Out</span>
                  <span className="text-zinc-500 font-mono">{(clipContextMenu.clip.fadeOutBeats || 0)}b</span>
                </div>
                <div className="grid grid-cols-4 gap-1 px-2 py-0.5">
                  {[0, 0.5, 1, 2].map((beats) => (
                    <button
                      key={beats}
                      onClick={() => {
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, { fadeOutBeats: beats });
                        setClipContextMenu(null);
                      }}
                      className={`text-[9px] rounded py-0.5 transition font-mono ${
                        (clipContextMenu.clip!.fadeOutBeats || 0) === beats
                          ? "bg-violet-600 text-white font-bold"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {beats === 0 ? "Off" : `${beats}b`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch Transpose & Reverse (Mixcraft 10 Hlm. 221-222) */}
              <div className="border-t border-white/5 pt-1 mt-1 space-y-1">
                <div className="flex items-center justify-between px-2 text-xs text-zinc-300">
                  <span className="text-[10px] text-zinc-400">Pitch Transpose</span>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      onClick={() => {
                        const cur = clipContextMenu.clip!.pitchShiftSemitones || 0;
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, {
                          pitchShiftSemitones: Math.max(-24, cur - 1),
                        });
                        setClipContextMenu(null);
                      }}
                      className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20 text-white"
                      title="-1 Semitone"
                    >
                      -1st
                    </button>
                    <button
                      onClick={() => {
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, {
                          pitchShiftSemitones: 0,
                        });
                        setClipContextMenu(null);
                      }}
                      className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20 text-zinc-300"
                      title="Reset Transpose (0st)"
                    >
                      {clipContextMenu.clip!.pitchShiftSemitones || 0}st
                    </button>
                    <button
                      onClick={() => {
                        const cur = clipContextMenu.clip!.pitchShiftSemitones || 0;
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, {
                          pitchShiftSemitones: Math.min(24, cur + 1),
                        });
                        setClipContextMenu(null);
                      }}
                      className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20 text-white"
                      title="+1 Semitone"
                    >
                      +1st
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, {
                      reversed: !clipContextMenu.clip!.reversed,
                    });
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition text-xs"
                >
                  <span>{clipContextMenu.clip.reversed ? "Playback Normal (Unreverse)" : "Reverse Audio Clip"}</span>
                  <span className="text-[10px] text-cyan-400 font-mono">REV</span>
                </button>

                {/* Mixcraft 10 Separate Into Stems (Hlm. 650) */}
                {clipContextMenu.clip.type === "audio" && onSeparateStems && (
                  <button
                    onClick={() => {
                      onSeparateStems(clipContextMenu.trackId, clipContextMenu.clip!);
                      setClipContextMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-violet-300 hover:bg-violet-500/20 transition text-xs mt-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3 text-violet-400" />
                      <span>Separate Into Stems...</span>
                    </span>
                    <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1 py-0.5 rounded font-mono font-bold">
                      PRO
                    </span>
                  </button>
                )}
              </div>

              {/* Clip Gain Presets (Mixcraft 10 Hlm. 218) */}
              <div className="border-t border-white/5 pt-1 mt-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Clip Gain</span>
                  <span className="text-zinc-500 font-mono">{Math.round((clipContextMenu.clip.gain ?? 1) * 100)}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1 px-2 py-0.5">
                  {[0.5, 1.0, 1.5, 2.0].map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        onUpdateClip(clipContextMenu.trackId, clipContextMenu.clip!.id, { gain: g });
                        setClipContextMenu(null);
                      }}
                      className={`text-[9px] rounded py-0.5 transition font-mono ${
                        (clipContextMenu.clip!.gain ?? 1) === g
                          ? "bg-violet-600 text-white font-bold"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {Math.round(g * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5 pt-1 mt-1">
                <button
                  onClick={() => {
                    onDeleteClip(clipContextMenu.trackId, clipContextMenu.clip!.id);
                    setClipContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-red-400 hover:bg-red-500/20 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="size-3" />
                    <span>Delete Clip</span>
                  </span>
                  <span className="text-[10px] text-red-400 font-mono">Del</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="px-2 py-1 text-[10px] text-zinc-500 italic">
              Klik kanan pada klip untuk opsi pemotongan &amp; duplikasi.
            </div>
          )}
        </div>
      )}

      {/* Context Menu for Track Region (Mixcraft 10 Hlm. 199–202) */}
      {regionMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRegionMenu(null)} />
          <div
            className="fixed z-50 w-60 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur text-xs animate-in fade-in duration-100 select-none"
            style={{
              top: `${Math.min(window.innerHeight - 200, regionMenu.y)}px`,
              left: `${Math.min(window.innerWidth - 250, regionMenu.x)}px`,
            }}
          >
            <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 border-b border-white/10 uppercase flex justify-between items-center">
              <span>Section: {regionMenu.region.name}</span>
              <span className="font-mono text-[9px] text-zinc-500">
                B{Math.floor(regionMenu.region.startBeat / 4) + 1}–{Math.floor(regionMenu.region.endBeat / 4) + 1}
              </span>
            </div>
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => {
                  if (onUpdateProject && project.regions) {
                    const updated = splitRegionAtBeat(project.regions, currentBeat);
                    onUpdateProject({ ...project, regions: updated });
                  }
                  setRegionMenu(null);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-white transition text-left"
              >
                <Scissors className="size-3.5 text-amber-400" />
                <span>Split di Playhead (Beat {currentBeat.toFixed(1)})</span>
              </button>
              <button
                onClick={() => {
                  if (onUpdateProject) {
                    const span = regionMenu.region.endBeat - regionMenu.region.startBeat;
                    const updated = moveRegionAndClips(project, regionMenu.region.id, span, true);
                    onUpdateProject(updated);
                  }
                  setRegionMenu(null);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-white transition text-left"
              >
                <Copy className="size-3.5 text-emerald-400" />
                <span>Duplikasi Section ([Alt]+Drag)</span>
              </button>
              <button
                onClick={() => {
                  if (onUpdateProject) {
                    const updated = deleteRegion(project, regionMenu.region.id, true);
                    onUpdateProject(updated);
                  }
                  setRegionMenu(null);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-red-500/20 text-rose-300 transition text-left"
              >
                <Trash2 className="size-3.5 text-rose-400" />
                <span>Ripple Delete (Hapus & Rapatkan)</span>
              </button>
              <button
                onClick={() => {
                  if (onUpdateProject) {
                    const updated = deleteRegion(project, regionMenu.region.id, false);
                    onUpdateProject(updated);
                  }
                  setRegionMenu(null);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition text-left"
              >
                <X className="size-3.5 text-zinc-400" />
                <span>Hapus Label Section Saja</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Marker List Window (Mixcraft 10 Hlm. 524–528) */}
      <MarkerListDialog
        isOpen={isMarkerListOpen}
        onClose={() => setIsMarkerListOpen(false)}
        project={project}
        currentBeat={currentBeat}
        isPlaying={isPlaying}
        onSeek={onSeek}
        onPlay={onPlay || (() => {})}
        onPause={onPause || (() => {})}
        onUpdateProject={onUpdateProject || (() => {})}
      />
    </div>
  );
}
