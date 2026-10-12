"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic2,
  Music,
  Piano,
  Guitar,
  Drum,
  Sliders,
  Trash2,
  Volume2,
  Upload,
  Plus,
  Snowflake,
  Sun,
  Copy,
  ChevronUp,
  ChevronDown,
  Video,
  Type,
  FolderTree,
  Sparkles,
  Palette,
  Activity,
  MoreVertical,
  Disc,
  Link as LinkIcon,
  Unlink,
  Check,
  Headphones,
  Image as ImageIcon,
  Power,
  Layers,
  Radio,
  ChevronRight,
  VolumeX,
  Film,
  Minus,
} from "lucide-react";
import type { StudioTrack, SubgroupBus, TrackType, AudioDriverType } from "@/lib/studio/types";

export function TuningForkIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 3v6a5 5 0 0 0 10 0V3" />
      <path d="M12 14v7" />
      <circle cx="12" cy="21" r="1" fill="currentColor" />
    </svg>
  );
}

export function SquigglyWaveIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12c3-8 6-8 9 0s6 8 9 0" />
    </svg>
  );
}

export const GUITAR_TUNER_STRINGS = [
  { note: "E2", freq: 82.41, label: "6th (Low E)" },
  { note: "A2", freq: 110.00, label: "5th (A)" },
  { note: "D3", freq: 146.83, label: "4th (D)" },
  { note: "G3", freq: 196.00, label: "3rd (G)" },
  { note: "B3", freq: 246.94, label: "2nd (B)" },
  { note: "E4", freq: 329.63, label: "1st (High E)" },
];

export function getTunerState(activeMeter: number, stringIndex: number) {
  const current = GUITAR_TUNER_STRINGS[stringIndex % GUITAR_TUNER_STRINGS.length];
  if (activeMeter < 0.02) {
    return {
      note: current.note,
      freq: current.freq,
      cents: 0,
      inTune: false,
      hasSignal: false,
      label: current.label,
    };
  }
  // Subtle fluctuating deviation around centered 0 cents to simulate pitch detection
  const cents = Math.round(Math.sin(Date.now() / 900 + stringIndex) * 8);
  const inTune = Math.abs(cents) <= 2;
  return {
    note: current.note,
    freq: current.freq,
    cents,
    inTune,
    hasSignal: true,
    label: current.label,
  };
}

export const TRACK_IMAGE_PRESETS = [
  { id: "vocal", label: "Lead Vocals", icon: Mic2, color: "#ec4899" },
  { id: "acoustic_guitar", label: "Acoustic Guitar", icon: Guitar, color: "#f59e0b" },
  { id: "electric_guitar", label: "Electric Guitar", icon: Guitar, color: "#ef4444" },
  { id: "bass", label: "Bass Guitar", icon: Guitar, color: "#3b82f6" },
  { id: "drums", label: "Drum Kit", icon: Drum, color: "#eab308" },
  { id: "piano", label: "Grand Piano", icon: Piano, color: "#8b5cf6" },
  { id: "synth", label: "Synthesizer / Keys", icon: Activity, color: "#06b6d4" },
  { id: "strings", label: "Strings", icon: Music, color: "#10b981" },
  { id: "brass", label: "Brass / Horns", icon: Music, color: "#f97316" },
  { id: "fx", label: "FX / Textures", icon: Sparkles, color: "#d946ef" },
];

export const TRACK_ICON_OPTIONS = [
  { id: "mic", label: "Vocal / Mic", icon: Mic2 },
  { id: "piano", label: "Piano / Keys", icon: Piano },
  { id: "guitar", label: "Guitar", icon: Guitar },
  { id: "drums", label: "Drums / Beat", icon: Drum },
  { id: "synth", label: "Synthesizer", icon: Activity },
  { id: "music", label: "Instrument", icon: Music },
  { id: "video", label: "Video", icon: Video },
  { id: "text", label: "Video Text", icon: Type },
  { id: "submix", label: "Submix / Group", icon: FolderTree },
  { id: "send", label: "Send / FX", icon: Sparkles },
  { id: "output", label: "Output / Master", icon: Disc },
  { id: "vocoder", label: "Vocoder / Voice Synth", icon: Activity },
];

export const TRACK_COLOR_PALETTE = [
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#71717a", // Zinc / Gray
];

export const TRACK_HEIGHT_PRESETS = [
  { label: "Small", height: 64 },
  { label: "Normal", height: 96 },
  { label: "Large", height: 144 },
  { label: "Super Big Gulp X-Treme™", height: 240 },
];

export const LINK_GROUP_COLORS: Record<string, string> = {
  group_1: "#10b981",
  group_2: "#eab308",
  group_3: "#06b6d4",
  group_4: "#ec4899",
  group_5: "#8b5cf6",
  group_6: "#f97316",
};

export function renderTrackTypeIcon(
  type: TrackType,
  iconId?: string,
  customImageUrl?: string,
  className = "size-3"
) {
  if (customImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customImageUrl}
        alt="Custom icon"
        className={`${className} object-cover rounded-xs`}
      />
    );
  }
  const key = (iconId || type).toLowerCase();
  switch (key) {
    case "piano":
    case "keys":
      return <Piano className={className} />;
    case "guitar":
      return <Guitar className={className} />;
    case "drums":
    case "drum":
      return <Drum className={className} />;
    case "video":
      return <Video className={className} />;
    case "text":
    case "video-text":
      return <Type className={className} />;
    case "submix":
      return <FolderTree className={className} />;
    case "send":
    case "fx":
      return <Sparkles className={className} />;
    case "output":
      return <Disc className={className} />;
    case "vocoder":
      return <Activity className={className} />;
    case "mic":
    case "vocal":
    case "vocals":
    case "audio":
      return <Mic2 className={className} />;
    case "synth":
      return <Activity className={className} />;
    case "music":
    case "midi":
    default:
      return <Music className={className} />;
  }
}

export const AVAILABLE_INSERT_EFFECTS: Array<{
  pluginId: string;
  name: string;
  defaultParams: Record<string, number>;
}> = [
  { pluginId: "internal.eq3", name: "3-Band EQ", defaultParams: { lowGain: 0, midGain: 0, highGain: 0 } },
  { pluginId: "internal.compressor", name: "Compressor", defaultParams: { threshold: -24, ratio: 4, attack: 0.005, release: 0.1 } },
  { pluginId: "internal.limiter", name: "Peak Limiter", defaultParams: { threshold: -0.3, release: 0.05 } },
  { pluginId: "internal.reverb", name: "Reverb", defaultParams: { mix: 0.25, decay: 1.5, preDelay: 0.02 } },
  { pluginId: "internal.delay", name: "Stereo Delay", defaultParams: { time: 0.25, feedback: 0.35, mix: 0.2 } },
  { pluginId: "internal.filter_lowpass", name: "Lowpass Filter", defaultParams: { cutoff: 2000, resonance: 1 } },
  { pluginId: "internal.chorus", name: "Chorus", defaultParams: { rate: 1.5, depth: 0.002, mix: 0.3 } },
];

interface TrackHeaderProps {
  track: StudioTrack;
  trackIndex?: number;
  buses?: SubgroupBus[];
  meterLevel: number;
  inputMeterLevel?: number;
  audioDriver?: AudioDriverType;
  isSelected: boolean;
  selectedTrackCount?: number;
  showEffectsOnTracks?: boolean;
  onToggleEffectsOnTracks?: () => void;
  isAutomationLaneOpen?: boolean;
  onToggleAutomationLane?: (trackId: string) => void;
  onSelect: (e: React.MouseEvent) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onUpdateTrackRelative?: (trackId: string, field: "volume" | "pan", delta: number) => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenPluginDialog: (trackId: string) => void;
  onCloseAllEffectWindows?: () => void;
  onImportAudioFile?: (trackId: string, file: File) => void;
  onDuplicateTrack?: (trackId: string) => void;
  onMixToNewAudioTrack?: (trackId: string) => void;
  onToggleFreezeTrack?: (trackId: string) => void;
  onMoveTrack?: (trackId: string, direction: "up" | "down") => void;
  onResizeAllTracks?: (height: number) => void;
  onLinkSelectedTracks?: () => void;
  onUnlinkTrack?: (trackId: string) => void;
  onUnlinkAllInGroup?: (linkGroupId: string) => void;
  onMuteCtrlClick?: (trackId: string) => void;
  onSoloCtrlClick?: (trackId: string) => void;
  onInsertTrackAbove?: (targetTrackId: string, type: TrackType) => void;
  onSelectAllClips?: (trackId: string) => void;
  onSelectAllLinkedTracks?: (linkGroupId: string) => void;
  onAddLane?: (trackId: string) => void;
  onDeleteBottomLane?: (trackId: string) => void;
  onDeleteEmptyLanes?: (trackId: string) => void;
  onMuteAllLanes?: (trackId: string) => void;
  onUnmuteAllLanes?: (trackId: string) => void;
  onCycleTrackHeight?: () => void;
  onMoveInstrument?: (sourceTrackId: string, targetTrackId: string) => void;
  onCopyInstrument?: (sourceTrackId: string, targetTrackId: string) => void;
  hasVideoTextTrack?: boolean;
  isVideoWindowOpen?: boolean;
  onToggleVideoWindow?: () => void;
  onToggleVideoTextTrack?: (videoTrackId: string) => void;
}

