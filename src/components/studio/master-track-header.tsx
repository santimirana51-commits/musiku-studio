"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Disc,
  Volume2,
  Sliders,
  Shield,
  Plus,
  Check,
  Trash2,
  X,
  MoreVertical,
} from "lucide-react";
import type { MasterTrack, PluginInstance } from "@/lib/studio/types";

interface MasterTrackHeaderProps {
  masterTrack: MasterTrack;
  masterLevel: number;
  showEffectsOnTracks?: boolean;
  onUpdateMasterTrack: (updates: Partial<MasterTrack>) => void;
  onOpenPluginDialog: () => void;
  onCloseAllEffectWindows?: () => void;
  height?: number;
}

const AVAILABLE_MASTER_EFFECTS: Array<{
  pluginId: string;
  name: string;
  defaultParams: Record<string, number>;
}> = [
  { pluginId: "internal.limiter", name: "Brickwall Limiter", defaultParams: { threshold: -0.3, release: 0.05 } },
  { pluginId: "internal.eq3", name: "Master EQ", defaultParams: { lowGain: 0, midGain: 0, highGain: 0 } },
  { pluginId: "internal.compressor", name: "Master Compressor", defaultParams: { threshold: -18, ratio: 2.5, attack: 0.01, release: 0.1 } },
];

