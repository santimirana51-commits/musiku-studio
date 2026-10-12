"use client";

import React, { useState, useRef } from "react";
import {
  Film,
  X,
  Type,
  Maximize2,
  Minimize2,
  MonitorPlay,
  Upload,
  Play,
  Pause,
  Layers,
} from "lucide-react";
import type { StudioProject, StudioClip } from "@/lib/studio/types";

interface VideoWindowProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProject;
  currentTimeSeconds: number;
  currentBeat: number;
  isPlaying: boolean;
  onTogglePlay?: () => void;
  onImportVideoFile?: (file: File) => void;
  onAddTextClip?: (text: string) => void;
}

export function VideoWindow({
  isOpen,
  onClose,
  project,
  currentTimeSeconds,
  currentBeat,
  isPlaying,
  onTogglePlay,
  onImportVideoFile,
  onAddTextClip,
}: VideoWindowProps) {
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newTextVal, setNewTextVal] = useState("");
  const [isAddingText, setIsAddingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const videoTrack = project.tracks.find((t) => t.type === "video");
  const videoTextTrack = project.tracks.find((t) => t.type === "video-text");

  // Find clip at current playback position
  const activeVideoClip: StudioClip | undefined = videoTrack?.clips.find(
    (c) => currentBeat >= c.startBeat && currentBeat < c.startBeat + c.durationBeats
  );

  const activeTextClip: StudioClip | undefined = videoTextTrack?.clips.find(
    (c) => currentBeat >= c.startBeat && currentBeat < c.startBeat + c.durationBeats
  );

  // Calculate SMPTE timecode (HH:MM:SS:FF at 30 fps)
  const totalFrames = Math.floor(currentTimeSeconds * 30);
  const ff = totalFrames % 30;
  const totalSeconds = Math.floor(currentTimeSeconds);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const smpte = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportVideoFile) {
      onImportVideoFile(file);
    }
  };

  const handleAddTextSubmit = () => {
    if (newTextVal.trim() && onAddTextClip) {
      onAddTextClip(newTextVal.trim());
      setNewTextVal("");
      setIsAddingText(false);
    }
  };

  return (
    <div
      className={`fixed z-50 flex flex-col rounded-2xl border border-white/20 bg-zinc-950/95 shadow-2xl backdrop-blur-xl transition-all duration-200 select-none ${
        isFullscreen
          ? "inset-4"
          : "bottom-12 right-12 w-[460px] md:w-[540px] max-w-[90vw]"
      }`}
    >
      {/* Title Bar (Mixcraft 10 Floating Video Preview Window) */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-3 py-2 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
            <Film className="size-3.5" />
          </span>
          <span className="text-xs font-bold text-white truncate">
            Video Preview &mdash; {project.name}
          </span>
          <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
            {smpte}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Aspect ratio button */}
          <button
            onClick={() => setAspectRatio(aspectRatio === "16:9" ? "4:3" : "16:9")}
            title={`Ganti Aspect Ratio (Saat ini: ${aspectRatio})`}
            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            {aspectRatio}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Kembalikan Ukuran" : "Perbesar Penuh (Fullscreen)"}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Tutup Jendela Video Preview"
            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/10 transition cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Video Preview Canvas Screen */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden p-2">
        <div
          className={`relative w-full rounded-lg overflow-hidden border border-white/10 bg-zinc-900 shadow-inner flex items-center justify-center ${
            aspectRatio === "16:9" ? "aspect-video" : "aspect-4/3"
          }`}
        >
          {activeVideoClip ? (
            <div className="relative size-full flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
              {/* Simulated active video stream rendering */}
              <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                <MonitorPlay className="size-10 text-cyan-400 animate-pulse" />
                <span className="text-sm font-bold text-white">
                  {activeVideoClip.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Playback: Beat {currentBeat.toFixed(2)} / Duration {activeVideoClip.durationBeats.toFixed(1)}b
                </span>
              </div>
            </div>
          ) : (
            /* Standby Test Pattern Slate */
            <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 p-6 text-center select-none">
              <div className="flex gap-1 mb-1">
                <div className="w-4 h-6 bg-cyan-600 rounded-xs" />
                <div className="w-4 h-6 bg-yellow-500 rounded-xs" />
                <div className="w-4 h-6 bg-green-500 rounded-xs" />
                <div className="w-4 h-6 bg-magenta-500 rounded-xs" />
                <div className="w-4 h-6 bg-red-600 rounded-xs" />
                <div className="w-4 h-6 bg-blue-600 rounded-xs" />
              </div>
              <span className="text-xs font-semibold text-zinc-400">
                Mixcraft Video Preview Standby
              </span>
              <span className="text-[10px] text-zinc-500">
                {videoTrack
                  ? "Tidak ada klip video pada posisi playhead saat ini"
                  : "Tambahkan Video Track untuk memuat klip video & gambar"}
              </span>
            </div>
          )}

          {/* Video Text Overlay (Titles, Lyrics, or Credits) */}
          {activeTextClip && (
            <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
              <div className="rounded-lg bg-black/60 px-4 py-2 border border-white/20 backdrop-blur-md shadow-2xl text-center animate-fade-in">
                <p className="text-base font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide font-sans">
                  {activeTextClip.textOverlay || activeTextClip.name}
                </p>
                <span className="text-[8px] font-mono text-blue-300 uppercase tracking-widest">
                  Video Text / Subtitle
                </span>
              </div>
            </div>
          )}

          {/* Watermark in corner */}
          <div className="absolute bottom-2 right-2 text-[9px] font-mono text-zinc-600 pointer-events-none select-none">
            Mixcraft 10 Engine
          </div>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-3 py-2 rounded-b-2xl text-xs">
        <div className="flex items-center gap-1.5">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isPlaying
                  ? "bg-amber-600 border-amber-500 text-white"
                  : "bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
              }`}
              title={isPlaying ? "Jeda (Pause)" : "Putar (Play)"}
            >
              {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
            </button>
          )}

          {/* Import Video Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 hover:text-white transition cursor-pointer text-[10px] font-bold"
            title="Impor video atau gambar diam (MP4, WebM, MOV, JPG, PNG)"
          >
            <Upload className="size-3" />
            <span>Impor Video...</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Add Video Text Button */}
          <button
            onClick={() => setIsAddingText(!isAddingText)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-500/30 bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 hover:text-white transition cursor-pointer text-[10px] font-bold"
            title="Tambah judul, teks statis/scrolling, lirik, atau credits"
          >
            <Type className="size-3" />
            <span>+ Text / Lirik</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <Layers className="size-3 text-cyan-400" />
          <span>{videoTrack ? "1 Video Track" : "0 Video Track"}</span>
        </div>
      </div>

      {/* Add Text Inline Modal */}
      {isAddingText && (
        <div className="border-t border-white/10 bg-black/90 p-3 rounded-b-2xl flex items-center gap-2">
          <input
            type="text"
            value={newTextVal}
            onChange={(e) => setNewTextVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTextSubmit()}
            placeholder="Tulis judul, teks lirik, atau kredit..."
            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            onClick={handleAddTextSubmit}
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition cursor-pointer"
          >
            Tambah
          </button>
          <button
            onClick={() => setIsAddingText(false)}
            className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-white transition cursor-pointer"
          >
            Batal
          </button>
        </div>
      )}
    </div>
  );
}