export function TrackHeader({
  track,
  trackIndex = 0,
  buses,
  meterLevel,
  inputMeterLevel,
  audioDriver = "wavert",
  isSelected,
  selectedTrackCount = 1,
  showEffectsOnTracks = false,
  onToggleEffectsOnTracks,
  isAutomationLaneOpen = false,
  onToggleAutomationLane,
  onSelect,
  onUpdateTrack,
  onDeleteTrack,
  onOpenPluginDialog,
  onCloseAllEffectWindows,
  onImportAudioFile,
  onDuplicateTrack,
  onMixToNewAudioTrack,
  onToggleFreezeTrack,
  onMoveTrack,
  onResizeAllTracks,
  onLinkSelectedTracks,
  onUnlinkTrack,
  onUnlinkAllInGroup,
  onMuteCtrlClick,
  onSoloCtrlClick,
  onInsertTrackAbove,
  onSelectAllClips,
  onSelectAllLinkedTracks,
  onAddLane,
  onDeleteBottomLane,
  onDeleteEmptyLanes,
  onMuteAllLanes,
  onUnmuteAllLanes,
  onCycleTrackHeight,
  onMoveInstrument,
  onCopyInstrument,
  hasVideoTextTrack,
  isVideoWindowOpen,
  onToggleVideoWindow,
  onToggleVideoTextTrack,
}: TrackHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(track.name);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isArmMenuOpen, setIsArmMenuOpen] = useState(false);
  const [menuPersist, setMenuPersist] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<
    "insert" | "color" | "link" | "lanes" | "properties" | null
  >(null);
  const [activeStringIndex, setActiveStringIndex] = useState(0);
  const [exactValueModal, setExactValueModal] = useState<"volume" | "pan" | null>(null);
  const [exactInputVal, setExactInputVal] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [effectContextMenu, setEffectContextMenu] = useState<{
    x: number;
    y: number;
    pluginIndex: number;
  } | null>(null);
  const [isAddEffectOpen, setIsAddEffectOpen] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const armMenuRef = useRef<HTMLDivElement>(null);
  const volFaderRef = useRef<HTMLDivElement>(null);
  const panFaderRef = useRef<HTMLDivElement>(null);
  const effectMenuRef = useRef<HTMLDivElement>(null);
  const addEffectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameInput(track.name);
  }, [track.name]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (armMenuRef.current && !armMenuRef.current.contains(e.target as Node)) {
        setIsArmMenuOpen(false);
      }
      if (effectMenuRef.current && !effectMenuRef.current.contains(e.target as Node)) {
        setEffectContextMenu(null);
      }
      if (addEffectRef.current && !addEffectRef.current.contains(e.target as Node)) {
        setIsAddEffectOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (nameInput.trim()) {
      onUpdateTrack(track.id, { name: nameInput.trim() });
    } else {
      setNameInput(track.name);
    }
  };

  const trackHeight = track.height || 96;
  const isCompact = trackHeight < 80;

  // Active level meter: Output during normal playback, Input when armed
  const activeMeter = track.armRecord
    ? (inputMeterLevel !== undefined ? inputMeterLevel : meterLevel)
    : meterLevel;

  // Linear volume to percentage (0% to 200%) and dB
  const volPct = Math.round(track.volume * 100);
  const volDb =
    track.volume <= 0.0001
      ? "-Inf dB"
      : `${(20 * Math.log10(track.volume)).toFixed(1)} dB`;

  // Pan display: L100 to R100, C for center
  const panText =
    track.pan === 0
      ? "C"
      : track.pan < 0
      ? `L${Math.round(Math.abs(track.pan) * 100)}`
      : `R${Math.round(track.pan * 100)}`;

  // Link group color if linked
  const linkColor = track.linkGroupId ? LINK_GROUP_COLORS[track.linkGroupId] || "#10b981" : null;

  // --- VERTICAL RESIZE DRAG HANDLER ---
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = trackHeight;
    const shiftKeyHeld = e.shiftKey;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(56, Math.min(320, startHeight + deltaY));
      if (shiftKeyHeld && onResizeAllTracks) {
        onResizeAllTracks(newHeight);
      } else {
        onUpdateTrack(track.id, { height: newHeight });
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (upEvent.shiftKey && onResizeAllTracks) {
        const deltaY = upEvent.clientY - startY;
        const newHeight = Math.max(56, Math.min(320, startHeight + deltaY));
        onResizeAllTracks(newHeight);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // --- VOLUME SLIDER DRAG HANDLER (WITH FINE ADJUSTMENT ON ALT/SHIFT/CTRL) ---
  const handleVolMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return; // left click only
    const rect = volFaderRef.current?.getBoundingClientRect();
    if (!rect) return;

    const calculateVol = (clientX: number, isFine: boolean, startX: number, initialVol: number) => {
      if (isFine) {
        const delta = ((clientX - startX) / rect.width) * 0.2; // 10x finer
        return Math.max(0, Math.min(2.0, initialVol + delta));
      }
      const raw = ((clientX - rect.left) / rect.width) * 2.0;
      return Math.max(0, Math.min(2.0, Math.round(raw * 100) / 100));
    };

    const initialClientX = e.clientX;
    const initialVol = track.volume;
    const isFine = e.altKey || e.shiftKey || e.ctrlKey;
    const newVol = calculateVol(e.clientX, isFine, initialClientX, initialVol);
    onUpdateTrack(track.id, { volume: newVol });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const fine = moveEvent.altKey || moveEvent.shiftKey || moveEvent.ctrlKey;
      const nextVol = calculateVol(moveEvent.clientX, fine, initialClientX, initialVol);
      onUpdateTrack(track.id, { volume: nextVol });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // --- PAN SLIDER DRAG HANDLER (WITH FINE ADJUSTMENT ON ALT/SHIFT/CTRL) ---
  const handlePanMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const rect = panFaderRef.current?.getBoundingClientRect();
    if (!rect) return;

    const calculatePan = (clientX: number, isFine: boolean, startX: number, initialPan: number) => {
      if (isFine) {
        const delta = ((clientX - startX) / rect.width) * 0.2; // 10x finer
        return Math.max(-1.0, Math.min(1.0, initialPan + delta));
      }
      const ratio = (clientX - rect.left) / rect.width; // 0 to 1
      const raw = (ratio * 2.0) - 1.0; // -1 to 1
      return Math.max(-1.0, Math.min(1.0, Math.round(raw * 20) / 20));
    };

    const initialClientX = e.clientX;
    const initialPan = track.pan;
    const isFine = e.altKey || e.shiftKey || e.ctrlKey;
    const newPan = calculatePan(e.clientX, isFine, initialClientX, initialPan);
    onUpdateTrack(track.id, { pan: newPan });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const fine = moveEvent.altKey || moveEvent.shiftKey || moveEvent.ctrlKey;
      const nextPan = calculatePan(moveEvent.clientX, fine, initialClientX, initialPan);
      onUpdateTrack(track.id, { pan: nextPan });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Exact value modal submit
  const handleExactSubmit = () => {
    if (exactValueModal === "volume") {
      const clean = exactInputVal.trim().toLowerCase();
      let targetLin = 1.0;
      if (clean.endsWith("%")) {
        const pct = parseFloat(clean);
        if (!isNaN(pct)) targetLin = Math.max(0, Math.min(2.0, pct / 100));
      } else if (clean.endsWith("db")) {
        const db = parseFloat(clean);
        if (!isNaN(db)) targetLin = Math.max(0, Math.min(2.0, Math.pow(10, db / 20)));
      } else {
        const val = parseFloat(clean);
        if (!isNaN(val)) {
          // If > 2 treat as %
          targetLin = val > 2 ? Math.max(0, Math.min(2.0, val / 100)) : Math.max(0, Math.min(2.0, val));
        }
      }
      onUpdateTrack(track.id, { volume: targetLin });
    } else if (exactValueModal === "pan") {
      const clean = exactInputVal.trim().toUpperCase();
      let targetPan = 0;
      if (clean === "C" || clean === "CENTER") {
        targetPan = 0;
      } else if (clean.startsWith("L")) {
        const val = parseFloat(clean.replace("L", ""));
        if (!isNaN(val)) targetPan = -Math.max(0, Math.min(1.0, val > 1 ? val / 100 : val));
      } else if (clean.startsWith("R")) {
        const val = parseFloat(clean.replace("R", ""));
        if (!isNaN(val)) targetPan = Math.max(0, Math.min(1.0, val > 1 ? val / 100 : val));
      } else {
        const val = parseFloat(clean);
        if (!isNaN(val)) targetPan = Math.max(-1.0, Math.min(1.0, val > 1 ? val / 100 : val));
      }
      onUpdateTrack(track.id, { pan: targetPan });
    }
    setExactValueModal(null);
  };

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className={`group relative flex w-64 shrink-0 flex-col justify-between border-b border-r border-white/10 p-2.5 transition select-none ${
          track.isFrozen
            ? "bg-sky-950/25 border-l-4 border-sky-400"
            : isSelected
            ? "bg-white/10 border-l-4 ring-1 ring-inset ring-white/20"
            : "bg-charcoal/80 hover:bg-white/5"
        }`}
        style={{
          height: `${trackHeight}px`,
          borderLeftColor: track.isFrozen ? "#38bdf8" : track.color,
          backgroundImage: track.isFrozen
            ? "repeating-linear-gradient(45deg, rgba(56, 189, 248, 0.03), rgba(56, 189, 248, 0.03) 10px, transparent 10px, transparent 20px)"
            : undefined,
        }}
      >
        {/* Far-left Vertical Color Bar & Link Group Indicator */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsAppearanceOpen(true);
          }}
          title={`Warna Track: ${track.color}. Klik untuk mengubah warna & gambar track.`}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-pointer hover:w-2.5 transition-all z-20 flex flex-col justify-between"
          style={{ backgroundColor: track.color }}
        >
          {track.linkGroupId && (
            <div
              title={`Tergabung di Link Group (${track.linkGroupId})`}
              className="w-full h-1/2"
              style={{ backgroundColor: linkColor || "#10b981" }}
            />
          )}
        </div>

        {/* Right Edge Double-Horizontal Arrow Grip (Mixcraft 10 standard: hover reveals double-arrow cursor to toggle insert effects slots) */}
        {onToggleEffectsOnTracks && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleEffectsOnTracks();
            }}
            title={
              showEffectsOnTracks
                ? "Sembunyikan Efek Insert Track (Klik / Drag untuk menutup)"
                : "Tampilkan Efek Insert Track (Klik / Drag ke kanan untuk membuka Show Effects On Tracks)"
            }
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:w-2.5 hover:bg-purple-500/50 transition-all z-20 flex items-center justify-center opacity-0 group-hover:opacity-100"
          >
            <div className="w-0.5 h-6 rounded-full bg-purple-400/60" />
          </div>
        )}

        {/* Top Section: Track Number, Type, Name, Track Image Thumbnail, and Action Icons */}
        <div className="flex flex-col gap-1 pl-1">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Mixcraft 10 Constant Track Number (#1, #2, ...) */}
              <span
                title={`Track #${trackIndex + 1}. Dalam Mixcraft, penomoran selalu mulai dari 1 di paling atas dan berurutan ke bawah secara konstan.`}
                className="flex items-center justify-center px-1.5 py-0.5 rounded bg-black/70 border border-white/10 font-mono text-[9px] font-black text-zinc-300 shrink-0 select-none shadow-xs"
              >
                #{trackIndex + 1}
              </span>

              {/* Clickable Track Type Icon Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAppearanceOpen(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsAppearanceOpen(true);
                }}
                title="Pilih Ikon, Gambar, atau Warna Track"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider hover:brightness-125 transition cursor-pointer shrink-0"
                style={{
                  backgroundColor: track.isFrozen ? "rgba(56, 189, 248, 0.25)" : `${track.color}40`,
                  color: track.isFrozen ? "#38bdf8" : track.color,
                }}
              >
                {renderTrackTypeIcon(track.type, track.icon, track.customImageUrl, "size-3")}
                <span className="truncate max-w-[42px]">{track.type}</span>
              </button>

              {/* Link Chain Icon if Track is Linked */}
              {track.linkGroupId && (
                <span
                  title={`Track terhubung (Linked: ${track.linkGroupId}). Perubahan volume, pan, mute, solo berlaku serentak.`}
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-black text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 shrink-0"
                >
                  <LinkIcon className="size-2.5 text-emerald-400" />
                </span>
              )}

              {/* Frozen Status Pill */}
              {track.isFrozen && (
                <span className="flex items-center gap-0.5 rounded bg-sky-500/20 px-1 py-0.5 text-[8px] font-black font-mono text-sky-300 border border-sky-400/30 shrink-0">
                  <Snowflake className="size-2 text-sky-300 animate-pulse" />
                  FROZEN
                </span>
              )}

              {/* Track Name (Double-click rename, Enter / Blur to commit) */}
              {isEditingName ? (
                <input
                  type="text"
                  value={nameInput}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSubmit();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                  className="w-24 rounded bg-black/70 px-1 text-xs font-bold text-white outline-none ring-1 ring-violet-500"
                />
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingName(true);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingName(true);
                  }}
                  title="Klik untuk mengubah nama track (Enter / klik di luar untuk simpan)"
                  className="text-xs font-bold text-white truncate cursor-pointer hover:underline"
                >
                  {track.name}
                </span>
              )}
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
              {track.type === "audio" && onImportAudioFile && !track.isFrozen && (
                <label
                  onClick={(e) => e.stopPropagation()}
                  title="Impor berkas audio (WAV, MP3, OGG, FLAC)"
                  className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-pink-300 transition"
                >
                  <Upload className="size-3" />
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onImportAudioFile(track.id, file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              )}

              {/* Plugin & Instrument FX button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPluginDialog(track.id);
                }}
                title="Edit FX & Virtual Instruments"
                className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <Sliders className="size-3" />
              </button>

              {/* Context menu toggle button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ x: rect.right, y: rect.bottom });
                }}
                title="Opsi Lanjutan Track (Klik Kanan)"
                className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <MoreVertical className="size-3" />
              </button>
            </div>
          </div>

          {/* Track Image Thumbnail beneath Track Name (Mixcraft 10 standard) */}
          {!isCompact && (
            <div
              className="flex items-center gap-1.5"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsAppearanceOpen(true);
              }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAppearanceOpen(true);
                }}
                title="Track Image (Double-click untuk memilih gambar atau ikon dari library Mixcraft)"
                className="relative size-5 rounded overflow-hidden border border-white/15 bg-black/60 flex items-center justify-center cursor-pointer hover:border-violet-400 transition shrink-0 group/img"
              >
                {track.customImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.customImageUrl}
                    alt={track.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className="size-full flex items-center justify-center"
                    style={{ backgroundColor: `${track.color}25`, color: track.color }}
                  >
                    {renderTrackTypeIcon(track.type, track.icon, undefined, "size-2.5")}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                  <ImageIcon className="size-2 text-white" />
                </div>
              </div>
              <span className="text-[9px] text-zinc-400 truncate max-w-[140px] select-none">
                {track.customImageUrl ? "Custom Artwork" : `${track.icon || track.type} Image`}
              </span>
            </div>
          )}
        </div>

        {/* Middle Row: Mute, Solo, Arm Record + Audio Inputs Menu, FX button, Automation, Software Monitoring, Tuner, and BUS OUT */}
        {!isCompact && (
          <div className="flex items-center gap-1 pl-1 flex-wrap">
            {/* Virtual Instrument Keyboard Button next to Mute (Mixcraft 10 standard) */}
            {track.type === "midi" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPluginDialog(track.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const sourceId = e.dataTransfer.getData("application/x-musiku-instrument-track-id");
                  if (sourceId && sourceId !== track.id) {
                    if (e.altKey && onCopyInstrument) {
                      onCopyInstrument(sourceId, track.id);
                    } else if (onMoveInstrument) {
                      onMoveInstrument(sourceId, track.id);
                    }
                  }
                }}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("application/x-musiku-instrument-track-id", track.id);
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                title="Virtual Instrument (Keyboard Icon). Klik untuk membuka editor instrumen virtual / synth. Drag untuk memindahkan ke track lain, Alt+Drag untuk copy."
                className="size-5.5 rounded text-[10px] font-black border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-800/60 hover:text-white transition cursor-pointer flex items-center justify-center shadow-xs group/keybtn"
              >
                <Piano className="size-3 group-hover/keybtn:scale-110 transition-transform" />
              </button>
            )}

            {/* MUTE Button: Turns BLUE when active in Mixcraft 10 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if ((e.ctrlKey || e.metaKey) && onMuteCtrlClick) {
                  onMuteCtrlClick(track.id);
                } else {
                  onUpdateTrack(track.id, { mute: !track.mute });
                }
              }}
              title={
                track.mute
                  ? "Unmute Track (Ctrl+M). Tip: Ctrl+Click untuk mute 'solo'."
                  : "Mute Track (Ctrl+M). Tip: Ctrl+Click untuk un-mute semua."
              }
              className={`size-5.5 rounded text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                track.mute
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/40 ring-1 ring-blue-400"
                  : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              M
            </button>

            {/* SOLO Button: Turns BLUE when active in Mixcraft 10 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if ((e.ctrlKey || e.metaKey) && onSoloCtrlClick) {
                  onSoloCtrlClick(track.id);
                } else {
                  onUpdateTrack(track.id, { solo: !track.solo });
                }
              }}
              title={
                track.solo
                  ? "Unsolo Track (Ctrl+L). Tip: Ctrl+Click untuk mematikan semua solo."
                  : "Solo Track (Ctrl+L). Tip: Ctrl+Click untuk solo track ini saja."
              }
              className={`size-5.5 rounded text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                track.solo
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/40 ring-1 ring-blue-400"
                  : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              S
            </button>

            {/* VIDEO TRACK CONTROLS (Mixcraft 10 Specification: Show/Hide Video Window & Show/Hide Video Text Track +/- Sign) */}
            {track.type === "video" && (
              <>
                {/* SHOW/HIDE VIDEO WINDOW */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVideoWindow?.();
                  }}
                  title={
                    isVideoWindowOpen
                      ? "Sembunyikan Jendela Video Preview (Show/Hide Video Window)"
                      : "Tampilkan Jendela Video Preview (Show/Hide Video Window)"
                  }
                  className={`size-5.5 rounded border transition cursor-pointer flex items-center justify-center ${
                    isVideoWindowOpen
                      ? "bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-500/40 ring-1 ring-cyan-300"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Film className="size-3" />
                </button>

                {/* SHOW/HIDE VIDEO TEXT TRACK (+/- SIGN) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVideoTextTrack?.(track.id);
                  }}
                  title={
                    hasVideoTextTrack
                      ? "Sembunyikan / Hapus Video Text Track di bawahnya (- Sign)"
                      : "Tampilkan / Tambahkan Video Text Track di bawahnya (+ Sign)"
                  }
                  className={`size-5.5 rounded border transition cursor-pointer flex items-center justify-center ${
                    hasVideoTextTrack
                      ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/40"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-blue-500/20 hover:text-blue-300"
                  }`}
                >
                  {hasVideoTextTrack ? <Minus className="size-3" /> : <Plus className="size-3" />}
                </button>
              </>
            )}

            {/* VIDEO TEXT TRACK CONTROLS (Mixcraft 10 Specification: Text clip quick button) */}
            {track.type === "video-text" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPluginDialog(track.id);
                }}
                title="Video Text Track: Tambahkan judul, teks lirik, atau kredit subtitle"
                className="h-5.5 px-1.5 rounded border border-blue-500/40 bg-blue-950/40 text-blue-300 hover:bg-blue-800/60 hover:text-white transition cursor-pointer flex items-center gap-1 text-[9px] font-bold"
              >
                <Type className="size-2.5" />
                <span>Text</span>
              </button>
            )}

            {/* ARM Button + Downward Arrow Menu (Audio, MIDI, etc.) */}
            {!track.isFrozen && track.type !== "video" && track.type !== "video-text" && (
              <div className="relative flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { armRecord: !track.armRecord });
                  }}
                  title={
                    track.armRecord
                      ? "Disarm Record. Meter berfungsi sebagai Input Meter saat aktif."
                      : "Arm Record for Multitrack Recording (Merah terang saat aktif)."
                  }
                  className={`h-5.5 rounded-l px-1.5 text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                    track.armRecord
                      ? "bg-red-600 text-white shadow-md shadow-red-500/50 animate-pulse"
                      : "border-y border-l border-white/10 bg-white/5 text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
                  }`}
                >
                  R
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsArmMenuOpen(!isArmMenuOpen);
                  }}
                  title="Menu Audio Inputs (Menu Persist, hardware device, inputs, Takes/Overdub/Replace, tuner, monitoring)"
                  className={`h-5.5 rounded-r px-0.5 border-y border-r transition cursor-pointer flex items-center justify-center ${
                    track.armRecord
                      ? "bg-red-700 text-white border-red-500 hover:bg-red-600"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ChevronDown className="size-2.5" />
                </button>

                {/* Audio Inputs Menu Popover (Mixcraft 10 Specification) */}
                {isArmMenuOpen && (
                  <div
                    ref={armMenuRef}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-7 z-50 w-64 rounded-xl border border-white/15 bg-zinc-950 p-2.5 shadow-2xl backdrop-blur-md text-xs select-none"
                  >
                    {/* Header + Menu Persist Switch */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                        Audio Inputs Menu
                      </span>
                      {/* Menu Persist Switch (Blue Horizontal Slider) */}
                      <label
                        title="Menu Persist Switch: Menjaga menu tetap terbuka saat memilih banyak opsi"
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <span className="text-[9px] font-bold text-sky-400">Persist</span>
                        <div
                          onClick={() => setMenuPersist(!menuPersist)}
                          className={`relative inline-flex h-3.5 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            menuPersist ? "bg-blue-600" : "bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-2.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              menuPersist ? "translate-x-3.5" : "translate-x-0"
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    {track.type === "audio" ? (
                      <div className="space-y-2.5 py-0.5">
                        {/* Audio Device Selection Popup Menu */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            Audio Device Input:
                          </label>
                          <select
                            value={track.audioDeviceId || "default"}
                            onChange={(e) => {
                              onUpdateTrack(track.id, { audioDeviceId: e.target.value });
                              if (!menuPersist) setIsArmMenuOpen(false);
                            }}
                            className="w-full rounded-lg bg-black/70 px-2 py-1 text-xs text-white border border-white/15 outline-none"
                          >
                            <option value="default">Default System Audio Device</option>
                            <option value="mic_internal">Microphone (Built-in High Definition)</option>
                            <option value="usb_interface">USB Audio Interface (2 In, 2 Out)</option>
                            <option value="stereo_mix">Stereo Mix / Loopback</option>
                          </select>
                        </div>

                        {/* Inputs Select: Stereo, Left, Right */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            Inputs Select:
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: "stereo", label: "Stereo (1/2)" },
                                { id: "mono-left", label: "Left (Mono Mic)" },
                                { id: "mono-right", label: "Right (Line)" },
                              ] as const
                            ).map((inp) => {
                              const isCur = (track.inputChannelMode || "stereo") === inp.id;
                              return (
                                <button
                                  key={inp.id}
                                  onClick={() => {
                                    onUpdateTrack(track.id, {
                                      inputChannelMode: inp.id,
                                      inputSource:
                                        inp.id === "mono-left"
                                          ? "input_1"
                                          : inp.id === "mono-right"
                                          ? "input_2"
                                          : "all",
                                    });
                                    if (!menuPersist) setIsArmMenuOpen(false);
                                  }}
                                  className={`rounded-md py-1 px-1 text-[10px] font-bold transition border truncate cursor-pointer ${
                                    isCur
                                      ? "bg-violet-600 border-violet-400 text-white shadow-xs"
                                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {inp.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Recording Mode: Takes, Overdub, Replace */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            Recording Mode:
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: "takes", label: "Takes" },
                                { id: "overdub", label: "Overdub" },
                                { id: "replace", label: "Replace" },
                              ] as const
                            ).map((mode) => {
                              const isCur = (track.recordingMode || "takes") === mode.id;
                              return (
                                <button
                                  key={mode.id}
                                  onClick={() => {
                                    onUpdateTrack(track.id, { recordingMode: mode.id });
                                    if (!menuPersist) setIsArmMenuOpen(false);
                                  }}
                                  title={
                                    mode.id === "takes"
                                      ? "Mode Takes: Merekam alternate take lanes"
                                      : mode.id === "overdub"
                                      ? "Mode Overdub: Menumpuk audio di atas klip yang ada"
                                      : "Mode Replace: Menimpa audio klip pada posisi perekaman"
                                  }
                                  className={`rounded-md py-1 px-1 text-[10px] font-black transition border truncate cursor-pointer ${
                                    isCur
                                      ? "bg-blue-600 border-blue-400 text-white shadow-xs"
                                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {mode.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Checkbox Options: Monitor, Tuner, Performance Panel, Arm */}
                        <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                          {/* Monitor Track */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Headphones className="size-3 text-cyan-400" />
                              Monitor Track (Software Monitoring)
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.monitoringEnabled}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { monitoringEnabled: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-cyan-500 cursor-pointer"
                            />
                          </div>

                          {/* Guitar Tuner */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <TuningForkIcon className="size-3 text-blue-400" />
                              Guitar Tuner
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.isTunerActive}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { isTunerActive: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-blue-500 cursor-pointer"
                            />
                          </div>

                          {/* Arm For Performance Panel */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Layers className="size-3 text-amber-400" />
                              Arm For Performance Panel
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.armForPerformancePanel}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { armForPerformancePanel: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-amber-500 cursor-pointer"
                            />
                          </div>

                          {/* Arm Track For Recording */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Radio className="size-3 text-red-400" />
                              Arm Track For Recording
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.armRecord}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { armRecord: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-red-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ) : track.type === "midi" ? (
                      <div className="space-y-2.5 py-0.5">
                        {/* MIDI Input Device Selection Popup Menu */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            MIDI Input Device Selection:
                          </label>
                          <select
                            value={track.midiInputDeviceId || "all"}
                            onChange={(e) => {
                              onUpdateTrack(track.id, { midiInputDeviceId: e.target.value });
                              if (!menuPersist) setIsArmMenuOpen(false);
                            }}
                            className="w-full rounded-lg bg-black/70 px-2 py-1 text-xs text-white border border-white/15 outline-none"
                          >
                            <option value="all">All MIDI Devices (Default)</option>
                            <option value="mtk">Musical Typing Keyboard (MTK / QWERTY)</option>
                            <option value="usb_keyboard">USB / MIDI Keyboard Controller</option>
                            <option value="drum_pad">Drum Pad Controller</option>
                            <option value="midi_guitar">MIDI Guitar Controller</option>
                            <option value="ewi">EWI Wind Controller (80s Electronic Wind)</option>
                          </select>
                        </div>

                        {/* MIDI Channel Selection Buttons (All Omni / Ch 1-16) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-zinc-400">MIDI Channel:</label>
                            <span className="text-[9px] text-amber-400 font-semibold">
                              {(track.midiChannel || 0) === 0 ? "Omni (All Channels)" : `Channel ${track.midiChannel}`}
                            </span>
                          </div>
                          <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto pr-0.5 scrollbar-none">
                            <button
                              onClick={() => {
                                onUpdateTrack(track.id, { midiChannel: 0 });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className={`col-span-2 rounded py-0.5 text-[9px] font-bold border transition cursor-pointer ${
                                (track.midiChannel || 0) === 0
                                  ? "bg-amber-600 border-amber-400 text-white shadow-xs"
                                  : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                              }`}
                            >
                              All (Omni)
                            </button>
                            {Array.from({ length: 16 }).map((_, i) => {
                              const ch = i + 1;
                              const isCur = (track.midiChannel || 0) === ch;
                              return (
                                <button
                                  key={ch}
                                  onClick={() => {
                                    onUpdateTrack(track.id, { midiChannel: ch });
                                    if (!menuPersist) setIsArmMenuOpen(false);
                                  }}
                                  className={`rounded py-0.5 text-[9px] font-bold border transition cursor-pointer ${
                                    isCur
                                      ? "bg-amber-600 border-amber-400 text-white shadow-xs"
                                      : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {ch}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Recording Mode: Takes, Overdub, Replace */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            Recording Mode:
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: "takes", label: "Takes" },
                                { id: "overdub", label: "Overdub" },
                                { id: "replace", label: "Replace" },
                              ] as const
                            ).map((mode) => {
                              const isCur = (track.recordingMode || "takes") === mode.id;
                              return (
                                <button
                                  key={mode.id}
                                  onClick={() => {
                                    onUpdateTrack(track.id, { recordingMode: mode.id });
                                    if (!menuPersist) setIsArmMenuOpen(false);
                                  }}
                                  title={
                                    mode.id === "takes"
                                      ? "Mode Takes: Merekam alternate take lanes (take sebelumnya di-mute)"
                                      : mode.id === "overdub"
                                      ? "Mode Overdub: Menumpuk nada MIDI di atas klip yang ada"
                                      : "Mode Replace: Menimpa nada MIDI pada rentang waktu rekaman"
                                  }
                                  className={`rounded-md py-1 px-1 text-[10px] font-black transition border truncate cursor-pointer ${
                                    isCur
                                      ? "bg-amber-600 border-amber-400 text-white shadow-xs"
                                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {mode.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Automatic Quantization Popup Menu */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                            Automatic Quantization:
                          </label>
                          <select
                            value={track.autoQuantize || "off"}
                            onChange={(e) => {
                              onUpdateTrack(track.id, { autoQuantize: e.target.value });
                              if (!menuPersist) setIsArmMenuOpen(false);
                            }}
                            className="w-full rounded-lg bg-black/70 px-2 py-1 text-xs text-white border border-white/15 outline-none"
                          >
                            <option value="off">Off (Raw Timing)</option>
                            <option value="1/4">1/4 Note (Quarter)</option>
                            <option value="1/8">1/8 Note (Eighth)</option>
                            <option value="1/16">1/16 Note (Sixteenth)</option>
                            <option value="1/32">1/32 Note (Thirty-second)</option>
                            <option value="1/8T">1/8 Triplet</option>
                            <option value="1/16T">1/16 Triplet</option>
                          </select>
                        </div>

                        {/* Checkbox Options: Snap Notes To Scale, Arm For Performance Panel, Arm Track */}
                        <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                          {/* Snap Notes To Scale */}
                          <div className="flex items-center justify-between">
                            <span
                              className="flex items-center gap-1.5 text-[11px] text-zinc-300"
                              title="Snaps incoming notes to the key signature and scale set in the transport area"
                            >
                              <Sparkles className="size-3 text-amber-400" />
                              Snap Notes To Scale
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.snapNotesToScale}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { snapNotesToScale: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-amber-500 cursor-pointer"
                            />
                          </div>

                          {/* Arm For Performance Panel */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Layers className="size-3 text-amber-400" />
                              Arm For Performance Panel
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.armForPerformancePanel}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { armForPerformancePanel: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-amber-500 cursor-pointer"
                            />
                          </div>

                          {/* Arm Track For Recording */}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Radio className="size-3 text-red-400" />
                              Arm Track For Recording
                            </span>
                            <input
                              type="checkbox"
                              checked={!!track.armRecord}
                              onChange={(e) => {
                                onUpdateTrack(track.id, { armRecord: e.target.checked });
                                if (!menuPersist) setIsArmMenuOpen(false);
                              }}
                              className="size-3.5 accent-red-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 py-1">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Kanal:</label>
                          <select
                            value={track.midiChannel || 0}
                            onChange={(e) => {
                              onUpdateTrack(track.id, { midiChannel: parseInt(e.target.value) });
                              if (!menuPersist) setIsArmMenuOpen(false);
                            }}
                            className="w-full rounded bg-black/60 px-1.5 py-1 text-xs text-white border border-white/10 outline-none"
                          >
                            <option value={0}>Semua Kanal (Omni)</option>
                            {Array.from({ length: 16 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                Kanal {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FX LIST BUTTON (fx) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenPluginDialog(track.id);
              }}
              title="Buka FX List Window (fx) untuk memilih efek dan preset"
              className="h-5.5 rounded px-1.5 text-[9px] font-black border border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-800/60 hover:text-white transition cursor-pointer flex items-center justify-center shadow-xs"
            >
              fx
            </button>

            {/* OPEN AUTOMATION LANE (SQUIGGLY LINE ICON) */}
            {onToggleAutomationLane && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAutomationLane(track.id);
                }}
                title="Buka Track Automation Lane (Volume Automation) di bawah track"
                className={`size-5.5 rounded border transition cursor-pointer flex items-center justify-center ${
                  isAutomationLaneOpen
                    ? "bg-cyan-500/30 border-cyan-400/50 text-cyan-300 shadow-xs"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <SquigglyWaveIcon className="size-3" />
              </button>
            )}

            {/* Audio Track Extras: Software Monitoring & Guitar Tuner Direct Icons */}
            {track.type === "audio" && (
              <>
                {/* SOFTWARE MONITORING (SPEAKER ICON) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { monitoringEnabled: !track.monitoringEnabled });
                  }}
                  title={
                    track.monitoringEnabled
                      ? "Software Monitoring AKTIF (Mendengar audio input bercampur project)"
                      : "Aktifkan Software Monitoring (Speaker Icon)"
                  }
                  className={`size-5.5 rounded border transition cursor-pointer flex items-center justify-center ${
                    track.monitoringEnabled
                      ? "bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-500/30"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Volume2 className="size-3" />
                </button>

                {/* GUITAR TUNER (TUNING FORK ICON: TURNS BLUE WHEN ACTIVE) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { isTunerActive: !track.isTunerActive });
                  }}
                  title={
                    track.isTunerActive
                      ? "Guitar Tuner AKTIF (Slider volume berubah menjadi tuner display). Klik untuk matikan."
                      : "Aktifkan Built-in Guitar Tuner (Icon garpu tala menjadi biru)"
                  }
                  className={`size-5.5 rounded border transition cursor-pointer flex items-center justify-center ${
                    track.isTunerActive
                      ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/40 ring-1 ring-blue-300"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-blue-500/20 hover:text-blue-300"
                  }`}
                >
                  <TuningForkIcon className="size-3" />
                </button>
              </>
            )}

            {/* BUS OUT selector */}
            <div className="ml-auto flex items-center gap-1 rounded bg-black/40 px-1 py-0.5 border border-white/5 text-[9px] font-mono">
              <span className="text-zinc-500">OUT:</span>
              <select
                value={track.outputBus || "master"}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  onUpdateTrack(track.id, { outputBus: e.target.value })
                }
                className="bg-transparent text-zinc-300 outline-none max-w-[50px] truncate cursor-pointer hover:text-white"
                title="Pilih Subgroup Bus atau Master Output"
              >
                <option value="master" className="bg-zinc-900 text-white">Master</option>
                {buses?.map((b) => (
                  <option key={b.id} value={b.id} className="bg-zinc-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Show Effects On Tracks: Inline Insert Effects Row with Power Switches */}
        {showEffectsOnTracks && (
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 pl-1 scrollbar-none">
            {/* Instrument Quick Access Button (New in Mixcraft 10.5) */}
            {track.type === "midi" && (
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("application/x-musiku-instrument-track-id", track.id);
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                className={`inline-flex items-center rounded text-[9px] font-bold border transition shrink-0 ${
                  (track.synthSettings?.volume ?? 1) > 0
                    ? "bg-amber-950/70 border-amber-500/60 text-amber-200 shadow-xs"
                    : "bg-zinc-900/80 border-zinc-700 text-zinc-500 opacity-70"
                }`}
              >
                {/* Power switch on left side of instrument button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (track.synthSettings) {
                      const newVol = (track.synthSettings.volume ?? 1) > 0 ? 0 : 0.8;
                      onUpdateTrack(track.id, {
                        synthSettings: { ...track.synthSettings, volume: newVol },
                      });
                    }
                  }}
                  title={
                    (track.synthSettings?.volume ?? 1) > 0
                      ? "Bypass / Matikan Virtual Instrument (Power Switch)"
                      : "Aktifkan Virtual Instrument (Power Switch)"
                  }
                  className={`p-1 rounded-l transition hover:brightness-125 cursor-pointer ${
                    (track.synthSettings?.volume ?? 1) > 0
                      ? "text-amber-400 bg-amber-900/50"
                      : "text-zinc-500 bg-black/40"
                  }`}
                >
                  <Power className="size-2.5" />
                </button>

                {/* Instrument button opens dialog */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPluginDialog(track.id);
                  }}
                  title={`Instrument Quick Access: ${
                    track.instrumentName || "Virtual Instrument"
                  }. Drag ke tombol keyboard track tujuan untuk memindahkan, Alt+Drag untuk copy.`}
                  className="px-1.5 py-0.5 rounded-r truncate max-w-[85px] hover:text-white transition cursor-pointer flex items-center gap-1"
                >
                  <Piano className="size-2.5 shrink-0" />
                  <span className="truncate">
                    {track.instrumentName || (track.synthSettings ? `Synth (${track.synthSettings.waveform})` : "VSTi")}
                  </span>
                </button>
              </div>
            )}

            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 shrink-0">
              FX:
            </span>
            {track.plugins.map((plugin, idx) => (
              <div
                key={plugin.id || idx}
                className={`inline-flex items-center rounded text-[9px] font-bold border transition shrink-0 ${
                  plugin.enabled
                    ? "bg-purple-900/60 border-purple-500/50 text-purple-200 shadow-xs"
                    : "bg-zinc-900/80 border-zinc-700 text-zinc-500 opacity-70"
                }`}
              >
                {/* Power switch on left side of effect button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = track.plugins.map((p, i) =>
                      i === idx ? { ...p, enabled: !p.enabled } : p
                    );
                    onUpdateTrack(track.id, { plugins: updated });
                  }}
                  title={plugin.enabled ? "Disable Effect (Power Switch)" : "Enable Effect (Power Switch)"}
                  className={`p-1 rounded-l transition hover:brightness-125 cursor-pointer ${
                    plugin.enabled ? "text-emerald-400 bg-purple-950/50" : "text-zinc-500 bg-black/40"
                  }`}
                >
                  <Power className="size-2.5" />
                </button>

                {/* Effect button opens dialog / context menu */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPluginDialog(track.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEffectContextMenu({ x: e.clientX, y: e.clientY, pluginIndex: idx });
                  }}
                  title={`${plugin.name} (${plugin.enabled ? "Aktif" : "Bypass"}). Klik kanan untuk submenu efek.`}
                  className={`px-1.5 py-0.5 rounded-r truncate max-w-[70px] hover:text-white transition cursor-pointer ${
                    !plugin.enabled ? "line-through text-zinc-500" : ""
                  }`}
                >
                  {plugin.name}
                </button>
              </div>
            ))}

            {/* Plus button to add insert effect */}
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddEffectOpen(!isAddEffectOpen);
                }}
                title="Tambah Effect Insert (+)..."
                className="rounded border border-purple-500/30 bg-purple-950/40 p-0.5 text-purple-300 hover:bg-purple-800/60 hover:text-white transition cursor-pointer"
              >
                <Plus className="size-2.5" />
              </button>

              {isAddEffectOpen && (
                <div
                  ref={addEffectRef}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-white/15 bg-zinc-950 p-1 shadow-2xl backdrop-blur-md text-xs"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase tracking-wider border-b border-white/10">
                    Tambah Insert Effect
                  </div>
                  {AVAILABLE_INSERT_EFFECTS.map((fx) => (
                    <button
                      key={fx.pluginId}
                      onClick={() => {
                        const newPlugin = {
                          id: `plug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                          pluginId: fx.pluginId,
                          name: fx.name,
                          enabled: true,
                          parameters: { ...fx.defaultParams },
                        };
                        onUpdateTrack(track.id, { plugins: [...track.plugins, newPlugin] });
                        setIsAddEffectOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-[11px] text-zinc-200 hover:bg-purple-900/30 hover:text-purple-200 transition cursor-pointer"
                    >
                      <span>{fx.name}</span>
                      <Plus className="size-3 text-purple-400" />
                    </button>
                  ))}
                  <div className="border-t border-white/10 my-0.5" />
                  <button
                    onClick={() => {
                      onOpenPluginDialog(track.id);
                      setIsAddEffectOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-[10px] font-medium text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
                  >
                    <span>Semua Efek & VST...</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Row: Pan Slider (left) + Volume Slider with Built-in Level Meter OR Guitar Tuner Display */}
        <div className="flex items-center gap-2 pl-1">
          {/* Pan Slider (Horizontal slider to the left of volume control) */}
          <div
            ref={panFaderRef}
            onMouseDown={handlePanMouseDown}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onUpdateTrack(track.id, { pan: 0 });
            }}
            title={`Pan: ${panText} (-100% s.d. +100%). Tip: Tahan Alt/Shift/Ctrl untuk fine adjustment, double-click untuk Center.`}
            className="group/pan relative h-4 w-12 rounded bg-black/70 border border-white/15 cursor-ew-resize overflow-hidden flex items-center shrink-0"
          >
            {/* Center tick indicator */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/30 pointer-events-none" />
            {/* Pan Fill bar */}
            {track.pan < 0 ? (
              <div
                className="absolute top-0.5 bottom-0.5 bg-violet-500/70 pointer-events-none rounded-xs"
                style={{
                  left: `${((track.pan + 1) / 2) * 100}%`,
                  width: `${(-track.pan / 2) * 100}%`,
                }}
              />
            ) : track.pan > 0 ? (
              <div
                className="absolute top-0.5 bottom-0.5 bg-violet-500/70 pointer-events-none rounded-xs"
                style={{
                  left: "50%",
                  width: `${(track.pan / 2) * 100}%`,
                }}
              />
            ) : null}
            {/* Pan Knob handle */}
            <div
              className="absolute top-0.5 bottom-0.5 w-1.5 -translate-x-1/2 rounded-xs bg-white shadow-sm pointer-events-none"
              style={{ left: `${((track.pan + 1) / 2) * 100}%` }}
            />
            {/* Pan text overlay */}
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black font-mono text-zinc-300 pointer-events-none drop-shadow">
              {panText}
            </span>
          </div>

          {/* GUITAR TUNER DISPLAY (WHEN isTunerActive IS TRUE) */}
          {track.isTunerActive ? (
            (() => {
              const tuner = getTunerState(activeMeter, activeStringIndex);
              return (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStringIndex((prev) => (prev + 1) % GUITAR_TUNER_STRINGS.length);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onUpdateTrack(track.id, { isTunerActive: false });
                  }}
                  title={`Mixcraft Guitar Tuner: Nada ${tuner.note} (${tuner.label}) - ${
                    tuner.hasSignal
                      ? tuner.inTune
                        ? "IN TUNE!"
                        : `${tuner.cents > 0 ? "+" : ""}${tuner.cents} cents`
                      : "Petik senar instrumen untuk mendeteksi nada..."
                  }. Klik untuk ganti senar, klik kanan untuk menutup tuner.`}
                  className="relative h-5 flex-1 rounded bg-black/90 border border-blue-500/60 cursor-pointer overflow-hidden flex items-center px-1.5 shadow-inner select-none"
                >
                  {/* Background scale marks */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-[7px] font-mono text-zinc-600 pointer-events-none select-none">
                    <span>-50c</span>
                    <span>-25</span>
                    <span className="text-white/40 font-bold">0</span>
                    <span>+25</span>
                    <span>+50c</span>
                  </div>

                  {/* Center in-tune line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-blue-400/50 pointer-events-none z-10" />

                  {/* Tuning Cursor (appears in middle & highlights in white when in tune) */}
                  {tuner.hasSignal ? (
                    <div
                      className={`absolute top-0 bottom-0 w-2.5 -translate-x-1/2 rounded-xs border shadow-lg pointer-events-none z-20 flex items-center justify-center transition-all duration-100 ${
                        tuner.inTune
                          ? "bg-white border-white shadow-[0_0_12px_#ffffff]"
                          : tuner.cents < 0
                          ? "bg-amber-400 border-amber-300 shadow-[0_0_8px_#f59e0b]"
                          : "bg-cyan-400 border-cyan-300 shadow-[0_0_8px_#06b6d4]"
                      }`}
                      style={{
                        left: `${Math.max(10, Math.min(90, 50 + (tuner.cents / 50) * 40))}%`,
                      }}
                    >
                      <div className="h-3 w-0.5 bg-black rounded-full" />
                    </div>
                  ) : null}

                  {/* Note & Cents Overlay Badge */}
                  <div className="absolute inset-0 z-30 flex items-center justify-between px-1.5 pointer-events-none text-[8px] font-mono font-bold">
                    <span className="flex items-center gap-1 text-blue-300">
                      <TuningForkIcon className="size-2.5 text-blue-400" />
                      <span className="text-[10px] text-white font-black">{tuner.note}</span>
                      <span className="text-[7px] text-zinc-400">({tuner.label})</span>
                    </span>
                    {tuner.hasSignal ? (
                      <span
                        className={`px-1 rounded text-[8px] font-black ${
                          tuner.inTune
                            ? "bg-emerald-500/40 text-emerald-300 ring-1 ring-emerald-400"
                            : tuner.cents < 0
                            ? "bg-amber-500/30 text-amber-300"
                            : "bg-cyan-500/30 text-cyan-300"
                        }`}
                      >
                        {tuner.inTune ? "✓ IN TUNE" : `${tuner.cents > 0 ? "+" : ""}${tuner.cents}c`}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[8px] italic animate-pulse">Menunggu nada...</span>
                    )}
                  </div>
                </div>
              );
            })()
          ) : track.armRecord && audioDriver === "asio" ? (
            /* ASIO Audio Driver: Volume slider disappears when track is armed for recording per Mixcraft 10 */
            <div
              title="Driver ASIO: Fader volume disembunyikan saat track di-arm karena driver ASIO tidak mendukung software input gain adjustment. Atur level rekaman menggunakan hardware preamp / audio interface Anda."
              className="relative h-5 flex-1 rounded bg-black/90 border border-amber-500/40 overflow-hidden flex items-center justify-between px-2 select-none"
            >
              {/* Integrated Live Input Level Meter Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded transition-all duration-75 pointer-events-none opacity-70"
                style={{
                  width: `${Math.min(100, activeMeter * 100)}%`,
                  background: "linear-gradient(to right, #10b981 70%, #eab308 90%, #ef4444 100%)",
                }}
              />
              <span className="relative z-10 text-[8px] font-mono font-bold text-amber-300 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                ASIO HW PREAMP
              </span>
              <span className="relative z-10 text-[7px] text-zinc-400 font-mono">
                Hardware Gain Knob
              </span>
            </div>
          ) : (
            /* Volume Horizontal Fader with Built-in Level Meter (0% to 200%) */
            /* In WaveRT / Wave mode: Fader turns RED recording level adjuster when armed per Mixcraft 10 */
            <div
              ref={volFaderRef}
              onMouseDown={handleVolMouseDown}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onUpdateTrack(track.id, { volume: 1.0 }); // Reset to 100% (0 dB)
              }}
              title={
                track.armRecord
                  ? `Record Input Level: ${volPct}% (${volDb}). Sinyal nominal ideal di zona kuning. Jika mencapai zona merah, turunkan input level! [WaveRT/Wave Driver]`
                  : `Volume: ${volPct}% (${volDb}) [0% - 200% / -Inf s.d. +6dB]. ${
                      "[MODE OUTPUT METER]"
                    }. Tip: Tahan Alt/Shift/Ctrl untuk fine adjustment, double-click untuk 100% (0dB).`
              }
              className={`group/vol relative h-5 flex-1 rounded border cursor-ew-resize overflow-hidden flex items-center ${
                track.armRecord
                  ? "bg-red-950/30 border-red-500/60"
                  : "bg-black/80 border-white/15"
              }`}
            >
              {/* Integrated Live Level Meter Bar: 3 Zones (Green safe, Yellow nominal ideal, Red peak warning) */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded transition-all duration-75 pointer-events-none opacity-80"
                style={{
                  width: `${Math.min(100, activeMeter * 100)}%`,
                  background: track.armRecord
                    ? "linear-gradient(to right, #10b981 70%, #eab308 90%, #ef4444 100%)"
                    : "linear-gradient(to right, #10b981 60%, #eab308 85%, #ef4444 100%)",
                }}
              />

              {/* 100% (0 dB) Center Reference Line */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/40 pointer-events-none z-10"
                title="100% (0 dB Unity Gain)"
              />

              {/* Fader Handle / Position Indicator */}
              <div
                className={`absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-xs border pointer-events-none z-20 flex items-center justify-center ${
                  track.armRecord
                    ? "bg-red-400 border-red-200 shadow-md shadow-red-500/40"
                    : "bg-white/95 border-black/40 shadow-md"
                }`}
                style={{ left: `${Math.min(100, (track.volume / 2.0) * 100)}%` }}
              >
                <div
                  className={`h-3 w-0.5 rounded-full ${track.armRecord ? "bg-white" : "bg-zinc-600"}`}
                />
              </div>

              {/* Value Label Overlay */}
              <div className="absolute inset-0 z-30 flex items-center justify-between px-1.5 pointer-events-none text-[8px] font-mono font-bold drop-shadow">
                <span className={`flex items-center gap-0.5 ${track.armRecord ? "text-red-200" : "text-zinc-300"}`}>
                  <Volume2 className="size-2.5 opacity-60" />
                  <span>{track.armRecord ? `REC: ${volPct}%` : `${volPct}%`}</span>
                </span>
                <span
                  className={
                    track.volume > 1.0
                      ? "text-amber-300"
                      : track.armRecord
                      ? "text-red-200"
                      : "text-zinc-400"
                  }
                >
                  {volDb}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Edge: Hover double-horizontal arrows to toggle Show Effects On Tracks */}
        {onToggleEffectsOnTracks && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleEffectsOnTracks();
            }}
            title="Tarik / Klik tepi kanan untuk menampilkan/menyembunyikan Track Insert Effects Slots"
            className="absolute top-0 bottom-0 right-0 w-1.5 hover:w-2.5 cursor-col-resize hover:bg-purple-500/60 transition-all z-20"
          />
        )}

        {/* Resizable Height Handle Bar at Bottom Edge (Shift+Drag to resize all) */}
        <div
          onMouseDown={handleResizeStart}
          title="Tarik ke bawah atau ke atas untuk mengubah tinggi track. Tip: Tahan [SHIFT] untuk mengubah ukuran SEMUA track sekaligus."
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-violet-500/60 transition z-20"
        />
      </div>

      {/* --- RIGHT-CLICK CONTEXT MENU (Mixcraft 10 Audio Track Commands) --- */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-64 rounded-xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none"
          style={{
            top: `${Math.min(contextMenu.y, typeof window !== "undefined" ? window.innerHeight - 480 : contextMenu.y)}px`,
            left: `${Math.min(contextMenu.x, typeof window !== "undefined" ? window.innerWidth - 270 : contextMenu.x)}px`,
          }}
        >
          <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase tracking-wider border-b border-white/10 flex items-center justify-between">
            <span>Opsi Track #{trackIndex + 1}: {track.name}</span>
            <span style={{ color: track.color }}>●</span>
          </div>

          {/* 1. Insert Track (Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("insert")}
          >
            <button
              onClick={() => setActiveSubmenu((prev) => (prev === "insert" ? null : "insert"))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus className="size-3.5 text-violet-400" />
                <span>Insert Track</span>
              </span>
              <ChevronRight className="size-3 text-zinc-400" />
            </button>
            {activeSubmenu === "insert" && (
              <div
                className={`absolute top-0 ${
                  contextMenu.x > (typeof window !== "undefined" ? window.innerWidth - 320 : 700)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } z-50 w-52 rounded-xl border border-white/10 bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none`}
              >
                <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase border-b border-white/10 mb-1">
                  Sisipkan di Atas Track #{trackIndex + 1}
                </div>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "audio");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-pink-600/30 hover:text-white transition"
                >
                  <Mic2 className="size-3.5 text-pink-400" />
                  <span>Audio Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "midi");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-violet-600/30 hover:text-white transition"
                >
                  <Music className="size-3.5 text-violet-400" />
                  <span>Instrument Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "video");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-cyan-600/30 hover:text-white transition"
                >
                  <Video className="size-3.5 text-cyan-400" />
                  <span>Video Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "video-text");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-amber-600/30 hover:text-white transition"
                >
                  <Type className="size-3.5 text-amber-400" />
                  <span>Video Text Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "submix");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-emerald-600/30 hover:text-white transition"
                >
                  <FolderTree className="size-3.5 text-emerald-400" />
                  <span>SubMix Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "send");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-indigo-600/30 hover:text-white transition"
                >
                  <Sparkles className="size-3.5 text-indigo-400" />
                  <span>Send Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "output");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-purple-600/30 hover:text-white transition"
                >
                  <Disc className="size-3.5 text-purple-400" />
                  <span>Output Track</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onInsertTrackAbove?.(track.id, "vocoder");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-rose-600/30 hover:text-white transition"
                >
                  <Activity className="size-3.5 text-rose-400" />
                  <span>Vocoder Track</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Delete Track */}
          <button
            onMouseEnter={() => setActiveSubmenu(null)}
            onClick={() => {
              setContextMenu(null);
              setActiveSubmenu(null);
              onDeleteTrack(track.id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-red-400 hover:bg-red-500/20 transition cursor-pointer"
          >
            <Trash2 className="size-3.5 text-red-400" />
            <span>Delete Track</span>
          </button>

          {/* 3. Color (Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("color")}
          >
            <button
              onClick={() => setActiveSubmenu((prev) => (prev === "color" ? null : "color"))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Palette className="size-3.5 text-pink-400" />
                <span>Color</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-white/30" style={{ backgroundColor: track.color }} />
                <ChevronRight className="size-3 text-zinc-400" />
              </span>
            </button>
            {activeSubmenu === "color" && (
              <div
                className={`absolute top-0 ${
                  contextMenu.x > (typeof window !== "undefined" ? window.innerWidth - 320 : 700)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } z-50 w-52 rounded-xl border border-white/10 bg-zinc-950/98 p-2 shadow-2xl backdrop-blur-md text-xs select-none`}
              >
                <div className="px-1 pb-1 font-bold text-zinc-400 text-[10px] uppercase border-b border-white/10 mb-2">
                  Pilih Warna Track
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {TRACK_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setContextMenu(null);
                        setActiveSubmenu(null);
                        onUpdateTrack(track.id, { color: c });
                      }}
                      style={{ backgroundColor: c }}
                      className={`size-6 rounded-md border transition hover:scale-110 flex items-center justify-center ${
                        track.color.toLowerCase() === c.toLowerCase() ? "border-white shadow-md scale-105" : "border-transparent"
                      }`}
                    >
                      {track.color.toLowerCase() === c.toLowerCase() && <Check className="size-3 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    setIsAppearanceOpen(true);
                  }}
                  className="w-full text-center py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px]"
                >
                  Pilih Ikon, Gambar & Warna Kustom...
                </button>
              </div>
            )}
          </div>

          {/* 4. Link (Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("link")}
          >
            <button
              onClick={() => setActiveSubmenu((prev) => (prev === "link" ? null : "link"))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <LinkIcon className="size-3.5 text-emerald-400" />
                <span>Link</span>
              </span>
              <span className="flex items-center gap-1">
                {track.linkGroupId && <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">Linked</span>}
                <ChevronRight className="size-3 text-zinc-400" />
              </span>
            </button>
            {activeSubmenu === "link" && (
              <div
                className={`absolute top-0 ${
                  contextMenu.x > (typeof window !== "undefined" ? window.innerWidth - 320 : 700)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } z-50 w-56 rounded-xl border border-white/10 bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none`}
              >
                <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase border-b border-white/10 mb-1">
                  Track Linking (Gangs Controls)
                </div>
                <button
                  disabled={selectedTrackCount <= 1}
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onLinkSelectedTracks?.();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    selectedTrackCount > 1
                      ? "text-emerald-300 hover:bg-emerald-600/20 cursor-pointer"
                      : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <LinkIcon className="size-3.5" />
                  <span>Link Selected Tracks ({selectedTrackCount})</span>
                </button>
                <button
                  disabled={!track.linkGroupId}
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onUnlinkTrack?.(track.id);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    track.linkGroupId
                      ? "text-zinc-200 hover:bg-white/10 cursor-pointer"
                      : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Unlink className="size-3.5" />
                  <span>Unlink</span>
                </button>
                <button
                  disabled={!track.linkGroupId}
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    if (track.linkGroupId) onUnlinkAllInGroup?.(track.linkGroupId);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    track.linkGroupId
                      ? "text-amber-300 hover:bg-amber-600/20 cursor-pointer"
                      : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Unlink className="size-3.5" />
                  <span>Unlink All</span>
                </button>
                {track.linkGroupId && onSelectAllLinkedTracks && (
                  <button
                    onClick={() => {
                      setContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectAllLinkedTracks(track.linkGroupId!);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-cyan-300 hover:bg-cyan-600/20 cursor-pointer transition border-t border-white/5 mt-1 pt-1"
                  >
                    <Check className="size-3.5" />
                    <span>Select All Linked Tracks</span>
                  </button>
                )}
                <div className="px-2 pt-1 text-[9px] text-zinc-500 italic border-t border-white/5 mt-1">
                  "Unlike Fleetwood Mac, you can always break the chain..."
                </div>
              </div>
            )}
          </div>

          {/* 5. Lanes (Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("lanes")}
          >
            <button
              onClick={() => setActiveSubmenu((prev) => (prev === "lanes" ? null : "lanes"))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers className="size-3.5 text-cyan-400" />
                <span>Lanes</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono">{track.laneCount || 1} Lanes</span>
                <ChevronRight className="size-3 text-zinc-400" />
              </span>
            </button>
            {activeSubmenu === "lanes" && (
              <div
                className={`absolute top-0 ${
                  contextMenu.x > (typeof window !== "undefined" ? window.innerWidth - 320 : 700)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } z-50 w-56 rounded-xl border border-white/10 bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none`}
              >
                <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase border-b border-white/10 mb-1">
                  Operasi Sub-Lintasan Lanes
                </div>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onAddLane?.(track.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="size-3.5 text-cyan-400" />
                    <span>Add</span>
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500">Alt+L</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onDeleteBottomLane?.(track.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="size-3.5 text-zinc-400" />
                    <span>Delete</span>
                  </span>
                  <span className="text-[9px] text-zinc-500">Bottom</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onDeleteEmptyLanes?.(track.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="size-3.5 text-amber-400" />
                    <span>Delete Empty Lanes</span>
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500">Alt+K</span>
                </button>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onMuteAllLanes?.(track.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <VolumeX className="size-3.5 text-zinc-400" />
                  <span>Mute All</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onUnmuteAllLanes?.(track.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Volume2 className="size-3.5 text-zinc-400" />
                  <span>Unmute All</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onSelectAllClips?.(track.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Check className="size-3.5 text-cyan-400" />
                  <span>Select (All Clips on Lanes)</span>
                </button>
                <div className="px-2 pt-1 text-[9px] text-zinc-500 italic border-t border-white/5 mt-1">
                  Denny Laine (Moody Blues & Wings)
                </div>
              </div>
            )}
          </div>

          {/* 6. FX... (Effects List) */}
          <button
            onMouseEnter={() => setActiveSubmenu(null)}
            onClick={() => {
              setContextMenu(null);
              setActiveSubmenu(null);
              onOpenPluginDialog(track.id);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-purple-600/20 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-purple-400" />
              <span>FX... (Effects List)</span>
            </span>
            <span className="font-mono text-[9px] text-zinc-400">{track.plugins.length} active</span>
          </button>

          {/* 7. Show Effects On Tracks */}
          {onToggleEffectsOnTracks && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onToggleEffectsOnTracks();
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-zinc-400" />
                <span>Show Effects On Tracks</span>
              </span>
              {showEffectsOnTracks && <Check className="size-3 text-purple-400" />}
            </button>
          )}

          {/* 8. Show Automation Lane */}
          {onToggleAutomationLane && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onToggleAutomationLane(track.id);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SquigglyWaveIcon className="size-3.5 text-amber-400" />
                <span>Show Automation Lane</span>
              </span>
              {isAutomationLaneOpen && <Check className="size-3 text-amber-400" />}
            </button>
          )}

          {/* 9. Properties (Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu("properties")}
          >
            <button
              onClick={() => setActiveSubmenu((prev) => (prev === "properties" ? null : "properties"))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sliders className="size-3.5 text-blue-400" />
                <span>Properties</span>
              </span>
              <ChevronRight className="size-3 text-zinc-400" />
            </button>
            {activeSubmenu === "properties" && (
              <div
                className={`absolute top-0 ${
                  contextMenu.x > (typeof window !== "undefined" ? window.innerWidth - 320 : 700)
                    ? "right-full mr-1"
                    : "left-full ml-1"
                } z-50 w-60 rounded-xl border border-white/10 bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none`}
              >
                <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase border-b border-white/10 mb-1">
                  Track Properties: {track.name}
                </div>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onUpdateTrack(track.id, { mute: !track.mute });
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${track.mute ? "bg-blue-500" : "bg-zinc-600"}`} />
                    <span>Mute</span>
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400">Ctrl+M</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    onUpdateTrack(track.id, { solo: !track.solo });
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${track.solo ? "bg-blue-500" : "bg-zinc-600"}`} />
                    <span>Solo</span>
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400">Ctrl+L</span>
                </button>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    setExactInputVal(`${volPct}%`);
                    setExactValueModal("volume");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition"
                >
                  <span>Set Exact Volume...</span>
                  <span className="font-mono text-[10px] text-zinc-400">{volPct}%</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    setExactInputVal(panText);
                    setExactValueModal("pan");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition"
                >
                  <span>Set Exact Pan...</span>
                  <span className="font-mono text-[10px] text-zinc-400">{panText}</span>
                </button>
                <div className="border-t border-white/10 my-1" />
                <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase">Height Presets</div>
                <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                  {TRACK_HEIGHT_PRESETS.map((p) => (
                    <button
                      key={p.height}
                      onClick={() => {
                        setContextMenu(null);
                        setActiveSubmenu(null);
                        onUpdateTrack(track.id, { height: p.height });
                      }}
                      className={`rounded px-1.5 py-1 text-[10px] text-left transition truncate ${
                        trackHeight === p.height
                          ? "bg-violet-600 text-white font-bold"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {onCycleTrackHeight && (
                  <button
                    onClick={() => {
                      setContextMenu(null);
                      setActiveSubmenu(null);
                      onCycleTrackHeight();
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-zinc-300 hover:bg-white/10 text-[10px] transition"
                  >
                    <span>Cycle Track Size</span>
                    <span className="font-mono text-[9px] text-zinc-500">Ctrl+~</span>
                  </button>
                )}
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setActiveSubmenu(null);
                    setIsAppearanceOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition"
                >
                  <ImageIcon className="size-3.5 text-violet-400" />
                  <span>Choose Image...</span>
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 my-1" />

          {/* 10. Mix To New Audio Track */}
          {onMixToNewAudioTrack && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onMixToNewAudioTrack(track.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-violet-600/30 hover:text-white transition cursor-pointer"
            >
              <Disc className="size-3.5 text-violet-400" />
              <span>Mix to New Audio Track</span>
            </button>
          )}

          {/* 11. Duplicate */}
          {onDuplicateTrack && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onDuplicateTrack(track.id);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Copy className="size-3.5 text-zinc-400" />
                <span>Duplicate</span>
              </span>
              <span className="font-mono text-[9px] text-zinc-500">Ctrl+D</span>
            </button>
          )}

          {/* 12. Freeze / Unfreeze */}
          {onToggleFreezeTrack && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onToggleFreezeTrack(track.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-sky-600/30 hover:text-sky-200 transition cursor-pointer"
            >
              {track.isFrozen ? (
                <>
                  <Sun className="size-3.5 text-amber-400" />
                  <span>Unfreeze Track</span>
                </>
              ) : (
                <>
                  <Snowflake className="size-3.5 text-sky-400" />
                  <span>Freeze Track</span>
                </>
              )}
            </button>
          )}

          {/* 13. Select All Clips */}
          {onSelectAllClips && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onSelectAllClips(track.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Check className="size-3.5 text-cyan-400" />
              <span>Select All Clips</span>
            </button>
          )}

          {/* 14. Select All Linked Tracks */}
          {track.linkGroupId && onSelectAllLinkedTracks && (
            <button
              onMouseEnter={() => setActiveSubmenu(null)}
              onClick={() => {
                setContextMenu(null);
                setActiveSubmenu(null);
                onSelectAllLinkedTracks(track.linkGroupId!);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-emerald-300 hover:bg-emerald-600/20 transition cursor-pointer"
            >
              <LinkIcon className="size-3.5" />
              <span>Select All Linked Tracks</span>
            </button>
          )}

          {/* Reorder / Move Track */}
          {onMoveTrack && (
            <div className="flex gap-1 py-1 border-t border-white/5 my-1">
              <button
                onClick={() => {
                  setContextMenu(null);
                  setActiveSubmenu(null);
                  onMoveTrack(track.id, "up");
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-white/5 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
              >
                <ChevronUp className="size-3" /> Ke Atas
              </button>
              <button
                onClick={() => {
                  setContextMenu(null);
                  setActiveSubmenu(null);
                  onMoveTrack(track.id, "down");
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-white/5 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
              >
                <ChevronDown className="size-3" /> Ke Bawah
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- EXACT VALUE DIALOG (FOR VOLUME OR PAN) --- */}
      {exactValueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs select-none">
          <div className="flex w-full max-w-xs flex-col rounded-2xl border border-white/15 bg-zinc-950 p-4 shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-1">
              {exactValueModal === "volume" ? "Set Exact Track Volume" : "Set Exact Track Pan"}
            </h4>
            <p className="text-[11px] text-zinc-400 mb-3">
              {exactValueModal === "volume"
                ? "Masukkan nilai persentase (0% s.d. 200%) atau desibel (-Inf dB s.d. +6 dB):"
                : "Masukkan nilai persentase (-100% s.d. 100%), C untuk Center, atau L50/R50:"}
            </p>
            <input
              type="text"
              autoFocus
              value={exactInputVal}
              onChange={(e) => setExactInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExactSubmit();
                if (e.key === "Escape") setExactValueModal(null);
              }}
              className="rounded-xl border border-white/20 bg-black/80 px-3 py-2 text-sm font-mono font-bold text-white outline-none focus:ring-2 focus:ring-violet-500 mb-4"
              placeholder={exactValueModal === "volume" ? "e.g. 100% or 0 dB" : "e.g. C, L50, R100"}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setExactValueModal(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={handleExactSubmit}
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PURPLE EFFECT BUTTON SUBMENU --- */}
      {effectContextMenu && (
        <div
          ref={effectMenuRef}
          className="fixed z-50 w-52 rounded-xl border border-purple-500/30 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${effectContextMenu.y}px`, left: `${effectContextMenu.x}px` }}
        >
          <div className="px-2 py-1 font-bold text-purple-400 text-[10px] uppercase tracking-wider border-b border-white/10">
            Purple Effect Submenu
          </div>
          {/* Active */}
          <button
            onClick={() => {
              const updated = track.plugins.map((p, i) =>
                i === effectContextMenu.pluginIndex ? { ...p, enabled: !p.enabled } : p
              );
              onUpdateTrack(track.id, { plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Active</span>
            {track.plugins[effectContextMenu.pluginIndex]?.enabled && (
              <Check className="size-3 text-emerald-400" />
            )}
          </button>
          {/* Remove */}
          <button
            onClick={() => {
              const updated = track.plugins.filter(
                (_, i) => i !== effectContextMenu.pluginIndex
              );
              onUpdateTrack(track.id, { plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-red-300 hover:bg-red-500/20 transition"
          >
            <span>Remove</span>
            <Trash2 className="size-3" />
          </button>
          {/* Effect List Is Active */}
          <button
            onClick={() => {
              const allActive = track.plugins.every((p) => p.enabled);
              const updated = track.plugins.map((p) => ({ ...p, enabled: !allActive }));
              onUpdateTrack(track.id, { plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Effect List Is Active</span>
            {track.plugins.every((p) => p.enabled) && (
              <Check className="size-3 text-emerald-400" />
            )}
          </button>
          <div className="my-1 border-t border-white/10" />
          {/* Edit Effects List... */}
          <button
            onClick={() => {
              onOpenPluginDialog(track.id);
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Edit Effects List...</span>
          </button>
          {/* Close All Effect Windows */}
          <button
            onClick={() => {
              onCloseAllEffectWindows?.();
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Close All Effect Windows</span>
          </button>
          {/* Remove All Effects */}
          <button
            onClick={() => {
              onUpdateTrack(track.id, { plugins: [] });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-red-400 hover:bg-red-500/20 transition"
          >
            <span>Remove All Effects</span>
          </button>
        </div>
      )}

      {/* --- CHOOSE TRACK IMAGE, ICON & COLOR DIALOG --- */}
      {isAppearanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white">Choose Track Appearance: {track.name}</h3>
              </div>
              <button
                onClick={() => setIsAppearanceOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Choose Icon / Custom Image File */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-300">Pilih Ikon atau Gambar Track:</span>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 cursor-pointer bg-violet-600/15 border border-violet-500/30 px-2 py-0.5 rounded-lg transition">
                    <ImageIcon className="size-3" />
                    <span>Add My Own Image File...</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.bmp,.jpg,.jpeg,.png,.gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            const dataUrl = re.target?.result as string;
                            if (dataUrl) {
                              onUpdateTrack(track.id, { customImageUrl: dataUrl, icon: "custom" });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Mixcraft Preset Images Library */}
                <div className="mb-3">
                  <span className="text-[10px] font-bold text-zinc-400 block mb-1">
                    Mixcraft Included Image Library:
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {TRACK_IMAGE_PRESETS.map((preset) => {
                      const PresetIcon = preset.icon;
                      const isActive =
                        !track.customImageUrl && (track.icon === preset.id || track.icon === preset.id.replace("_", ""));
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            onUpdateTrack(track.id, {
                              icon: preset.id,
                              customImageUrl: undefined,
                              color: preset.color,
                            });
                          }}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border transition cursor-pointer ${
                            isActive
                              ? "bg-violet-600/30 border-violet-400 text-white shadow-xs"
                              : "bg-white/5 border-white/10 hover:border-violet-400 hover:bg-white/10 text-zinc-300"
                          }`}
                        >
                          <div
                            className="size-6 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: `${preset.color}30`, color: preset.color }}
                          >
                            <PresetIcon className="size-3.5" />
                          </div>
                          <span className="text-[8px] font-mono truncate max-w-full">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {track.customImageUrl && (
                  <div className="flex items-center justify-between p-2 mb-2 rounded-xl bg-violet-950/30 border border-violet-500/30">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={track.customImageUrl}
                        alt="Current custom"
                        className="size-8 object-cover rounded-lg border border-white/20"
                      />
                      <span className="text-xs text-violet-200 font-medium">Gambar Kustom Terpasang</span>
                    </div>
                    <button
                      onClick={() => onUpdateTrack(track.id, { customImageUrl: undefined, icon: "mic" })}
                      className="text-[10px] text-zinc-400 hover:text-red-400 transition"
                    >
                      Hapus
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-2">
                  {TRACK_ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    const isActive =
                      !track.customImageUrl && (track.icon || track.type) === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() =>
                          onUpdateTrack(track.id, { icon: opt.id, customImageUrl: undefined })
                        }
                        title={opt.label}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition border cursor-pointer ${
                          isActive
                            ? "border-violet-500 bg-violet-600/30 text-white shadow-md shadow-violet-500/20"
                            : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <IconComp className="size-5" />
                        <span className="text-[9px] font-mono truncate max-w-full">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Choose Color */}
              <div>
                <span className="block text-xs font-bold text-zinc-300 mb-2">Pilih Warna Track:</span>
                <div className="grid grid-cols-7 gap-2">
                  {TRACK_COLOR_PALETTE.map((col) => (
                    <button
                      key={col}
                      onClick={() => onUpdateTrack(track.id, { color: col })}
                      className={`size-8 rounded-full transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                        track.color === col ? "ring-2 ring-white scale-110" : ""
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {track.color === col && <Check className="size-4 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Height */}
              <div>
                <span className="block text-xs font-bold text-zinc-300 mb-2">Tinggi Vertikal Track:</span>
                <div className="grid grid-cols-2 gap-2">
                  {TRACK_HEIGHT_PRESETS.map((p) => (
                    <button
                      key={p.height}
                      onClick={() => onUpdateTrack(track.id, { height: p.height })}
                      className={`rounded-xl py-2 px-3 text-xs font-semibold transition border text-left truncate cursor-pointer ${
                        trackHeight === p.height
                          ? "border-violet-500 bg-violet-600/30 text-white"
                          : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {p.label} ({p.height}px)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 p-4 flex justify-end">
              <button
                onClick={() => setIsAppearanceOpen(false)}
                className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-500 transition cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
