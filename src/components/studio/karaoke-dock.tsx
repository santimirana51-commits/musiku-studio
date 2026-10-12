"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic2,
  X,
  Upload,
  FileText,
  Music,
  Plus,
  BookmarkPlus,
  Sliders,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Volume2,
} from "lucide-react";
import type {
  StudioProject,
  StudioLyricsData,
  StudioLyricsLine,
  StudioMarker,
  StudioTrack,
  StudioClip,
} from "@/lib/studio/types";
import { parseLrc } from "@/lib/karaoke/lrc";
import { createTrack } from "@/lib/studio/schema";
import { useToast } from "@/components/toast";

interface KaraokeDockProps {
  project: StudioProject;
  currentTimeSeconds: number;
  currentBeat: number;
  isPlaying: boolean;
  onUpdateProject: (updater: (prev: StudioProject) => StudioProject) => void;
  onSeekSeconds: (sec: number) => void;
  onImportAudioFile: (file: File) => Promise<void>;
  onClose: () => void;
}

export function KaraokeDock({
  project,
  currentTimeSeconds,
  currentBeat,
  isPlaying,
  onUpdateProject,
  onSeekSeconds,
  onImportAudioFile,
  onClose,
}: KaraokeDockProps) {
  const { toast } = useToast();
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteRawText, setPasteRawText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [offsetSec, setOffsetSec] = useState<number>(project.lyrics?.offsetSec ?? 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcFileInputRef = useRef<HTMLInputElement>(null);

  const lyrics = project.lyrics;
  const lines = lyrics?.lines ?? [];

  // Hitung baris aktif berdasarkan currentTimeSeconds + offset
  const effectiveSec = Math.max(0, currentTimeSeconds + offsetSec);
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec <= effectiveSec) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Auto-scroll ke baris aktif saat playback berjalan
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  // Handle upload file .lrc
  const handleLrcFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const parsed = parseLrc(content);
      if (parsed.lines.length === 0) {
        toast("Tidak ada baris lirik bertimestamp yang valid pada berkas ini.", "error");
        return;
      }

      const studioLines: StudioLyricsLine[] = parsed.lines.map((l) => ({
        timeSec: l.timeMs / 1000,
        text: l.text,
      }));

      const newLyrics: StudioLyricsData = {
        title: parsed.metadata.title || file.name.replace(/\.lrc$/i, ""),
        artist: parsed.metadata.artist || "",
        lrcRaw: content,
        offsetSec: (parsed.metadata.fileOffsetMs || 0) / 1000,
        lines: studioLines,
      };

      setOffsetSec(newLyrics.offsetSec || 0);
      onUpdateProject((prev) => ({
        ...prev,
        lyrics: newLyrics,
      }));

      toast(`Lirik "${newLyrics.title}" (${studioLines.length} baris) berhasil dimuat!`, "success");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Handle paste LRC modal submit
  const handleApplyPastedLrc = () => {
    if (!pasteRawText.trim()) {
      toast("Harap tempel teks lirik terlebih dahulu.", "error");
      return;
    }

    const parsed = parseLrc(pasteRawText);
    if (parsed.lines.length === 0) {
      toast("Tidak ditemukan timestamp [mm:ss] yang valid pada teks yang ditempel.", "error");
      return;
    }

    const studioLines: StudioLyricsLine[] = parsed.lines.map((l) => ({
      timeSec: l.timeMs / 1000,
      text: l.text,
    }));

    const newLyrics: StudioLyricsData = {
      title: pasteTitle.trim() || parsed.metadata.title || "Lirik Lagu",
      artist: parsed.metadata.artist || "",
      lrcRaw: pasteRawText,
      offsetSec: (parsed.metadata.fileOffsetMs || 0) / 1000,
      lines: studioLines,
    };

    setOffsetSec(newLyrics.offsetSec || 0);
    onUpdateProject((prev) => ({
      ...prev,
      lyrics: newLyrics,
    }));

    setShowPasteModal(false);
    setPasteRawText("");
    setPasteTitle("");
    toast(`Lirik berhasil dimuat (${studioLines.length} baris)!`, "success");
  };

  // Convert lyric cues to markers on DAW ruler
  const handleConvertToMarkers = () => {
    if (lines.length === 0) {
      toast("Tidak ada lirik untuk dikonversi menjadi marker.", "error");
      return;
    }

    const secPerBeat = 60 / project.tempo;
    // Ambil sampel baris penting (atau setiap baris jika sedikit)
    const newMarkers: StudioMarker[] = lines.slice(0, 32).map((l, idx) => {
      const beat = (l.timeSec - offsetSec) / secPerBeat;
      return {
        id: `marker_lyric_${idx}_${Date.now()}`,
        name: l.text.length > 25 ? `${l.text.substring(0, 22)}...` : l.text,
        beat: Math.max(0, beat),
        color: idx % 2 === 0 ? "#ec4899" : "#a855f7",
      };
    });

    onUpdateProject((prev) => ({
      ...prev,
      markers: [...prev.markers, ...newMarkers],
    }));

    toast(`${newMarkers.length} marker lirik disematkan pada timeline!`, "success");
  };

  // Quick Vocal Setup: Buat track Vokal baru dan langsung Arm Record
  const handleSetupVocalTrack = () => {
    onUpdateProject((prev) => {
      const vocalTrack = createTrack("audio", "Lead Vocal", prev.tracks.length);
      vocalTrack.armRecord = true;
      vocalTrack.color = "#f43f5e"; // Rose vocal color
      // Disarm other tracks to ensure clean vocal tracking
      const updatedTracks = prev.tracks.map((t) => ({ ...t, armRecord: false }));
      return {
        ...prev,
        tracks: [...updatedTracks, vocalTrack],
      };
    });
    toast("Track 'Lead Vocal' siap & Record-Arm aktif! Klik Record pada transport untuk bernyanyi.", "success");
  };

  // Update offset in project
  const handleOffsetChange = (val: number) => {
    setOffsetSec(val);
    onUpdateProject((prev) => ({
      ...prev,
      lyrics: prev.lyrics
        ? {
            ...prev.lyrics,
            offsetSec: val,
          }
        : undefined,
    }));
  };

  // Format mm:ss.xx
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <aside
      aria-label="Panel Lirik Karaoke"
      className="flex flex-col border-t border-white/10 bg-gradient-to-b from-[#18122B] via-charcoal to-[#0F0C20] shadow-2xl transition-all duration-300"
      style={{ height: isMinimized ? "44px" : "280px" }}
    >
      {/* Hidden File Inputs */}
      <input
        ref={lrcFileInputRef}
        type="file"
        accept=".lrc,text/plain"
        onChange={handleLrcFileUpload}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void onImportAudioFile(file);
          }
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-4 bg-white/5 select-none">
        <div className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white shadow">
            <Mic2 className="size-4" />
          </span>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white tracking-wide">
              Lirik Karaoke & Teleprompter
            </h3>
            {lyrics?.title && (
              <span className="rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-fuchsia-300 border border-fuchsia-500/30">
                {lyrics.title} {lyrics.artist ? `— ${lyrics.artist}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Audio Backing Track Picker */}
          <button
            onClick={() => audioInputRef.current?.click()}
            title="Impor Berkas Backing Track / Instrumental Audio ke Timeline"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <Music className="size-3 text-pink-400" />
            <span className="hidden sm:inline">+ Backing Track</span>
          </button>

          {/* Quick Vocal Arm Track */}
          <button
            onClick={handleSetupVocalTrack}
            title="Buat Track Vokal Baru dan aktifkan Record-Arm"
            className="flex items-center gap-1 rounded-lg border border-fuchsia-500/30 bg-fuchsia-600/20 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 hover:bg-fuchsia-600/30 transition"
          >
            <Plus className="size-3" />
            <span className="hidden sm:inline">Track Vokal</span>
          </button>

          {/* Convert to Markers */}
          {lines.length > 0 && (
            <button
              onClick={handleConvertToMarkers}
              title="Sematkan baris lirik sebagai marker pada ruler timeline DAW"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
            >
              <BookmarkPlus className="size-3 text-violet-400" />
              <span className="hidden md:inline">Marker</span>
            </button>
          )}

          {/* Load LRC File */}
          <button
            onClick={() => lrcFileInputRef.current?.click()}
            title="Buka Berkas .LRC dari Komputer"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <Upload className="size-3 text-amber-400" />
            <span className="hidden lg:inline">Buka .LRC</span>
          </button>

          {/* Paste LRC text */}
          <button
            onClick={() => setShowPasteModal(true)}
            title="Tempel Teks Lirik [mm:ss]"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <FileText className="size-3 text-cyan-400" />
            <span className="hidden lg:inline">Tempel</span>
          </button>

          {/* Minimize / Maximize */}
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            title={isMinimized ? "Perbesar Panel" : "Perkecil Panel"}
          >
            {isMinimized ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            title="Tutup Panel Lirik"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area (Hidden if Minimized) */}
      {!isMinimized && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left / Teleprompter Display */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-3 scroll-smooth text-center"
          >
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center space-y-3 py-6 text-zinc-400">
                <div className="grid size-12 place-items-center rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                  <Sparkles className="size-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-bold text-white">
                    Belum ada lirik lagu yang dimuat
                  </p>
                  <p className="text-xs text-zinc-400">
                    Buka file <strong>.LRC</strong>, tempel teks lirik bertimestamp, atau kirim lirik dari menu <strong>Karaoke MusikKu</strong> untuk bernyanyi langsung di DAW.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => lrcFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow transition"
                  >
                    <Upload className="size-3.5" />
                    <span>Pilih Berkas .LRC</span>
                  </button>
                  <button
                    onClick={() => setShowPasteModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                  >
                    <FileText className="size-3.5" />
                    <span>Tempel Teks LRC</span>
                  </button>
                </div>
              </div>
            ) : (
              lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPast = idx < activeIndex;

                return (
                  <div
                    key={`${line.timeSec}_${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => onSeekSeconds(line.timeSec - offsetSec)}
                    title={`Klik untuk melompat ke ${formatTime(line.timeSec)}`}
                    className={`group cursor-pointer rounded-2xl py-2 px-4 transition-all duration-200 select-none ${
                      isActive
                        ? "bg-gradient-to-r from-violet-600/30 via-fuchsia-600/40 to-pink-600/30 border border-fuchsia-500/50 shadow-lg scale-105"
                        : isPast
                        ? "opacity-40 hover:opacity-80"
                        : "opacity-70 hover:opacity-100 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[10px] font-mono font-medium text-zinc-500 group-hover:text-fuchsia-400">
                        {formatTime(line.timeSec)}
                      </span>
                      {isActive && (
                        <span className="size-2 rounded-full bg-pink-400 animate-ping inline-block" />
                      )}
                      <p
                        className={`text-sm md:text-base font-extrabold tracking-wide transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-violet-200 via-pink-200 to-white bg-clip-text text-transparent drop-shadow"
                            : "text-zinc-300"
                        }`}
                      >
                        {line.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Sidebar: Offset & Live Monitor Info */}
          {lines.length > 0 && (
            <div className="hidden sm:flex w-52 shrink-0 flex-col justify-between border-l border-white/10 bg-black/30 p-3 text-xs space-y-3">
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Kalibrasi Sinkronisasi
                </span>
                <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/5 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Offset Lirik:</span>
                    <span className="font-mono font-bold text-fuchsia-300">
                      {offsetSec > 0 ? `+${offsetSec.toFixed(2)}s` : `${offsetSec.toFixed(2)}s`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={offsetSec}
                    onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
                    className="w-full accent-fuchsia-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500">
                    <span>-5.0s</span>
                    <button
                      onClick={() => handleOffsetChange(0)}
                      className="text-zinc-400 hover:text-white"
                    >
                      Reset
                    </button>
                    <span>+5.0s</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Total Baris:</span>
                    <span className="font-bold text-white">{lines.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Waktu Playhead:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatTime(currentTimeSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Beat / Bar:</span>
                    <span className="font-mono font-bold text-violet-300">
                      {currentBeat.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 leading-tight">
                💡 <em>Klik pada baris mana pun untuk melompatkan playhead DAW ke bait tersebut.</em>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Tempel Teks LRC */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-cyan-600/20 text-cyan-400">
                  <FileText className="size-4" />
                </span>
                <h3 className="text-sm font-bold text-white">Tempel Lirik Bertimestamp (.LRC)</h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Judul Lagu (Opsional)</label>
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Contoh: Menghapus Jejakmu"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Teks LRC [mm:ss.xx]</label>
                <textarea
                  rows={8}
                  value={pasteRawText}
                  onChange={(e) => setPasteRawText(e.target.value)}
                  placeholder="[00:12.50] Ku berjalan melintasi malam&#10;[00:16.20] Mencari arti sejati&#10;[00:22.00] ..."
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
              <button
                onClick={() => setShowPasteModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={handleApplyPastedLrc}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow"
              >
                Terapkan ke Teleprompter
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