export function MasterTrackHeader({
  masterTrack,
  masterLevel,
  showEffectsOnTracks = false,
  onUpdateMasterTrack,
  onOpenPluginDialog,
  onCloseAllEffectWindows,
  height = 96,
}: MasterTrackHeaderProps) {
  const [effectContextMenu, setEffectContextMenu] = useState<{
    x: number;
    y: number;
    pluginIndex: number;
  } | null>(null);
  const [isAddEffectOpen, setIsAddEffectOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [exactValueModal, setExactValueModal] = useState<"volume" | "pan" | null>(null);
  const [exactInputVal, setExactInputVal] = useState("");

  const volFaderRef = useRef<HTMLDivElement>(null);
  const panFaderRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const effectMenuRef = useRef<HTMLDivElement>(null);
  const addEffectRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (effectMenuRef.current && !effectMenuRef.current.contains(e.target as Node)) {
        setEffectContextMenu(null);
      }
      if (addEffectRef.current && !addEffectRef.current.contains(e.target as Node)) {
        setIsAddEffectOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format volume dB and percentage
  const volPct = Math.round(masterTrack.volume * 100);
  const volDb =
    masterTrack.volume === 0
      ? "-Inf dB"
      : `${(20 * Math.log10(masterTrack.volume)).toFixed(1)} dB`;

  // Format pan
  const panPct = Math.round(masterTrack.pan * 100);
  const panText =
    panPct === 0 ? "C" : panPct < 0 ? `L${Math.abs(panPct)}%` : `R${panPct}%`;

  // Volume slider drag
  const handleVolMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = volFaderRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startVol = masterTrack.volume;
    const isFine = e.altKey || e.shiftKey || e.ctrlKey;

    const handleMouseMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const sensitivity = isFine ? 0.001 : 0.005;
      const nextVol = Math.max(0, Math.min(2.0, startVol + deltaX * sensitivity));
      onUpdateMasterTrack({ volume: nextVol });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Pan slider drag
  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startPan = masterTrack.pan;
    const isFine = e.altKey || e.shiftKey || e.ctrlKey;

    const handleMouseMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const sensitivity = isFine ? 0.002 : 0.01;
      const nextPan = Math.max(-1.0, Math.min(1.0, startPan + deltaX * sensitivity));
      onUpdateMasterTrack({ pan: nextPan });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Add effect
  const handleAddEffect = (effectDef: (typeof AVAILABLE_MASTER_EFFECTS)[0]) => {
    const newPlugin: PluginInstance = {
      id: `master_plug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pluginId: effectDef.pluginId,
      name: effectDef.name,
      enabled: true,
      parameters: { ...effectDef.defaultParams },
    };
    onUpdateMasterTrack({
      plugins: [...masterTrack.plugins, newPlugin],
    });
    setIsAddEffectOpen(false);
  };

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative flex flex-col justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-zinc-950 to-zinc-900/90 px-2 py-1.5 transition select-none"
    >
      {/* Top Accent Strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-rose-500 shadow-sm" />

      {/* Top Row: Master Badge, Name, Limiter status & Context dots */}
      <div className="flex items-center justify-between gap-1 pl-1">
        <div className="flex items-center gap-1.5 truncate">
          <span className="grid size-5 place-items-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs">
            <Disc className="size-3" />
          </span>
          <span className="text-xs font-black tracking-tight text-white uppercase drop-shadow">
            Master Track
          </span>
          <span className="rounded bg-rose-950/60 border border-rose-500/30 px-1 py-0.2 text-[8px] font-bold text-rose-300 flex items-center gap-0.5">
            <Shield className="size-2.5 text-rose-400" />
            Limiter -0.3dB
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenPluginDialog}
            title="Edit Master FX"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <Sliders className="size-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({ x: rect.right, y: rect.bottom });
            }}
            title="Opsi Master Track"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <MoreVertical className="size-3" />
          </button>
        </div>
      </div>

      {/* Middle Row: Inline Effects on Track (if Show Effects On Tracks enabled) */}
      {showEffectsOnTracks && (
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 pl-1 scrollbar-none">
          <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 shrink-0">
            FX:
          </span>
          {masterTrack.plugins.map((plugin, idx) => (
            <button
              key={plugin.id || idx}
              onClick={() => {
                const updated = masterTrack.plugins.map((p, i) =>
                  i === idx ? { ...p, enabled: !p.enabled } : p
                );
                onUpdateMasterTrack({ plugins: updated });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEffectContextMenu({ x: e.clientX, y: e.clientY, pluginIndex: idx });
              }}
              title={`${plugin.name} (${plugin.enabled ? "Aktif" : "Bypass"}). Klik kanan untuk submenu.`}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold border transition shrink-0 ${
                plugin.enabled
                  ? "bg-purple-900/60 border-purple-500/50 text-purple-200 hover:bg-purple-800/80 shadow-xs"
                  : "bg-zinc-800/60 border-zinc-700 text-zinc-500 line-through opacity-70"
              }`}
            >
              {plugin.name}
            </button>
          ))}

          {/* Plus button to add insert effect */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddEffectOpen(!isAddEffectOpen);
              }}
              title="Tambah Master Effect..."
              className="rounded border border-purple-500/30 bg-purple-950/40 p-0.5 text-purple-300 hover:bg-purple-800/60 hover:text-white transition"
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
                  Tambah Master Effect
                </div>
                {AVAILABLE_MASTER_EFFECTS.map((fx) => (
                  <button
                    key={fx.pluginId}
                    onClick={() => handleAddEffect(fx)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-[11px] text-zinc-200 hover:bg-purple-900/30 hover:text-purple-200 transition"
                  >
                    <span>{fx.name}</span>
                    <Plus className="size-3 text-purple-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Row: Pan Slider + Volume Horizontal Fader with Level Meter */}
      <div className="flex items-center gap-2 pl-1">
        {/* Master Pan */}
        <div
          ref={panFaderRef}
          onMouseDown={handlePanMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onUpdateMasterTrack({ pan: 0 });
          }}
          title={`Master Pan: ${panText}. Double click untuk Center.`}
          className="relative h-4 w-12 rounded bg-black/70 border border-white/15 cursor-ew-resize overflow-hidden flex items-center shrink-0"
        >
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/30 pointer-events-none" />
          {masterTrack.pan < 0 ? (
            <div
              className="absolute top-0.5 bottom-0.5 bg-amber-500/70 pointer-events-none rounded-xs"
              style={{
                left: `${((masterTrack.pan + 1) / 2) * 100}%`,
                width: `${(-masterTrack.pan / 2) * 100}%`,
              }}
            />
          ) : masterTrack.pan > 0 ? (
            <div
              className="absolute top-0.5 bottom-0.5 bg-amber-500/70 pointer-events-none rounded-xs"
              style={{
                left: "50%",
                width: `${(masterTrack.pan / 2) * 100}%`,
              }}
            />
          ) : null}
          <div
            className="absolute top-0.5 bottom-0.5 w-1.5 -translate-x-1/2 rounded-xs bg-white shadow-sm pointer-events-none"
            style={{ left: `${((masterTrack.pan + 1) / 2) * 100}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black font-mono text-zinc-300 pointer-events-none drop-shadow">
            {panText}
          </span>
        </div>

        {/* Master Volume Fader with Live Master Output Meter */}
        <div
          ref={volFaderRef}
          onMouseDown={handleVolMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onUpdateMasterTrack({ volume: 1.0 }); // Reset to 100% (0 dB)
          }}
          title={`Master Volume: ${volPct}% (${volDb}). Double click untuk 100% (0dB).`}
          className="group/vol relative h-5 flex-1 rounded bg-black/80 border border-white/15 cursor-ew-resize overflow-hidden flex items-center"
        >
          {/* Integrated Master Output Meter Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded transition-all duration-75 pointer-events-none opacity-80"
            style={{
              width: `${Math.min(100, masterLevel * 100)}%`,
              background: "linear-gradient(to right, #10b981 60%, #eab308 85%, #ef4444 100%)",
            }}
          />

          {/* 100% Unity Gain Line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/40 pointer-events-none z-10"
            title="100% (0 dB Unity Gain)"
          />

          {/* Fader Handle */}
          <div
            className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-xs bg-amber-400 border border-black/40 shadow-md pointer-events-none z-20 flex items-center justify-center"
            style={{ left: `${Math.min(100, (masterTrack.volume / 2.0) * 100)}%` }}
          >
            <div className="h-3 w-0.5 bg-black/70 rounded-full" />
          </div>

          {/* Label Overlay */}
          <div className="absolute inset-0 z-30 flex items-center justify-between px-1.5 pointer-events-none text-[8px] font-mono font-bold drop-shadow">
            <span className="flex items-center gap-0.5 text-zinc-300">
              <Volume2 className="size-2.5 opacity-60" />
              <span>{volPct}%</span>
            </span>
            <span className={masterTrack.volume > 1.0 ? "text-amber-300" : "text-zinc-400"}>
              {volDb}
            </span>
          </div>
        </div>
      </div>

      {/* Purple Effect Button Submenu Modal */}
      {effectContextMenu && (
        <div
          ref={effectMenuRef}
          className="fixed z-50 w-52 rounded-xl border border-purple-500/30 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none"
          style={{ top: `${effectContextMenu.y}px`, left: `${effectContextMenu.x}px` }}
        >
          <div className="px-2 py-1 font-bold text-purple-400 text-[10px] uppercase tracking-wider border-b border-white/10">
            Purple Effect Submenu
          </div>
          <button
            onClick={() => {
              const updated = masterTrack.plugins.map((p, i) =>
                i === effectContextMenu.pluginIndex ? { ...p, enabled: !p.enabled } : p
              );
              onUpdateMasterTrack({ plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Active</span>
            {masterTrack.plugins[effectContextMenu.pluginIndex]?.enabled && (
              <Check className="size-3 text-emerald-400" />
            )}
          </button>
          <button
            onClick={() => {
              const updated = masterTrack.plugins.filter(
                (_, i) => i !== effectContextMenu.pluginIndex
              );
              onUpdateMasterTrack({ plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-red-300 hover:bg-red-500/20 transition"
          >
            <span>Remove</span>
            <Trash2 className="size-3" />
          </button>
          <button
            onClick={() => {
              const allActive = masterTrack.plugins.every((p) => p.enabled);
              const updated = masterTrack.plugins.map((p) => ({ ...p, enabled: !allActive }));
              onUpdateMasterTrack({ plugins: updated });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Effect List Is Active</span>
            {masterTrack.plugins.every((p) => p.enabled) && (
              <Check className="size-3 text-emerald-400" />
            )}
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            onClick={() => {
              onOpenPluginDialog();
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Edit Effects List...</span>
          </button>
          <button
            onClick={() => {
              onCloseAllEffectWindows?.();
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Close All Effect Windows</span>
          </button>
          <button
            onClick={() => {
              onUpdateMasterTrack({ plugins: [] });
              setEffectContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-red-400 hover:bg-red-500/20 transition"
          >
            <span>Remove All Effects</span>
          </button>
        </div>
      )}

      {/* Context Menu for Master Track */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-56 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md text-xs select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-2 py-1 font-bold text-amber-400 text-[10px] uppercase tracking-wider border-b border-white/10">
            Opsi Master Track
          </div>
          <button
            onClick={() => {
              setExactValueModal("volume");
              setExactInputVal(volPct.toString());
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Set Exact Master Volume...</span>
          </button>
          <button
            onClick={() => {
              setExactValueModal("pan");
              setExactInputVal(panPct.toString());
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Set Exact Master Pan...</span>
          </button>
          <button
            onClick={() => {
              onUpdateMasterTrack({ volume: 1.0, pan: 0.0 });
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-zinc-200 hover:bg-white/10 transition"
          >
            <span>Reset ke 0 dB (Unity Gain) & Center</span>
          </button>
        </div>
      )}

      {/* Set Exact Value Dialog */}
      {exactValueModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
          onClick={() => setExactValueModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 rounded-2xl border border-white/15 bg-zinc-900 p-4 shadow-2xl text-xs"
          >
            <h4 className="text-sm font-bold text-white mb-2">
              Set Exact Master {exactValueModal === "volume" ? "Volume (%)" : "Pan (-100 s.d. +100)"}
            </h4>
            <input
              type="number"
              value={exactInputVal}
              onChange={(e) => setExactInputVal(e.target.value)}
              className="w-full rounded-lg bg-black px-3 py-2 text-sm text-white border border-white/20 outline-none mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setExactValueModal(null)}
                className="rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-white/10"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(exactInputVal);
                  if (!isNaN(val)) {
                    if (exactValueModal === "volume") {
                      onUpdateMasterTrack({ volume: Math.max(0, Math.min(2.0, val / 100)) });
                    } else {
                      onUpdateMasterTrack({ pan: Math.max(-1.0, Math.min(1.0, val / 100)) });
                    }
                  }
                  setExactValueModal(null);
                }}
                className="rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-black hover:bg-amber-400"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
