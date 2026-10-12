"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Square,
  Sparkles,
  Plus,
  Trash2,
  Volume2,
  Sliders,
  Save,
  Check,
  FolderOpen,
  Flame,
} from "lucide-react";
import type { DrumSoundType } from "@/lib/studio/synth";
import {
  type StepPattern,
  type DrumLane,
  createDefaultPattern,
  STEP_PATTERN_PRESETS,
  convertPatternToStudioClip,
} from "@/lib/studio/step-sequencer";
import {
  saveStepPattern,
  listStepPatterns,
  deleteStepPattern,
} from "@/lib/studio/storage";
import type { StudioAudioEngine } from "@/lib/studio/audio-engine";

interface StepSequencerProps {
  engine: StudioAudioEngine;
  currentBeat: number;
  isPlaying: boolean;
  selectedTrackId?: string;
  onClose: () => void;
  onInsertClipToTimeline: (clip: ReturnType<typeof convertPatternToStudioClip>) => void;
}

export function StepSequencer({
  engine,
  currentBeat,
  isPlaying,
  selectedTrackId,
  onClose,
  onInsertClipToTimeline,
}: StepSequencerProps) {
  const [pattern, setPattern] = useState<StepPattern>(() => STEP_PATTERN_PRESETS[0] || createDefaultPattern(16));
  const [selectedPresetId, setSelectedPresetId] = useState<string>("preset.boombap");
  const [userPatterns, setUserPatterns] = useState<StepPattern[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [patternNameInput, setPatternNameInput] = useState("");
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [activeTool, setActiveTool] = useState<"step" | "flam">("step");
  const [velocityPreset, setVelocityPreset] = useState<number>(100);

  // Load saved user patterns on mount
  useEffect(() => {
    listStepPatterns()
      .then(setUserPatterns)
      .catch((err) => console.error("Gagal memuat pola tersimpan:", err));
  }, []);

  // Current playing 16th step index (0-15) based on currentBeat
  const activeStepIndex = isPlaying ? Math.floor((currentBeat % 4) * 4) : -1;

  const handleToggleFlam = (laneIndex: number, stepIndex: number) => {
    let willBeFlam = false;
    let targetVelocity = 100;
    setPattern((prev) => {
      const newLanes = prev.lanes.map((lane, lIdx) => {
        if (lIdx !== laneIndex) return lane;
        const newSteps = lane.steps.map((step, sIdx) => {
          if (sIdx !== stepIndex) return step;
          willBeFlam = !step.flam;
          targetVelocity = step.velocity || velocityPreset;
          return {
            ...step,
            active: true, // Flam requires an active hit
            flam: willBeFlam,
            velocity: targetVelocity,
          };
        });
        return { ...lane, steps: newSteps };
      });
      return { ...prev, lanes: newLanes };
    });

    const lane = pattern.lanes[laneIndex];
    if (lane) {
      void engine.playDrumSound(lane.sound, targetVelocity, willBeFlam);
    }
  };

  const handleStepClick = (laneIndex: number, stepIndex: number) => {
    if (activeTool === "flam") {
      handleToggleFlam(laneIndex, stepIndex);
      return;
    }

    const currentStep = pattern.lanes[laneIndex]?.steps[stepIndex];
    if (!currentStep) return;

    if (!currentStep.active) {
      setPattern((prev) => {
        const newLanes = prev.lanes.map((lane, lIdx) => {
          if (lIdx !== laneIndex) return lane;
          const newSteps = lane.steps.map((step, sIdx) => {
            if (sIdx !== stepIndex) return step;
            return {
              ...step,
              active: true,
              velocity: velocityPreset,
              flam: false,
            };
          });
          return { ...lane, steps: newSteps };
        });
        return { ...prev, lanes: newLanes };
      });

      const lane = pattern.lanes[laneIndex];
      if (lane) {
        void engine.playDrumSound(lane.sound, velocityPreset, false);
      }
    } else {
      if (currentStep.velocity !== velocityPreset) {
        setPattern((prev) => {
          const newLanes = prev.lanes.map((lane, lIdx) => {
            if (lIdx !== laneIndex) return lane;
            const newSteps = lane.steps.map((step, sIdx) => {
              if (sIdx !== stepIndex) return step;
              return {
                ...step,
                velocity: velocityPreset,
              };
            });
            return { ...lane, steps: newSteps };
          });
          return { ...prev, lanes: newLanes };
        });

        const lane = pattern.lanes[laneIndex];
        if (lane) {
          void engine.playDrumSound(lane.sound, velocityPreset, !!currentStep.flam);
        }
      } else {
        setPattern((prev) => {
          const newLanes = prev.lanes.map((lane, lIdx) => {
            if (lIdx !== laneIndex) return lane;
            const newSteps = lane.steps.map((step, sIdx) => {
              if (sIdx !== stepIndex) return step;
              return {
                ...step,
                active: false,
                flam: false,
              };
            });
            return { ...lane, steps: newSteps };
          });
          return { ...prev, lanes: newLanes };
        });
      }
    }
  };

  const handleAuditionLane = (sound: DrumSoundType) => {
    void engine.playDrumSound(sound, 115);
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    // Check factory presets
    const foundFactory = STEP_PATTERN_PRESETS.find((p) => p.id === presetId);
    if (foundFactory) {
      setPattern(JSON.parse(JSON.stringify(foundFactory)));
      return;
    }
    // Check user patterns
    const foundUser = userPatterns.find((p) => p.id === presetId);
    if (foundUser) {
      setPattern(JSON.parse(JSON.stringify(foundUser)));
    }
  };

  const handleSavePatternSubmit = async () => {
    const name = patternNameInput.trim() || pattern.name || "Pola Beat Custom";
    const newPat: StepPattern = {
      ...pattern,
      id: `user_pat_${Date.now()}`,
      name,
    };
    try {
      await saveStepPattern(newPat);
      const updatedList = await listStepPatterns();
      setUserPatterns(updatedList);
      setSelectedPresetId(newPat.id);
      setPattern(newPat);
      setIsSaving(false);
      setPatternNameInput("");
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    } catch (err) {
      console.error("Gagal menyimpan pola:", err);
    }
  };

  const handleDeleteUserPattern = async (id: string) => {
    try {
      await deleteStepPattern(id);
      const updatedList = await listStepPatterns();
      setUserPatterns(updatedList);
      if (selectedPresetId === id) {
        setSelectedPresetId(STEP_PATTERN_PRESETS[0]?.id || "");
        setPattern(JSON.parse(JSON.stringify(STEP_PATTERN_PRESETS[0] || createDefaultPattern(16))));
      }
    } catch (err) {
      console.error("Gagal menghapus pola:", err);
    }
  };

  const handleClear = () => {
    setPattern((prev) => ({
      ...prev,
      lanes: prev.lanes.map((lane) => ({
        ...lane,
        steps: lane.steps.map((s) => ({ ...s, active: false })),
      })),
    }));
  };

  const handleInsert = () => {
    const targetTrack = selectedTrackId || "track_drums";
    const clip = convertPatternToStudioClip(pattern, targetTrack, 0);
    onInsertClipToTimeline(clip);
  };

  return (
    <div className="flex h-96 flex-col border-t-2 border-amber-500/50 bg-charcoal/95 select-none shadow-2xl z-30 font-sans">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="font-bold text-white tracking-wide">
              Step Sequencer & Beat Machine
            </span>
          </div>

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 ml-4 text-[11px] text-zinc-400">
            <Sparkles className="size-3 text-amber-400" />
            <span>Preset:</span>
            <select
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white outline-none hover:border-amber-500/40 focus:border-amber-500"
            >
              <optgroup label="Preset Bawaan Studio">
                {STEP_PATTERN_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              {userPatterns.length > 0 && (
                <optgroup label="Pola Buatan Anda (Saved)">
                  {userPatterns.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Delete User Pattern Button if active */}
          {userPatterns.some((p) => p.id === selectedPresetId) && (
            <button
              onClick={() => handleDeleteUserPattern(selectedPresetId)}
              title="Hapus pola tersimpan ini dari IndexedDB"
              className="rounded p-1 text-rose-400 hover:bg-rose-500/20 transition"
            >
              <Trash2 className="size-3" />
            </button>
          )}

          {/* Swing Control */}
          <div className="flex items-center gap-1.5 ml-3 text-[11px] text-zinc-400">
            <Sliders className="size-3 text-zinc-400" />
            <span>Swing:</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={pattern.swing}
              onChange={(e) => setPattern({ ...pattern, swing: parseFloat(e.target.value) })}
              className="w-16 accent-amber-500 cursor-pointer"
            />
            <span className="font-mono text-zinc-300 w-8">{Math.round(pattern.swing * 100)}%</span>
          </div>

          {/* Tool Mode: Step vs Flam (Mixcraft 10 Hlm. 318) */}
          <div className="flex items-center gap-1 ml-3 border-l border-white/10 pl-3">
            <button
              onClick={() => setActiveTool("step")}
              title="Mode Step Standar (Klik untuk hidup/mati ketukan)"
              className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
                activeTool === "step"
                  ? "bg-amber-500 text-black font-bold shadow-xs"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              Step
            </button>
            <button
              onClick={() => setActiveTool("flam")}
              title="Mode Flam: Gandakan pukulan drum dengan grace note berkecepatan tinggi (Mixcraft 10 Hlm. 318)"
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition ${
                activeTool === "flam"
                  ? "bg-gradient-to-r from-red-500 to-amber-500 text-white font-bold shadow-xs"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              <Flame className="size-3 text-red-400" />
              <span>Flam</span>
            </button>
          </div>

          {/* Velocity Accent Selector (Mixcraft 10 Hlm. 319-320) */}
          <div className="flex items-center gap-1 ml-2 text-[11px] text-zinc-400">
            <span>Vel:</span>
            <div className="flex rounded-lg border border-white/10 bg-black/60 p-0.5">
              <button
                onClick={() => setVelocityPreset(127)}
                title="Aksen Keras (Velocity 127)"
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                  velocityPreset === 127
                    ? "bg-amber-400 text-black shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Aksen (127)
              </button>
              <button
                onClick={() => setVelocityPreset(100)}
                title="Normal (Velocity 100)"
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                  velocityPreset === 100
                    ? "bg-zinc-700 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                100
              </button>
              <button
                onClick={() => setVelocityPreset(60)}
                title="Ghost Note / Lembut (Velocity 60)"
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                  velocityPreset === 60
                    ? "bg-zinc-700 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Ghost (60)
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Pattern Dialog Button */}
          {isSaving ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-zinc-900 px-2 py-0.5">
              <input
                type="text"
                placeholder="Nama Pola..."
                value={patternNameInput}
                onChange={(e) => setPatternNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSavePatternSubmit();
                  if (e.key === "Escape") setIsSaving(false);
                }}
                className="w-28 bg-transparent text-xs text-white outline-none"
                autoFocus
              />
              <button
                onClick={handleSavePatternSubmit}
                className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black hover:bg-amber-400"
              >
                Simpan
              </button>
              <button
                onClick={() => setIsSaving(false)}
                className="rounded text-[10px] text-zinc-400 hover:text-white"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPatternNameInput(pattern.name);
                setIsSaving(true);
              }}
              title="Simpan pola ini ke IndexedDB lokal"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
            >
              {saveSuccessNotice ? (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="size-3 text-amber-400" />
                  <span>Simpan Pola</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleClear}
            title="Bersihkan semua pola step"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="size-3" />
            <span>Clear</span>
          </button>

          <button
            onClick={handleInsert}
            title="Masukkan pola beat ini sebagai klip MIDI di Timeline"
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-sm"
          >
            <Plus className="size-3.5" />
            <span>+ Masukkan ke Timeline</span>
          </button>

          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white ml-2"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Step Grid Container */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3 gap-2">
        {/* Ruler Step Numbers */}
        <div className="flex items-center">
          <div className="w-36 shrink-0 text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
            Sound / Pad
          </div>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: pattern.stepsCount }).map((_, stepIdx) => {
              const isBarBeat = stepIdx % 4 === 0;
              const isCurrent = stepIdx === activeStepIndex;
              return (
                <div
                  key={stepIdx}
                  className={`flex-1 text-center font-mono text-[10px] py-0.5 rounded ${
                    isCurrent
                      ? "bg-amber-500/30 text-amber-300 font-bold"
                      : isBarBeat
                      ? "text-zinc-300 font-bold"
                      : "text-zinc-600"
                  }`}
                >
                  {stepIdx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lanes List */}
        {pattern.lanes.map((lane, laneIdx) => (
          <div
            key={lane.id}
            className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/40 p-1.5 hover:border-white/10 transition"
          >
            {/* Pad Preview & Name */}
            <div className="flex w-36 shrink-0 items-center justify-between pr-2">
              <span className="text-xs font-semibold text-zinc-200 truncate pl-1">
                {lane.name}
              </span>
              <button
                onClick={() => handleAuditionLane(lane.sound)}
                title={`Audisi suara ${lane.name}`}
                className="rounded-lg border border-white/10 bg-white/5 p-1 text-zinc-400 hover:bg-amber-500/20 hover:text-amber-300 transition"
              >
                <Volume2 className="size-3" />
              </button>
            </div>

            {/* Steps Buttons Grid */}
            <div className="flex flex-1 gap-1.5">
              {lane.steps.map((step, stepIdx) => {
                const isBarBeat = Math.floor(stepIdx / 4) % 2 === 0;
                const isCurrent = stepIdx === activeStepIndex;
                const active = step.active;
                const isFlam = !!step.flam;
                const isAccent = (step.velocity || 100) >= 120;
                const isGhost = (step.velocity || 100) <= 65;

                return (
                  <button
                    key={stepIdx}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        handleToggleFlam(laneIdx, stepIdx);
                      } else {
                        handleStepClick(laneIdx, stepIdx);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleToggleFlam(laneIdx, stepIdx);
                    }}
                    title={`Step ${stepIdx + 1} | Vel: ${step.velocity || 100}${
                      isFlam ? " 🔥 FLAM" : ""
                    } (Klik Kanan atau Shift+Klik untuk Flam)`}
                    className={`flex-1 h-9 rounded-lg border transition flex items-center justify-center relative select-none cursor-pointer ${
                      active
                        ? isAccent
                          ? "border-amber-300 bg-gradient-to-t from-amber-500 to-amber-400 text-black font-black shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                          : isGhost
                          ? "border-amber-600/40 bg-amber-800/50 text-zinc-300 shadow-xs"
                          : "border-amber-400 bg-gradient-to-t from-amber-600 to-amber-500 text-black font-black shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                        : isBarBeat
                        ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                        : "border-white/5 bg-black/60 hover:bg-white/[0.05]"
                    } ${isCurrent ? "ring-2 ring-amber-300 z-10" : ""}`}
                  >
                    {active ? (
                      isFlam ? (
                        <div className="flex items-center gap-0.5">
                          <Flame className="size-3 text-red-950 fill-red-900 animate-pulse" />
                          <span className="text-[8px] font-black tracking-tighter text-black">FLAM</span>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full ${
                            isAccent
                              ? "size-2.5 bg-black ring-1 ring-amber-200"
                              : isGhost
                              ? "size-1.5 bg-black/60"
                              : "size-2 bg-black/40"
                          }`}
                        />
                      )
                    ) : isBarBeat ? (
                      <span className="size-1 rounded-full bg-white/20" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
