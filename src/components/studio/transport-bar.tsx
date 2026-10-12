"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  Square,
  Circle,
  Repeat,
  Volume2,
  FolderOpen,
  Download,
  Plus,
  Undo2,
  Redo2,
  Sliders,
  Mic,
  Mic2,
  Music,
  Grid3X3,
  Timer,
  ChevronDown,
  ChevronUp,
  Settings,
  Check,
  Video,
  Sparkles,
  FolderTree,
  Disc,
  Activity,
  Layers,
  Radio,
} from "lucide-react";
import type { AudioDeviceOption, TransportState, TrackType, AudioDriverType } from "@/lib/studio/types";

interface TransportBarProps {
  projectName: string;
  transport: TransportState;
  masterVolume: number;
  masterLevel: number;
  inputLevel: number;
  inputDevices: AudioDeviceOption[];
  selectedDeviceId?: string;
  canUndo: boolean;
  canRedo: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onTempoChange: (tempo: number) => void;
  onMasterVolumeChange: (vol: number) => void;
  onSelectInputDevice: (deviceId: string) => void;
  onOpenProjectDialog: () => void;
  onOpenExportDialog: () => void;
  onNewProject: () => void;
  onAddTrack: (type: TrackType, insertAbove?: boolean) => void;
  showEffectsOnTracks?: boolean;
  onToggleShowEffectsOnTracks?: () => void;
  showMasterTrack?: boolean;
  onToggleShowMasterTrack?: () => void;
  showPerformancePanel?: boolean;
  onToggleShowPerformancePanel?: () => void;
  onToggleMixer: () => void;
  isMixerOpen: boolean;
  onToggleStepSequencer?: () => void;
  isStepSequencerOpen?: boolean;
  onToggleLyrics?: () => void;
  isLyricsOpen?: boolean;
  hasLyrics?: boolean;
  isMidiLearnActive?: boolean;
  onToggleMidiLearn?: () => void;
  onOpenMidiLearnDialog?: () => void;
  onToggleCountIn?: () => void;
  hasCountIn?: boolean;
  countInMeasures?: number;
  metronomeRecording?: boolean;
  metronomePlayback?: boolean;
  onUpdateMetronomeSettings?: (settings: { recording?: boolean; playback?: boolean; countIn?: boolean; countInMeasures?: number }) => void;
  audioDriver?: AudioDriverType;
  onSelectAudioDriver?: (driver: AudioDriverType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function TransportBar({
  projectName,
  transport,
  masterVolume,
  masterLevel,
  inputLevel,
  inputDevices,
  selectedDeviceId,
  canUndo,
  canRedo,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onToggleLoop,
  onToggleMetronome,
  metronomeRecording = true,
  metronomePlayback = false,
  countInMeasures = 1,
  onUpdateMetronomeSettings,
  audioDriver = "wavert",
  onSelectAudioDriver,
  onTempoChange,
  onMasterVolumeChange,
  onSelectInputDevice,
  onOpenProjectDialog,
  onOpenExportDialog,
  onNewProject,
  onAddTrack,
  showEffectsOnTracks,
  onToggleShowEffectsOnTracks,
  showMasterTrack,
  onToggleShowMasterTrack,
  showPerformancePanel,
  onToggleShowPerformancePanel,
  onToggleMixer,
  isMixerOpen,
  onToggleStepSequencer,
  isStepSequencerOpen,
  onToggleLyrics,
  isLyricsOpen,
  hasLyrics,
  isMidiLearnActive,
  onToggleMidiLearn,
  onOpenMidiLearnDialog,
  onToggleCountIn,
  hasCountIn,
  onUndo,
  onRedo,
}: TransportBarProps) {
  const [isTrackMenuOpen, setIsTrackMenuOpen] = useState(false);
  const [isMetronomeSettingsOpen, setIsMetronomeSettingsOpen] = useState(false);
  const [isDriverMenuOpen, setIsDriverMenuOpen] = useState(false);

  // Format bar : beat : tick
  const totalBeats = Math.max(0, transport.currentBeat);
  const beatsPerBar = transport.timeSignature[0] || 4;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beatInBar = Math.floor(totalBeats % beatsPerBar) + 1;
  const tickInBeat = Math.floor((totalBeats % 1) * 960);

  // Format mm:ss
  const minutes = Math.floor(transport.currentTimeSeconds / 60);
  const seconds = Math.floor(transport.currentTimeSeconds % 60);
  const millis = Math.floor((transport.currentTimeSeconds % 1) * 100);

  const isInputClipping = inputLevel > 0.92;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-charcoal/95 px-4 py-2.5 backdrop-blur z-30 select-none font-sans">
      {/* Kiri: Nama Proyek & Menu Berkas */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-sm">
            <Music className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-white truncate max-w-[140px] md:max-w-[200px]">
              {projectName}
            </span>
            <span className="text-[10px] text-violet-400 font-mono">MusikKu Studio DAW</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenProjectDialog}
            title="Buka / Simpan Proyek"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <FolderOpen className="size-3.5" />
            <span className="hidden sm:inline">Proyek</span>
          </button>

          {/* Top Menu: Track > Add Track / Insert Track */}
          <div className="relative">
            <button
              onClick={() => setIsTrackMenuOpen(!isTrackMenuOpen)}
              title="Menu Track: Tambah, Sisipkan Track, dan Pengaturan Tampilan"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
            >
              <Sliders className="size-3.5 text-violet-400" />
              <span>Track</span>
              <ChevronDown className="size-3" />
            </button>

            {isTrackMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsTrackMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-white/10 mb-1">
                    Track &gt; Add Track (Bottom)
                  </div>
                  <button
                    onClick={() => {
                      onAddTrack("audio", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Mic2 className="size-3.5 text-pink-400" />
                    <span>Audio Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("midi", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Music className="size-3.5 text-violet-400" />
                    <span>Instrument (MIDI)</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("video", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Video className="size-3.5 text-amber-400" />
                    <span>Video Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("send", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Sparkles className="size-3.5 text-indigo-400" />
                    <span>Send Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("submix", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <FolderTree className="size-3.5 text-emerald-400" />
                    <span>SubMix Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("output", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Disc className="size-3.5 text-blue-400" />
                    <span>Output Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("vocoder", false);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Activity className="size-3.5 text-fuchsia-400" />
                    <span>Vocoder Track</span>
                  </button>

                  <div className="my-1.5 border-t border-white/10" />

                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                    Track &gt; Insert Track (Above Selected)
                  </div>
                  <button
                    onClick={() => {
                      onAddTrack("audio", true);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Plus className="size-3.5 text-pink-400" />
                    <span>Insert Audio Track</span>
                  </button>
                  <button
                    onClick={() => {
                      onAddTrack("midi", true);
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <Plus className="size-3.5 text-violet-400" />
                    <span>Insert Instrument Track</span>
                  </button>

                  <div className="my-1.5 border-t border-white/10" />

                  {/* Display Toggles */}
                  <button
                    onClick={() => {
                      onToggleShowEffectsOnTracks?.();
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <span>Show Effects On Tracks</span>
                    {showEffectsOnTracks && <Check className="size-3 text-purple-400" />}
                  </button>
                  <button
                    onClick={() => {
                      onToggleShowPerformancePanel?.();
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="size-3 text-violet-400" />
                      <span>Performance Panel</span>
                    </span>
                    {showPerformancePanel && <Check className="size-3 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => {
                      onToggleShowMasterTrack?.();
                      setIsTrackMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-zinc-200 hover:bg-white/10 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <Disc className="size-3 text-amber-400" />
                      <span>Show Master Track</span>
                    </span>
                    {showMasterTrack && <Check className="size-3 text-amber-400" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onOpenExportDialog}
            title="Ekspor Audio WAV"
            className="flex items-center gap-1 rounded-lg border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 hover:text-pink-100 transition"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Ekspor WAV</span>
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition disabled:opacity-30"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition disabled:opacity-30"
          >
            <Redo2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Tengah: Transport Main Controls */}
      <div className="flex items-center gap-2">
        {/* Record Button */}
        <button
          onClick={onRecord}
          title="Rekam ke Track yang di-arm (R)"
          className={`flex size-9 items-center justify-center rounded-xl transition ${
            transport.recording
              ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse"
              : "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
          }`}
        >
          <Circle className="size-4 fill-current" />
        </button>

        {/* Play / Pause Button */}
        {transport.playing ? (
          <button
            onClick={onPause}
            title="Jeda (Spasi)"
            className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition"
          >
            <Pause className="size-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            title="Putar (Spasi)"
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30 hover:brightness-110 transition"
          >
            <Play className="size-4 fill-current ml-0.5" />
          </button>
        )}

        {/* Stop Button */}
        <button
          onClick={onStop}
          title="Berhenti (Return to Zero)"
          className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
        >
          <Square className="size-3.5 fill-current" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onToggleLoop}
          title="Loop Playback Range"
          className={`flex size-9 items-center justify-center rounded-xl transition ${
            transport.loop.enabled
              ? "border border-violet-500/50 bg-violet-600/20 text-violet-300 font-bold"
              : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Repeat className="size-4" />
        </button>

        {/* Metronome Toggle & Mixcraft 10 Settings Dialog */}
        <div className="relative flex items-center">
          <div className="flex items-center rounded-xl overflow-hidden border border-white/10 bg-white/5">
            <button
              onClick={onToggleMetronome}
              title="Metronom Click (Aktifkan / Nonaktifkan)"
              className={`px-2 py-1.5 text-xs font-mono font-bold transition ${
                transport.metronome
                  ? "bg-fuchsia-500/25 text-fuchsia-300 border-r border-fuchsia-500/30"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white border-r border-white/10"
              }`}
            >
              METRO
            </button>
            <button
              onClick={() => setIsMetronomeSettingsOpen((prev) => !prev)}
              title="Metronome Settings (Mixcraft 10)"
              className="px-1.5 py-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <ChevronDown className="size-3" />
            </button>
          </div>

          {/* Metronome Settings Dialog */}
          {isMetronomeSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMetronomeSettingsOpen(false)}
              />
              <div className="absolute top-12 left-0 z-50 w-72 rounded-2xl border border-white/15 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-xl text-xs select-none">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Activity className="size-3.5 text-fuchsia-400" />
                    Metronome Settings
                  </span>
                  <span className="text-[10px] text-fuchsia-400/80 font-mono">Mixcraft 10</span>
                </div>

                <div className="space-y-2.5">
                  {/* Recording Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200 hover:text-white">
                    <input
                      type="checkbox"
                      checked={metronomeRecording}
                      onChange={(e) =>
                        onUpdateMetronomeSettings?.({ recording: e.target.checked })
                      }
                      className="size-3.5 rounded border-white/20 bg-black/60 text-fuchsia-600 focus:ring-0"
                    />
                    <span>Recording (Bunyikan saat merekam)</span>
                  </label>

                  {/* Playback Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200 hover:text-white">
                    <input
                      type="checkbox"
                      checked={metronomePlayback}
                      onChange={(e) =>
                        onUpdateMetronomeSettings?.({ playback: e.target.checked })
                      }
                      className="size-3.5 rounded border-white/20 bg-black/60 text-fuchsia-600 focus:ring-0"
                    />
                    <span>Playback (Bunyikan saat playback)</span>
                  </label>

                  {/* Count-In Measures Checkbox */}
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={hasCountIn}
                        onChange={(e) =>
                          onUpdateMetronomeSettings?.({ countIn: e.target.checked })
                        }
                        className="size-3.5 rounded border-white/20 bg-black/60 text-amber-500 focus:ring-0"
                      />
                      <span>Recording Count-In Measures</span>
                    </label>

                    {hasCountIn && (
                      <div className="flex items-center gap-2 pl-5 pt-1 text-[11px] text-zinc-400">
                        <span>Durasi:</span>
                        {[1, 2].map((num) => (
                          <button
                            key={num}
                            onClick={() =>
                              onUpdateMetronomeSettings?.({ countInMeasures: num })
                            }
                            className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                              countInMeasures === num
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-white/5 text-zinc-400 hover:text-white"
                            }`}
                          >
                            {num} {num === 1 ? "Measure" : "Measures"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-2 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => setIsMetronomeSettingsOpen(false)}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Count-In Toggle Quick Button */}
        {onToggleCountIn && (
          <button
            onClick={onToggleCountIn}
            title="Count-In Metronom (1 Bar sebelum Rekaman)"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
              hasCountIn
                ? "border border-amber-500/50 bg-amber-500/20 text-amber-300"
                : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Timer className="size-3" />
            <span>{countInMeasures || 1}-BAR</span>
          </button>
        )}

        {/* Digital Time & Beat Display */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1 font-mono text-xs shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-zinc-500 leading-none">BAR:BEAT</span>
            <span className="font-bold text-violet-300">
              {String(bar).padStart(3, "0")} : {String(beatInBar).padStart(2, "0")} : {String(tickInBeat).padStart(3, "0")}
            </span>
          </div>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-zinc-500 leading-none">TIME</span>
            <span className="font-bold text-zinc-300">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}.{String(millis).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Tempo (BPM) Widget with Dual Arrows: Left ±1 BPM, Right ±0.1 BPM, Center Exact Input (Mixcraft 10) */}
        <div
          title="Pengatur Tempo BPM: Panah kiri untuk ±1 BPM, panah kanan untuk ±0.1 BPM, klik angka untuk memasukkan nilai tepat."
          className="group/bpm flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-xs select-none"
        >
          {/* Left Arrows: ±1 BPM */}
          <div className="flex flex-col items-center justify-center border-r border-white/10 pr-0.5">
            <button
              onClick={() => onTempoChange(Math.min(320, Number((transport.tempo + 1).toFixed(1))))}
              title="Tambah 1 BPM"
              className="p-0.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition"
            >
              <ChevronUp className="size-2.5" />
            </button>
            <button
              onClick={() => onTempoChange(Math.max(20, Number((transport.tempo - 1).toFixed(1))))}
              title="Kurang 1 BPM"
              className="p-0.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition"
            >
              <ChevronDown className="size-2.5" />
            </button>
          </div>

          {/* Center Exact Tempo Input */}
          <div className="flex flex-col items-center px-1">
            <span className="text-[8px] font-bold text-zinc-400 leading-none">BPM</span>
            <input
              type="number"
              step="0.1"
              min={20}
              max={320}
              value={transport.tempo}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onTempoChange(val);
              }}
              className="w-12 bg-transparent text-center font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded text-xs"
            />
          </div>

          {/* Right Arrows: ±0.1 BPM (Fine) */}
          <div className="flex flex-col items-center justify-center border-l border-white/10 pl-0.5">
            <button
              onClick={() => onTempoChange(Math.min(320, Number((transport.tempo + 0.1).toFixed(1))))}
              title="Tambah 0.1 BPM (Fine Adjustment)"
              className="p-0.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition"
            >
              <ChevronUp className="size-2.5" />
            </button>
            <button
              onClick={() => onTempoChange(Math.max(20, Number((transport.tempo - 0.1).toFixed(1))))}
              title="Kurang 0.1 BPM (Fine Adjustment)"
              className="p-0.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition"
            >
              <ChevronDown className="size-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Kanan: Input Mic Selector, Sequencer & Mixer Toggle, Master Out Meter */}
      <div className="flex items-center gap-2">
        {/* Sound Device / Audio Driver Selector (Preferences > Sound Device per Mixcraft 10) */}
        {onSelectAudioDriver && (
          <div className="relative hidden md:flex items-center">
            <button
              onClick={() => setIsDriverMenuOpen((prev) => !prev)}
              title="Pilih Driver Audio Sistem (File > Preferences > Sound Device): WaveRT / Core Audio, Wave, atau ASIO"
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-mono font-bold border transition ${
                audioDriver === "asio"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              <Activity className="size-3 text-cyan-400" />
              <span>{audioDriver.toUpperCase()}</span>
              <ChevronDown className="size-2.5 opacity-60" />
            </button>

            {isDriverMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDriverMenuOpen(false)}
                />
                <div className="absolute top-8 right-0 z-50 w-60 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl text-xs select-none">
                  <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/10 mb-1">
                    Preferences &gt; Sound Device
                  </div>
                  {[
                    { id: "wavert", label: "WaveRT / Core Audio", desc: "Software input gain fader (Merah saat arm)" },
                    { id: "wave", label: "Wave / MME Audio", desc: "Standard software input level adjuster" },
                    { id: "asio", label: "ASIO Audio Driver", desc: "Hardware preamp gain (Fader hilang saat arm)" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        onSelectAudioDriver(d.id as AudioDriverType);
                        setIsDriverMenuOpen(false);
                      }}
                      className={`flex w-full flex-col items-start rounded px-2 py-1.5 transition text-left ${
                        audioDriver === d.id
                          ? "bg-violet-600/30 text-white font-bold"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{d.label}</span>
                        {audioDriver === d.id && <Check className="size-3 text-violet-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-normal">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Input Device Dropdown & Meter */}
        {inputDevices.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
            <Mic className={`size-3.5 ${isInputClipping ? "text-red-500 animate-ping" : "text-red-400"}`} />
            <select
              value={selectedDeviceId || ""}
              onChange={(e) => onSelectInputDevice(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 focus:outline-none max-w-[120px] truncate"
            >
              <option value="" className="bg-charcoal text-white">Default Mic</option>
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-charcoal text-white">
                  {d.label}
                </option>
              ))}
            </select>
            {/* Input Live VU Meter */}
            <div className="h-3 w-8 rounded-full bg-black/60 overflow-hidden p-0.5 flex items-center">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  isInputClipping
                    ? "bg-red-500 w-full"
                    : "bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
                }`}
                style={{ width: `${Math.min(100, inputLevel * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Sequencer Toggle */}
        {onToggleStepSequencer && (
          <button
            onClick={onToggleStepSequencer}
            title="Buka / Tutup Beat Machine & Step Sequencer"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              isStepSequencerOpen
                ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Grid3X3 className="size-3.5" />
            <span className="hidden sm:inline">Beat Machine</span>
          </button>
        )}

        {/* Mixer Panel Toggle */}
        <button
          onClick={onToggleMixer}
          title="Buka / Tutup Mixer Console"
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
            isMixerOpen
              ? "border-violet-500 bg-violet-600/30 text-white"
              : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Sliders className="size-3.5" />
          <span>Mixer</span>
        </button>

        {/* Lirik Karaoke Teleprompter Toggle */}
        {onToggleLyrics && (
          <button
            onClick={onToggleLyrics}
            title="Buka / Tutup Panel Lirik Karaoke & Teleprompter DAW"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
              isLyricsOpen
                ? "border-fuchsia-500 bg-fuchsia-600/30 text-white shadow-sm"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Mic2 className={`size-3.5 ${hasLyrics ? "text-fuchsia-400 animate-pulse" : "text-zinc-400"}`} />
            <span className="hidden md:inline">Lirik</span>
            {hasLyrics && (
              <span className="size-1.5 rounded-full bg-pink-400 inline-block" />
            )}
          </button>
        )}

        {/* MIDI Learn & Hardware Controller Mapping Toggle (Mixcraft 10 Hlm. 488, 661) */}
        {onToggleMidiLearn && (
          <div className="flex items-center">
            <button
              onClick={onToggleMidiLearn}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenMidiLearnDialog?.();
              }}
              title="Toggle MIDI Learn Mode (Mixcraft 10 Hlm. 488). Klik kanan untuk Buka Pengaturan Control Surface."
              className={`flex items-center gap-1.5 rounded-l-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                isMidiLearnActive
                  ? "border-purple-500 bg-purple-600/30 text-white shadow-purple-500/20 animate-pulse"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Radio className={`size-3.5 ${isMidiLearnActive ? "text-purple-300 animate-pulse" : "text-zinc-400"}`} />
              <span className="hidden sm:inline">MIDI Learn</span>
              {isMidiLearnActive && (
                <span className="size-1.5 rounded-full bg-purple-400 inline-block animate-ping" />
              )}
            </button>
            <button
              onClick={onOpenMidiLearnDialog}
              title="Buka Dialog Pengaturan Kontrol Permukaan MIDI (Mixcraft 10 Hlm. 661)"
              className={`border-y border-r rounded-r-xl px-1.5 py-1.5 text-xs transition ${
                isMidiLearnActive
                  ? "border-purple-500 bg-purple-600/20 text-purple-200 hover:bg-purple-600/40"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Settings className="size-3.5" />
            </button>
          </div>
        )}

        {/* Master Output Fader & VU Meter */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <Volume2 className="size-3.5 text-zinc-400 shrink-0" />
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            title={`Master Gain: ${(masterVolume * 100).toFixed(0)}%`}
            className="w-16 accent-violet-500 cursor-pointer"
          />
          {/* Master Output VU Meter */}
          <div className="h-4 w-12 rounded bg-black/60 overflow-hidden p-0.5 flex items-center">
            <div
              className="h-full rounded-sm bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
              style={{ width: `${Math.min(100, masterLevel * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
