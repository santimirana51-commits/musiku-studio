"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Sliders, Music, Mic2, Video, Type, FolderTree, Sparkles, ChevronDown, Disc, Activity, Check, Layers, Shield, AlertTriangle, Radio } from "lucide-react";
import type {
  StudioProject,
  StudioTrack,
  StudioClip,
  SubgroupBus,
  MidiNote,
  TransportState,
  AudioDeviceOption,
  TrackType,
  AudioAssetMeta,
  MasterTrack,
  AudioDriverType,
} from "@/lib/studio/types";
import { createEmptyProject, createTrack } from "@/lib/studio/schema";
import { StudioAudioEngine } from "@/lib/studio/audio-engine";
import {
  saveProject,
  saveAudioBlob,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  type AutosaveRecord,
} from "@/lib/studio/storage";
import { renderSingleTrackToWav } from "@/lib/studio/export";
import {
  type MidiMapping,
  type MidiMessageEvent,
  type MidiCommandCategory,
  loadMidiMappingsFromStorage,
  saveMidiMappingsToStorage,
  findMatchingMidiMapping,
  createOrUpdateMapping,
  isToggleTrigger,
  scaleCcToVolume,
  scaleCcToPan,
} from "@/lib/studio/midi-learn";
import { webMidiManager } from "@/lib/studio/web-midi";
import { TransportBar } from "@/components/studio/transport-bar";
import { TrackHeader } from "@/components/studio/track-header";
import { MasterTrackHeader } from "@/components/studio/master-track-header";
import { PerformancePanel } from "@/components/studio/performance-panel";
import {
  getTrackPerformanceClip,
  recordPerformanceClipToTimeline,
} from "@/lib/studio/performance-panel";
import { Timeline } from "@/components/studio/timeline";
import { PianoRoll } from "@/components/studio/piano-roll";
import { StepSequencer } from "@/components/studio/step-sequencer";
import { Mixer } from "@/components/studio/mixer";
import { KaraokeDock } from "@/components/studio/karaoke-dock";
import { PluginDialog } from "@/components/studio/plugin-dialog";
import { ExportDialog } from "@/components/studio/export-dialog";
import { ProjectDialog } from "@/components/studio/project-dialog";
import { VideoWindow } from "@/components/studio/video-window";
import { MidiLearnDialog } from "@/components/studio/midi-learn-dialog";
import { StemSeparationDialog } from "@/components/studio/stem-separation-dialog";
import {
  separateAudioBufferIntoStems,
  createStemSeparationTracks,
  saveSeparatedStemsToStorage,
  type StemSeparationOptions,
} from "@/lib/studio/stem-separation";
import {
  mergeSelectedClipsInProject,
  removeSpacesInProject,
  duplicateAndMergeClip,
} from "@/lib/studio/clip-operations";
import { useToast } from "@/components/toast";

export default function StudioPage() {
  const { toast } = useToast();

  // Engine ref singleton
  const engineRef = useRef<StudioAudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new StudioAudioEngine();
  }
  const engine = engineRef.current;

  // Project state & Undo/Redo history
  const [project, setProject] = useState<StudioProject>(() => createEmptyProject("Proyek Baru MusikKu"));
  const [history, setHistory] = useState<StudioProject[]>([project]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Transport & Audio Engine State
  const [transport, setTransport] = useState<TransportState>({
    playing: false,
    recording: false,
    currentBeat: 0,
    currentTimeSeconds: 0,
    tempo: 120,
    timeSignature: [4, 4],
    loop: { enabled: true, startBeat: 0, endBeat: 8 },
    metronome: false,
  });

  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const [busLevels, setBusLevels] = useState<Record<string, number>>({});
  const [masterLevel, setMasterLevel] = useState<number>(0);
  const [inputLevel, setInputLevel] = useState<number>(0);

  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Selection state (Supports single, [CTRL]+click multi-select, and [SHIFT]+click range select)
  const [selectedTrackId, setSelectedTrackId] = useState<string>(project.tracks[0]?.id || "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([project.tracks[0]?.id || ""]);
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>(project.tracks[0]?.clips[0]?.id);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>(
    project.tracks[0]?.clips[0]?.id ? [project.tracks[0].clips[0].id] : []
  );

  // Dialog & Panels State
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isStepSequencerOpen, setIsStepSequencerOpen] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [pianoRollTarget, setPianoRollTarget] = useState<{ clip: StudioClip; track: StudioTrack } | null>(null);
  const [pluginDialogTrackId, setPluginDialogTrackId] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isVideoWindowOpen, setIsVideoWindowOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [menuPersist, setMenuPersist] = useState(false);
  const [showEffectsOnTracks, setShowEffectsOnTracks] = useState(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [showMasterTrack, setShowMasterTrack] = useState(false);
  const [addMenuCoords, setAddMenuCoords] = useState<{ x: number; y: number } | null>(null);
  const [expandedAutomationTrackIds, setExpandedAutomationTrackIds] = useState<Set<string>>(new Set());

  const handleToggleAutomationLane = useCallback((trackId: string) => {
    setExpandedAutomationTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const [audioDriver, setAudioDriver] = useState<AudioDriverType>("wavert");
  const [metronomeRecording, setMetronomeRecording] = useState(true);
  const [metronomePlayback, setMetronomePlayback] = useState(false);
  const [countInMeasures, setCountInMeasures] = useState(1);

  const [isMidiLearnActive, setIsMidiLearnActive] = useState(false);
  const [isMidiLearnDialogOpen, setIsMidiLearnDialogOpen] = useState(false);

  // Mixcraft 10 Stem Separation Dialog State (Hlm. 650–652)
  const [stemSeparationTarget, setStemSeparationTarget] = useState<{
    trackId: string;
    clip: StudioClip;
  } | null>(null);
  const [isStemSeparationProcessing, setIsStemSeparationProcessing] = useState(false);
  const [stemSeparationProgress, setStemSeparationProgress] = useState(0);
  const [stemSeparationStatus, setStemSeparationStatus] = useState("");
  const [midiMappings, setMidiMappings] = useState<MidiMapping[]>(() => loadMidiMappingsFromStorage());
  const [midiLearningTarget, setMidiLearningTarget] = useState<{
    command: string;
    label: string;
    category: MidiCommandCategory;
    trackId?: string;
    parameter?: any;
  } | null>(null);

  const midiMappingsRef = useRef(midiMappings);
  useEffect(() => {
    midiMappingsRef.current = midiMappings;
  }, [midiMappings]);

  const isMidiLearnActiveRef = useRef(isMidiLearnActive);
  useEffect(() => {
    isMidiLearnActiveRef.current = isMidiLearnActive;
  }, [isMidiLearnActive]);

  const midiLearningTargetRef = useRef(midiLearningTarget);
  useEffect(() => {
    midiLearningTargetRef.current = midiLearningTarget;
  }, [midiLearningTarget]);

  const selectedTrackIdRef = useRef(selectedTrackId);
  useEffect(() => {
    selectedTrackIdRef.current = selectedTrackId;
  }, [selectedTrackId]);

  // --- LANES MANAGEMENT HANDLERS (Mixcraft 10) ---
  const handleAddLane = useCallback((targetTrackId: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === targetTrackId) {
            const count = t.laneCount || 1;
            return { ...t, laneCount: count + 1 };
          }
          return t;
        }),
      };
      engine.setProject(next);
      return next;
    });
    toast(`Lane baru ditambahkan ke track!`, "success");
  }, [engine, toast]);

  const handleDeleteBottomLane = useCallback((targetTrackId: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === targetTrackId) {
            const count = Math.max(1, (t.laneCount || 1) - 1);
            return { ...t, laneCount: count };
          }
          return t;
        }),
      };
      engine.setProject(next);
      return next;
    });
    toast(`Lane terbawah dihapus!`, "info");
  }, [engine, toast]);

  const handleDeleteEmptyLanes = useCallback((targetTrackId: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === targetTrackId) {
            const maxUsed = t.clips.reduce((max, c) => Math.max(max, c.laneIndex ?? 0), -1);
            const needed = Math.max(1, maxUsed + 1);
            return { ...t, laneCount: needed };
          }
          return t;
        }),
      };
      engine.setProject(next);
      return next;
    });
    toast(`Lane kosong dihapus!`, "info");
  }, [engine, toast]);

  const handleMuteLane = useCallback((targetTrackId: string, laneIndex: number) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === targetTrackId) {
            const mutedLanes = new Set(t.mutedLaneIndices || []);
            mutedLanes.add(laneIndex);
            const updatedClips = t.clips.map((c) =>
              (c.laneIndex ?? 0) === laneIndex ? { ...c, muted: true } : c
            );
            return {
              ...t,
              mutedLaneIndices: Array.from(mutedLanes),
              clips: updatedClips,
            };
          }
          return t;
        }),
      };
      engine.setProject(next);
      return next;
    });
    toast(`Semua klip pada Lane ${laneIndex + 1} di-mute!`, "info");
  }, [engine, toast]);

  const handleUnmuteLane = useCallback((targetTrackId: string, laneIndex: number) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === targetTrackId) {
            const mutedLanes = (t.mutedLaneIndices || []).filter((idx) => idx !== laneIndex);
            const updatedClips = t.clips.map((c) =>
              (c.laneIndex ?? 0) === laneIndex ? { ...c, muted: false } : c
            );
            return {
              ...t,
              mutedLaneIndices: mutedLanes,
              clips: updatedClips,
            };
          }
          return t;
        }),
      };
      engine.setProject(next);
      return next;
    });
    toast(`Semua klip pada Lane ${laneIndex + 1} di-unmute!`, "success");
  }, [engine, toast]);

  const handleMuteAllLanes = useCallback(
    (targetTrackId: string) => {
      setProject((prev) => {
        const next = {
          ...prev,
          tracks: prev.tracks.map((t) => {
            if (t.id === targetTrackId) {
              const count = t.laneCount || 1;
              const allIndices = Array.from({ length: count }, (_, i) => i);
              const updatedClips = t.clips.map((c) => ({ ...c, muted: true }));
              return {
                ...t,
                mutedLaneIndices: allIndices,
                clips: updatedClips,
              };
            }
            return t;
          }),
        };
        engine.setProject(next);
        return next;
      });
      toast("Semua lanes pada track di-mute!", "info");
    },
    [engine, toast]
  );

  const handleUnmuteAllLanes = useCallback(
    (targetTrackId: string) => {
      setProject((prev) => {
        const next = {
          ...prev,
          tracks: prev.tracks.map((t) => {
            if (t.id === targetTrackId) {
              const updatedClips = t.clips.map((c) => ({ ...c, muted: false }));
              return {
                ...t,
                mutedLaneIndices: [],
                clips: updatedClips,
              };
            }
            return t;
          }),
        };
        engine.setProject(next);
        return next;
      });
      toast("Semua lanes pada track di-unmute!", "success");
    },
    [engine, toast]
  );

  // Devices
  const [inputDevices, setInputDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Update project helper with history push
  const pushProjectState = useCallback((newProject: StudioProject) => {
    setProject(newProject);
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIdx + 1);
      return [...sliced, newProject];
    });
    setHistoryIdx((prev) => prev + 1);
    engine.setProject(newProject);
  }, [engine, historyIdx]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setProject(prev);
      engine.setProject(prev);
    }
  }, [engine, history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setProject(next);
      engine.setProject(next);
    }
  }, [engine, history, historyIdx]);

  // Disaster Recovery Autosave State (Mixcraft 10 Hlm. 686-687)
  const [autosaveRecovery, setAutosaveRecovery] = useState<AutosaveRecord | null>(null);

  // Check for disaster recovery autosave snapshot on mount
  useEffect(() => {
    let mounted = true;
    loadAutosave()
      .then((backup) => {
        if (mounted && backup && backup.project) {
          const hasClips = backup.project.tracks.some((t) => t.clips.length > 0);
          const isDifferentFromDefault =
            backup.project.name !== "Proyek Baru MusikKu" ||
            hasClips ||
            backup.project.tracks.length !== 4;
          if (isDifferentFromDefault) {
            setAutosaveRecovery(backup);
          }
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Periodic autosave debounced by 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAutosave(project).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [project]);

  const handleRestoreAutosave = useCallback(() => {
    if (!autosaveRecovery) return;
    pushProjectState(autosaveRecovery.project);
    setSelectedTrackId(autosaveRecovery.project.tracks[0]?.id || "");
    setSelectedClipId(autosaveRecovery.project.tracks[0]?.clips[0]?.id);
    setSelectedClipIds(
      autosaveRecovery.project.tracks[0]?.clips[0]?.id
        ? [autosaveRecovery.project.tracks[0].clips[0].id]
        : []
    );
    toast(
      `Proyek "${autosaveRecovery.project.name}" berhasil dipulihkan dari autosave! (Mixcraft 10 Hlm. 686)`,
      "success"
    );
    setAutosaveRecovery(null);
  }, [autosaveRecovery, pushProjectState, toast]);

  const handleDismissAutosave = useCallback(async () => {
    await clearAutosave().catch(() => {});
    setAutosaveRecovery(null);
    toast("Sesi autosave sebelumnya dibatalkan.", "info");
  }, [toast]);

  // Setup engine listeners & devices on mount
  useEffect(() => {
    engine.setProject(project);

    const unsubState = engine.onState((st) => setTransport(st));
    const unsubPlayhead = engine.onPlayhead((beat, sec) => {
      setTransport((prev) => ({ ...prev, currentBeat: beat, currentTimeSeconds: sec }));
    });

    const unsubRec = engine.onRecordFinalized((trackId, clip) => {
      setProject((prev) => {
        const targetTrack = prev.tracks.find((t) => t.id === trackId);
        if (!targetTrack) return prev;
        const recMode = targetTrack.recordingMode || "takes";

        let updatedClips = [...targetTrack.clips];
        if (recMode === "replace") {
          // In Replace mode: existing audio in the recording range is replaced, no new lanes created
          const recStart = clip.startBeat;
          const recEnd = clip.startBeat + clip.durationBeats;
          updatedClips = updatedClips.filter((c) => {
            const cStart = c.startBeat;
            const cEnd = c.startBeat + c.durationBeats;
            return !(cStart >= recStart && cEnd <= recEnd);
          });
          updatedClips.push(clip);
        } else if (recMode === "takes") {
          // In Takes mode: clips of previous passes are automatically muted as new takes arrive!
          updatedClips = updatedClips.map((c) => ({ ...c, muted: true }));
          updatedClips.push(clip);
        } else {
          // In Overdub mode: all previous clips remain audible during and after recording
          updatedClips.push(clip);
        }

        const maxLane = updatedClips.reduce((m, c) => Math.max(m, c.laneIndex ?? 0), 0);
        const nextLaneCount = Math.max(targetTrack.laneCount || 1, maxLane + 1);

        const next = {
          ...prev,
          tracks: prev.tracks.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  laneCount: nextLaneCount,
                  clips: updatedClips,
                }
              : t
          ),
        };
        engine.setProject(next);
        return next;
      });
      toast(`Take rekaman ditambahkan ke track!`, "success");
    });

    // Enumerate devices
    engine.getAudioInputDevices().then(setInputDevices);

    // Deteksi lirik masuk dari modul Karaoke MusikKu
    if (typeof window !== "undefined") {
      const incomingRaw = sessionStorage.getItem("musikku_studio_incoming_lyrics");
      if (incomingRaw) {
        try {
          const inc = JSON.parse(incomingRaw);
          if (inc && Array.isArray(inc.lines) && inc.lines.length > 0) {
            setProject((prev) => {
              const updated: StudioProject = {
                ...prev,
                name: prev.name === "Proyek Baru MusikKu" && inc.title ? inc.title : prev.name,
                lyrics: {
                  title: inc.title,
                  artist: inc.artist,
                  lrcRaw: inc.lrcRaw,
                  offsetSec: (inc.offsetMs || 0) / 1000,
                  lines: inc.lines,
                },
              };
              engine.setProject(updated);
              return updated;
            });
            setIsLyricsOpen(true);
            toast(`Lirik "${inc.title}" berhasil dimuat dari Karaoke!`, "success");
          }
        } catch {
          // Abaikan parsing error jika storage tidak valid
        }
        sessionStorage.removeItem("musikku_studio_incoming_lyrics");
      }
    }

    // VU Meters animation loop
    let animId: number;
    const meterLoop = () => {
      if (engine) {
        setMasterLevel(engine.getMasterLevel());
        setInputLevel(engine.getInputLevel());
        const curProject = projectRef.current;
        const levels: Record<string, number> = {};
        for (const t of curProject.tracks) {
          levels[t.id] = engine.getTrackLevel(t.id);
        }
        setTrackLevels(levels);

        const bLevels: Record<string, number> = {};
        for (const b of curProject.buses || []) {
          bLevels[b.id] = engine.getBusLevel(b.id);
        }
        setBusLevels(bLevels);
      }
      animId = requestAnimationFrame(meterLoop);
    };
    animId = requestAnimationFrame(meterLoop);

    return () => {
      unsubState();
      unsubPlayhead();
      unsubRec();
      cancelAnimationFrame(animId);
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload audio buffers untuk aset dalam manifes saat proyek dimuat
  useEffect(() => {
    for (const assetId of Object.keys(project.assetManifest)) {
      void engine.loadAssetFromStorage(assetId);
    }
  }, [project.assetManifest, engine]);

  // Track operations
  const handleAddTrack = (type: TrackType, insertAbove = false) => {
    if (type === "video" && project.tracks.some((t) => t.type === "video")) {
      toast("Proyek hanya dapat memiliki satu Video track.", "error");
      return;
    }
    const currentTracks = [...project.tracks];
    const insertIdx =
      insertAbove && selectedTrackId
        ? Math.max(0, currentTracks.findIndex((t) => t.id === selectedTrackId))
        : currentTracks.length;

    const newTrack = createTrack(type, undefined, currentTracks.length);
    if (insertAbove && insertIdx >= 0) {
      currentTracks.splice(insertIdx, 0, newTrack);
    } else {
      currentTracks.push(newTrack);
    }

    const updated: StudioProject = {
      ...project,
      tracks: currentTracks,
    };
    pushProjectState(updated);
    setSelectedTrackId(newTrack.id);
    setSelectedTrackIds([newTrack.id]);
    engine.rebuildAudioGraph();
    toast(
      insertAbove
        ? `Track ${newTrack.name} disisipkan di atas track terpilih`
        : `Track ${newTrack.name} baru ditambahkan`,
      "success"
    );
  };

  const handleSelectTrack = useCallback((trackId: string, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedTrackIds((prev) => {
        const next = prev.includes(trackId)
          ? prev.filter((id) => id !== trackId)
          : [...prev, trackId];
        return next.length > 0 ? next : [trackId];
      });
      setSelectedTrackId(trackId);
    } else if (e?.shiftKey) {
      const allIds = projectRef.current.tracks.map((t) => t.id);
      const lastIdx = allIds.indexOf(selectedTrackId);
      const currIdx = allIds.indexOf(trackId);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        setSelectedTrackIds(allIds.slice(start, end + 1));
      } else {
        setSelectedTrackIds([trackId]);
      }
      setSelectedTrackId(trackId);
    } else {
      setSelectedTrackIds([trackId]);
      setSelectedTrackId(trackId);
    }
  }, [selectedTrackId]);

  const handleUpdateTrackRelative = useCallback(
    (anchorTrackId: string, field: "volume" | "pan", delta: number) => {
      const current = projectRef.current;
      const anchorTrack = current.tracks.find((t) => t.id === anchorTrackId);
      if (!anchorTrack) return;

      const affectedIds = new Set<string>();
      if (anchorTrack.linkGroupId) {
        current.tracks
          .filter((t) => t.linkGroupId === anchorTrack.linkGroupId)
          .forEach((t) => affectedIds.add(t.id));
      }
      if (selectedTrackIds.includes(anchorTrackId)) {
        selectedTrackIds.forEach((id) => affectedIds.add(id));
      }
      if (affectedIds.size === 0) affectedIds.add(anchorTrackId);

      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.map((t) => {
          if (!affectedIds.has(t.id)) return t;
          if (field === "volume") {
            const nextVol = Math.max(0, Math.min(2.0, Math.round((t.volume + delta) * 1000) / 1000));
            return { ...t, volume: nextVol };
          } else {
            const nextPan = Math.max(-1.0, Math.min(1.0, Math.round((t.pan + delta) * 100) / 100));
            return { ...t, pan: nextPan };
          }
        }),
      };

      pushProjectState(updated);
      updated.tracks.forEach((t) => {
        if (affectedIds.has(t.id)) {
          if (field === "volume") engine.updateTrackParameter(t.id, "volume", t.volume);
          if (field === "pan") engine.updateTrackParameter(t.id, "pan", t.pan);
        }
      });
    },
    [selectedTrackIds, pushProjectState, engine]
  );

  const handleUpdateTrack = useCallback(
    (trackId: string, updates: Partial<StudioTrack>) => {
      const current = projectRef.current;
      const target = current.tracks.find((t) => t.id === trackId);
      const isMulti = selectedTrackIds.includes(trackId) && selectedTrackIds.length > 1;
      const isLinked = !!target?.linkGroupId;

      const isGangable =
        "mute" in updates || "solo" in updates || "armRecord" in updates || "height" in updates;
      const affectedIds = new Set<string>();
      if (isGangable && (isMulti || isLinked)) {
        if (isLinked) {
          current.tracks
            .filter((t) => t.linkGroupId === target?.linkGroupId)
            .forEach((t) => affectedIds.add(t.id));
        }
        if (isMulti) {
          selectedTrackIds.forEach((id) => affectedIds.add(id));
        }
      } else {
        affectedIds.add(trackId);
      }

      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.map((t) => (affectedIds.has(t.id) ? { ...t, ...updates } : t)),
      };
      pushProjectState(updated);

      affectedIds.forEach((id) => {
        if ("volume" in updates && typeof updates.volume === "number") {
          engine.updateTrackParameter(id, "volume", updates.volume);
        }
        if ("pan" in updates && typeof updates.pan === "number") {
          engine.updateTrackParameter(id, "pan", updates.pan);
        }
        if ("mute" in updates) {
          engine.updateTrackParameter(id, "mute", !!updates.mute);
        }
        if ("solo" in updates) {
          engine.updateTrackParameter(id, "solo", !!updates.solo);
        }
        if ("channelStrip" in updates && updates.channelStrip) {
          engine.updateChannelStrip(id, updates.channelStrip);
        }
      });
      if ("outputBus" in updates) {
        engine.rebuildAudioGraph();
      }
    },
    [selectedTrackIds, pushProjectState, engine]
  );

  const handleUpdateBus = useCallback(
    (busId: string, updates: Partial<SubgroupBus>) => {
      const updatedBuses = (project.buses || []).map((b) =>
        b.id === busId ? { ...b, ...updates } : b
      );
      const updated: StudioProject = {
        ...project,
        buses: updatedBuses,
      };
      pushProjectState(updated);
      engine.updateBusParameter(busId, updates);
    },
    [project, pushProjectState, engine]
  );

  const handleAddBus = useCallback(() => {
    const busColors = ["#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f97316", "#eab308"];
    const idx = project.buses?.length || 0;
    const color = busColors[idx % busColors.length];
    const newBus: SubgroupBus = {
      id: `bus_${Date.now()}`,
      name: `Bus ${idx + 1}`,
      color,
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      plugins: [],
    };
    const updated: StudioProject = {
      ...project,
      buses: [...(project.buses || []), newBus],
    };
    pushProjectState(updated);
    engine.rebuildAudioGraph();
    toast(`Subgroup Bus "${newBus.name}" berhasil ditambahkan!`, "success");
  }, [project, pushProjectState, engine, toast]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    const current = projectRef.current;
    if (current.tracks.length <= 1) {
      toast("Proyek harus memiliki minimal satu track.", "error");
      return;
    }
    const updated: StudioProject = {
      ...current,
      tracks: current.tracks.filter((t) => t.id !== trackId),
    };
    pushProjectState(updated);
    if (selectedTrackId === trackId) {
      setSelectedTrackId(updated.tracks[0]?.id || "");
    }
    setSelectedTrackIds((prev) => prev.filter((id) => id !== trackId));
    toast("Track dihapus.", "success");
  }, [selectedTrackId, pushProjectState, toast]);

  const handleDeleteMultipleTracks = useCallback(
    (trackIds: string[]) => {
      const current = projectRef.current;
      if (current.tracks.length <= trackIds.length) {
        toast("Proyek harus memiliki minimal satu track.", "error");
        return;
      }
      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.filter((t) => !trackIds.includes(t.id)),
      };
      pushProjectState(updated);
      setSelectedTrackId(updated.tracks[0]?.id || "");
      setSelectedTrackIds([updated.tracks[0]?.id || ""]);
      toast(`${trackIds.length} track dihapus.`, "success");
    },
    [pushProjectState, toast]
  );

  const handleMuteCtrlClick = useCallback(
    (trackId: string) => {
      const current = projectRef.current;
      const target = current.tracks.find((t) => t.id === trackId);
      if (!target) return;

      let newTracks: StudioTrack[];
      if (target.mute) {
        // If multiple tracks are muted and one is Ctrl-clicked, all are unmuted!
        newTracks = current.tracks.map((t) => ({ ...t, mute: false }));
        toast("Semua track di-unmute", "info");
      } else {
        // Ctrl-clicking an unmuted track unmutes all others and mutes the clicked track (mute 'solo')
        newTracks = current.tracks.map((t) => ({
          ...t,
          mute: t.id === trackId,
        }));
        toast(`Mute solo pada track "${target.name}"`, "info");
      }
      const updated: StudioProject = { ...current, tracks: newTracks };
      pushProjectState(updated);
      newTracks.forEach((t) => engine.updateTrackParameter(t.id, "mute", t.mute));
    },
    [pushProjectState, engine, toast]
  );

  const handleSoloCtrlClick = useCallback(
    (trackId: string) => {
      const current = projectRef.current;
      const target = current.tracks.find((t) => t.id === trackId);
      if (!target) return;

      let newTracks: StudioTrack[];
      if (target.solo) {
        // If target is soloed, disable solo on all tracks
        newTracks = current.tracks.map((t) => ({ ...t, solo: false }));
        toast("Semua solo dinonaktifkan", "info");
      } else {
        // Ctrl-clicking a non-soloed track disables solo on all others and solos clicked track
        newTracks = current.tracks.map((t) => ({
          ...t,
          solo: t.id === trackId,
        }));
        toast(`Solo eksklusif pada track "${target.name}"`, "info");
      }
      const updated: StudioProject = { ...current, tracks: newTracks };
      pushProjectState(updated);
      newTracks.forEach((t) => engine.updateTrackParameter(t.id, "solo", t.solo));
    },
    [pushProjectState, engine, toast]
  );

  const handleLinkSelectedTracks = useCallback(() => {
    const current = projectRef.current;
    if (selectedTrackIds.length < 2) {
      toast("Pilih setidaknya 2 track (Ctrl+Click atau Shift+Click) untuk menghubungkan track (Link).", "info");
      return;
    }
    const existingGroups = new Set(
      current.tracks.map((t) => t.linkGroupId).filter(Boolean) as string[]
    );
    let groupNum = 1;
    while (existingGroups.has(`group_${groupNum}`)) {
      groupNum++;
    }
    const newGroupId = `group_${groupNum}`;
    const updated: StudioProject = {
      ...current,
      tracks: current.tracks.map((t) =>
        selectedTrackIds.includes(t.id) ? { ...t, linkGroupId: newGroupId } : t
      ),
    };
    pushProjectState(updated);
    toast(`${selectedTrackIds.length} track berhasil di-link (Link Group ${groupNum})`, "success");
  }, [selectedTrackIds, pushProjectState, toast]);

  const handleUnlinkTrack = useCallback(
    (trackId: string) => {
      const current = projectRef.current;
      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.map((t) =>
          t.id === trackId ? { ...t, linkGroupId: undefined } : t
        ),
      };
      pushProjectState(updated);
      toast("Track dikeluarkan dari link group", "info");
    },
    [pushProjectState, toast]
  );

  const handleUnlinkAllInGroup = useCallback(
    (linkGroupId: string) => {
      const current = projectRef.current;
      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.map((t) =>
          t.linkGroupId === linkGroupId ? { ...t, linkGroupId: undefined } : t
        ),
      };
      pushProjectState(updated);
      toast(`Semua track di Link Group ${linkGroupId} telah di-unlink`, "info");
    },
    [pushProjectState, toast]
  );

  const handleResizeAllTracks = useCallback(
    (height: number) => {
      const current = projectRef.current;
      const updated: StudioProject = {
        ...current,
        tracks: current.tracks.map((t) => ({ ...t, height })),
      };
      pushProjectState(updated);
      toast(`Tinggi seluruh track diubah ke ${height}px`, "info");
    },
    [pushProjectState, toast]
  );

  const handleCycleTrackHeight = useCallback(() => {
    const heights = [64, 96, 144, 240];
    const current = projectRef.current;
    const target = current.tracks.find((t) => t.id === selectedTrackId);
    const currH = target?.height || 96;
    const nextIdx = (heights.indexOf(currH) + 1) % heights.length;
    const nextH = heights[nextIdx];
    const targets = selectedTrackIds.length > 0 ? selectedTrackIds : [selectedTrackId];
    const updated: StudioProject = {
      ...current,
      tracks: current.tracks.map((t) =>
        targets.includes(t.id) ? { ...t, height: nextH } : t
      ),
    };
    pushProjectState(updated);
  }, [selectedTrackId, selectedTrackIds, pushProjectState]);

  const handleDuplicateTrack = useCallback(
    (trackId: string) => {
      const trackIndex = project.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex === -1) return;
      const source = project.tracks[trackIndex];
      if (source.type === "video") {
        toast("Proyek hanya dapat memiliki satu Video track.", "error");
        return;
      }
      const newTrackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const duplicatedTrack: StudioTrack = {
        ...source,
        id: newTrackId,
        name: `${source.name} (Copy)`,
        clips: source.clips.map((c) => ({
          ...c,
          id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          trackId: newTrackId,
        })),
        plugins: source.plugins.map((p) => ({
          ...p,
          id: `plug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        })),
      };
      const nextTracks = [...project.tracks];
      nextTracks.splice(trackIndex + 1, 0, duplicatedTrack);
      pushProjectState({ ...project, tracks: nextTracks });
      setSelectedTrackId(newTrackId);
      engine.rebuildAudioGraph();
      toast(`Track "${source.name}" berhasil diduplikasi!`, "success");
    },
    [project, pushProjectState, engine, toast]
  );

  const handleInsertTrackAbove = useCallback(
    (targetTrackId: string, type: TrackType) => {
      if (type === "video" && projectRef.current.tracks.some((t) => t.type === "video")) {
        toast("Proyek hanya dapat memiliki satu Video track.", "error");
        return;
      }
      const currentTracks = [...projectRef.current.tracks];
      const insertIdx = Math.max(0, currentTracks.findIndex((t) => t.id === targetTrackId));
      const newTrack = createTrack(type, undefined, currentTracks.length);
      currentTracks.splice(insertIdx, 0, newTrack);

      const updated: StudioProject = {
        ...projectRef.current,
        tracks: currentTracks,
      };
      pushProjectState(updated);
      setSelectedTrackId(newTrack.id);
      setSelectedTrackIds([newTrack.id]);
      engine.rebuildAudioGraph();
      toast(`Track "${newTrack.name}" disisipkan di atas track!`, "success");
    },
    [pushProjectState, engine, toast]
  );

  const handleSelectAllClips = useCallback(
    (trackId: string) => {
      const current = projectRef.current;
      const trk = current.tracks.find((t) => t.id === trackId);
      if (!trk || trk.clips.length === 0) {
        toast("Track tidak memiliki klip.", "info");
        return;
      }
      setSelectedTrackId(trackId);
      setSelectedClipId(trk.clips[0].id);
      setSelectedClipIds(trk.clips.map((c) => c.id));
      toast(`Semua (${trk.clips.length}) klip pada track "${trk.name}" dipilih`, "info");
    },
    [toast]
  );

  const handleSelectAllLinkedTracks = useCallback(
    (linkGroupId: string) => {
      const current = projectRef.current;
      const linked = current.tracks.filter((t) => t.linkGroupId === linkGroupId).map((t) => t.id);
      if (linked.length > 0) {
        setSelectedTrackIds(linked);
        setSelectedTrackId(linked[0]);
        toast(`Semua ${linked.length} track dalam Link Group "${linkGroupId}" dipilih`, "info");
      }
    },
    [toast]
  );

  const handleMoveInstrument = useCallback(
    (sourceTrackId: string, targetTrackId: string) => {
      const current = projectRef.current;
      const source = current.tracks.find((t) => t.id === sourceTrackId);
      const target = current.tracks.find((t) => t.id === targetTrackId);
      if (!source || !target) return;

      const synthSettings = source.synthSettings ? { ...source.synthSettings } : undefined;
      const instrumentName = source.instrumentName;

      const updatedTracks = current.tracks.map((t) => {
        if (t.id === targetTrackId) {
          return {
            ...t,
            type: "midi" as TrackType,
            synthSettings: synthSettings ?? t.synthSettings,
            instrumentName: instrumentName ?? t.instrumentName,
          };
        }
        if (t.id === sourceTrackId) {
          return {
            ...t,
            instrumentName: undefined,
          };
        }
        return t;
      });

      pushProjectState({ ...current, tracks: updatedTracks });
      engine.rebuildAudioGraph();
      toast(`Instrumen "${instrumentName || "Virtual Instrument"}" dipindahkan ke track "${target.name}"!`, "success");
    },
    [pushProjectState, engine, toast]
  );

  const handleCopyInstrument = useCallback(
    (sourceTrackId: string, targetTrackId: string) => {
      const current = projectRef.current;
      const source = current.tracks.find((t) => t.id === sourceTrackId);
      const target = current.tracks.find((t) => t.id === targetTrackId);
      if (!source || !target) return;

      const synthSettings = source.synthSettings ? { ...source.synthSettings } : undefined;
      const instrumentName = source.instrumentName;

      const updatedTracks = current.tracks.map((t) => {
        if (t.id === targetTrackId) {
          return {
            ...t,
            type: "midi" as TrackType,
            synthSettings: synthSettings ?? t.synthSettings,
            instrumentName: instrumentName ?? t.instrumentName,
          };
        }
        return t;
      });

      pushProjectState({ ...current, tracks: updatedTracks });
      engine.rebuildAudioGraph();
      toast(`Instrumen "${instrumentName || "Virtual Instrument"}" disalin ke track "${target.name}"! [Alt+Drag]`, "success");
    },
    [pushProjectState, engine, toast]
  );

  const handleToggleVideoTextTrack = useCallback(
    (videoTrackId: string) => {
      const current = projectRef.current;
      const textTrack = current.tracks.find((t) => t.type === "video-text");
      if (textTrack) {
        // Remove / hide video-text track
        const updated = current.tracks.filter((t) => t.id !== textTrack.id);
        pushProjectState({ ...current, tracks: updated });
        toast("Video Text Track disembunyikan (-)", "info");
      } else {
        // Add video-text track directly beneath the video track
        const videoIdx = current.tracks.findIndex((t) => t.id === videoTrackId);
        const insertIdx = videoIdx !== -1 ? videoIdx + 1 : current.tracks.length;
        const newTrack = createTrack("video-text", "Video Text Track", insertIdx);
        const currentTracks = [...current.tracks];
        currentTracks.splice(insertIdx, 0, newTrack);
        pushProjectState({ ...current, tracks: currentTracks });
        toast("Video Text Track ditambahkan langsung di bawah Video Track (+)", "success");
      }
    },
    [pushProjectState, toast]
  );

  const handleImportVideoFile = useCallback(
    async (file: File) => {
      try {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        let currentTracks = [...projectRef.current.tracks];
        let videoTrack = currentTracks.find((t) => t.type === "video");

        if (!videoTrack) {
          videoTrack = createTrack("video", "Video Track", currentTracks.length);
          currentTracks.push(videoTrack);
        }

        let assetId: string | undefined;
        let durationSeconds = 30;
        try {
          const res = await engine.importAudioFile(file);
          assetId = res.assetId;
          durationSeconds = res.durationSeconds;
        } catch {
          // Video audio track decode fallback
        }

        const secPerBeat = 60 / projectRef.current.tempo;
        const durationBeats = durationSeconds / secPerBeat;

        const videoClip: StudioClip = {
          id: `clip_video_${Date.now()}`,
          trackId: videoTrack.id,
          type: "video",
          name: cleanName,
          color: videoTrack.color,
          startBeat: 0,
          durationBeats,
          offsetBeat: 0,
          gain: 1.0,
          assetId,
        };

        videoTrack.clips = [...videoTrack.clips, videoClip];

        // Mixcraft 10 specification:
        // "When a video with audio is imported, the video track will always have an associated audio track directly beneath it, but this track (and its associated audio clip) can be deleted without affecting the video track."
        const videoIdx = currentTracks.findIndex((t) => t.id === videoTrack!.id);
        const associatedAudioTrack = createTrack("audio", `${cleanName} (Audio Track)`, videoIdx + 1);
        associatedAudioTrack.color = "#06b6d4";

        if (assetId) {
          const audioClip: StudioClip = {
            id: `clip_assoc_audio_${Date.now()}`,
            trackId: associatedAudioTrack.id,
            type: "audio",
            name: `${cleanName} Audio`,
            color: associatedAudioTrack.color,
            startBeat: 0,
            durationBeats,
            offsetBeat: 0,
            gain: 1.0,
            assetId,
          };
          associatedAudioTrack.clips = [audioClip];
        }

        currentTracks.splice(videoIdx + 1, 0, associatedAudioTrack);

        const updatedProject: StudioProject = {
          ...projectRef.current,
          tracks: currentTracks,
        };

        pushProjectState(updatedProject);
        setIsVideoWindowOpen(true);
        setSelectedTrackId(videoTrack.id);
        toast(`Video "${cleanName}" dan associated audio track berhasil diimpor!`, "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Gagal mengimpor file video", "error");
      }
    },
    [engine, pushProjectState, toast]
  );

  const handleAddVideoTextClip = useCallback(
    (text: string) => {
      let currentTracks = [...projectRef.current.tracks];
      let textTrack = currentTracks.find((t) => t.type === "video-text");
      if (!textTrack) {
        const videoIdx = currentTracks.findIndex((t) => t.type === "video");
        const insertIdx = videoIdx !== -1 ? videoIdx + 1 : currentTracks.length;
        textTrack = createTrack("video-text", "Video Text Track", insertIdx);
        currentTracks.splice(insertIdx, 0, textTrack);
      }

      const newClip: StudioClip = {
        id: `clip_text_${Date.now()}`,
        trackId: textTrack.id,
        type: "video-text",
        name: text.length > 20 ? `${text.slice(0, 20)}...` : text,
        color: textTrack.color,
        startBeat: transport.currentBeat,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1.0,
        textOverlay: text,
      };

      textTrack.clips = [...textTrack.clips, newClip];
      pushProjectState({ ...projectRef.current, tracks: currentTracks });
      toast(`Video text "${newClip.name}" ditambahkan pada beat ${transport.currentBeat.toFixed(1)}!`, "success");
    },
    [pushProjectState, transport.currentBeat, toast]
  );

  const handleMixToNewAudioTrack = useCallback(
    async (trackId: string) => {
      const trackIndex = project.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex === -1) return;
      const source = project.tracks[trackIndex];
      if (source.clips.length === 0) {
        toast("Track tidak memiliki klip untuk di-bounce.", "error");
        return;
      }
      toast("Memproses mixdown track ke format audio...", "info");
      try {
        const res = await renderSingleTrackToWav(project, trackId, engine.getCachedAudioBuffers());
        const assetId = `asset_bounce_${Date.now()}`;
        await saveAudioBlob(assetId, res.blob);

        const audioAsset: AudioAssetMeta = {
          id: assetId,
          name: `${source.name} (Mixdown)`,
          mimeType: "audio/wav",
          sizeBytes: res.blob.size,
          durationSeconds: res.durationSeconds,
          sampleRate: project.sampleRate,
          channels: 2,
        };

        const newTrack = createTrack("audio", `${source.name} (Mixdown)`, trackIndex + 1);
        const bounceClip: StudioClip = {
          id: `clip_${Date.now()}`,
          trackId: newTrack.id,
          type: "audio",
          name: `${source.name} Mix`,
          color: newTrack.color,
          startBeat: res.startBeat,
          durationBeats: res.durationBeats,
          offsetBeat: 0,
          gain: 1.0,
          assetId,
        };
        newTrack.clips = [bounceClip];

        const nextTracks = [...project.tracks];
        nextTracks.splice(trackIndex + 1, 0, newTrack);
        const updatedProject: StudioProject = {
          ...project,
          tracks: nextTracks,
          assetManifest: { ...project.assetManifest, [assetId]: audioAsset },
        };
        pushProjectState(updatedProject);
        await engine.loadAssetFromStorage(assetId);
        setSelectedTrackId(newTrack.id);
        toast(`Track berhasil di-mixdown ke track audio baru "${newTrack.name}"!`, "success");
      } catch (err) {
        toast(`Gagal melakukan mixdown: ${err instanceof Error ? err.message : "Error"}`, "error");
      }
    },
    [project, pushProjectState, engine, toast]
  );

  const handleToggleFreezeTrack = useCallback(
    async (trackId: string) => {
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) return;

      if (track.isFrozen) {
        // UNFREEZE
        const updatedTracks = project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                isFrozen: false,
                plugins: t.plugins.map((p) => ({ ...p, enabled: true })),
              }
            : t
        );
        pushProjectState({ ...project, tracks: updatedTracks });
        engine.rebuildAudioGraph();
        toast(`Track "${track.name}" telah di-unfreeze. Instrumen & efek aktif kembali.`, "info");
      } else {
        // FREEZE
        if (track.clips.length === 0) {
          toast("Track tidak memiliki klip untuk dibekukan.", "error");
          return;
        }
        toast("Membekukan track untuk menghemat sumber daya CPU...", "info");
        try {
          const res = await renderSingleTrackToWav(project, trackId, engine.getCachedAudioBuffers());
          const assetId = `asset_freeze_${Date.now()}`;
          await saveAudioBlob(assetId, res.blob);

          const audioAsset: AudioAssetMeta = {
            id: assetId,
            name: `${track.name} (Frozen)`,
            mimeType: "audio/wav",
            sizeBytes: res.blob.size,
            durationSeconds: res.durationSeconds,
            sampleRate: project.sampleRate,
            channels: 2,
          };

          const updatedTracks = project.tracks.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  isFrozen: true,
                  frozenAssetId: assetId,
                  plugins: t.plugins.map((p) => ({ ...p, enabled: false })),
                }
              : t
          );

          const updatedProject: StudioProject = {
            ...project,
            tracks: updatedTracks,
            assetManifest: { ...project.assetManifest, [assetId]: audioAsset },
          };
          pushProjectState(updatedProject);
          await engine.loadAssetFromStorage(assetId);
          engine.rebuildAudioGraph();
          toast(`Track "${track.name}" berhasil dibekukan! CPU load dihemat.`, "success");
        } catch (err) {
          toast(`Gagal membekukan track: ${err instanceof Error ? err.message : "Error"}`, "error");
        }
      }
    },
    [project, pushProjectState, engine, toast]
  );

  const handleMoveTrack = useCallback(
    (trackId: string, direction: "up" | "down") => {
      const index = project.tracks.findIndex((t) => t.id === trackId);
      if (index === -1) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= project.tracks.length) return;

      const nextTracks = [...project.tracks];
      const [removed] = nextTracks.splice(index, 1);
      nextTracks.splice(targetIndex, 0, removed);

      pushProjectState({ ...project, tracks: nextTracks });
    },
    [project, pushProjectState]
  );

  // Clip operations
  const handleUpdateClip = (trackId: string, clipId: string, updates: Partial<StudioClip>) => {
    const updated: StudioProject = {
      ...project,
      tracks: project.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
            }
          : t
      ),
    };
    setProject(updated);
    engine.setProject(updated);
  };

  const handleDeleteClip = useCallback(
    (trackId: string, clipId: string) => {
      const updated: StudioProject = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t
        ),
      };
      pushProjectState(updated);
      if (selectedClipId === clipId) setSelectedClipId(undefined);
      setSelectedClipIds((prev) => prev.filter((id) => id !== clipId));
    },
    [project, pushProjectState, selectedClipId]
  );

  const handleDeleteSelectedClips = useCallback(
    (trackId: string, clipIds: string[]) => {
      const updated: StudioProject = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: t.clips.filter((c) => !clipIds.includes(c.id)) } : t
        ),
      };
      pushProjectState(updated);
      if (selectedClipId && clipIds.includes(selectedClipId)) setSelectedClipId(undefined);
      setSelectedClipIds([]);
    },
    [project, pushProjectState, selectedClipId]
  );

  const handleDuplicateClip = useCallback((trackId: string, clip: StudioClip) => {
    const newClip: StudioClip = {
      ...clip,
      id: `clip_${Date.now()}_dup`,
      startBeat: clip.startBeat + clip.durationBeats,
      name: `${clip.name} (Copy)`,
    };
    const updated: StudioProject = {
      ...project,
      tracks: project.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
    };
    pushProjectState(updated);
    toast("Klip diduplikasi.", "success");
  }, [project, pushProjectState, toast]);

  const handleSplitClip = useCallback((trackId: string, clipId: string, splitBeat: number) => {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;

    if (splitBeat <= clip.startBeat || splitBeat >= clip.startBeat + clip.durationBeats) {
      toast("Playhead harus berada di dalam batas durasi klip untuk membelah (split).", "info");
      return;
    }

    const firstDuration = splitBeat - clip.startBeat;
    const secondDuration = clip.durationBeats - firstDuration;

    let clip1Notes = clip.notes;
    let clip2Notes = undefined;

    if (clip.type === "midi" && clip.notes) {
      clip1Notes = clip.notes
        .filter((n) => n.startBeat < firstDuration)
        .map((n) => ({
          ...n,
          durationBeats: Math.min(n.durationBeats, firstDuration - n.startBeat),
        }));

      clip2Notes = clip.notes
        .filter((n) => n.startBeat + n.durationBeats > firstDuration)
        .map((n) => {
          const newStart = Math.max(0, n.startBeat - firstDuration);
          const overhang = n.startBeat < firstDuration ? firstDuration - n.startBeat : 0;
          return {
            ...n,
            id: `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            startBeat: newStart,
            durationBeats: Math.max(0.25, n.durationBeats - overhang),
          };
        });
    }

    const clip1: StudioClip = {
      ...clip,
      durationBeats: firstDuration,
      notes: clip1Notes,
    };

    const clip2: StudioClip = {
      ...clip,
      id: `clip_${Date.now()}_p2`,
      name: `${clip.name} (Split)`,
      startBeat: splitBeat,
      durationBeats: secondDuration,
      offsetBeat: (clip.offsetBeat || 0) + firstDuration,
      notes: clip2Notes,
    };

    const updatedProject: StudioProject = {
      ...project,
      tracks: project.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.flatMap((c) => (c.id === clipId ? [clip1, clip2] : [c])),
            }
          : t
      ),
    };

    pushProjectState(updatedProject);
    setSelectedClipId(clip2.id);
    setSelectedClipIds([clip2.id]);
    toast(`Klip "${clip.name}" berhasil dibelah pada beat ${splitBeat.toFixed(2)}`, "success");
  }, [project, pushProjectState, toast]);

  // Mixcraft 10 Clip Operations: Merging, Removing Spaces, Double-Length (Hlm. 210, 703)
  const handleMergeSelectedClips = useCallback(
    (trackId?: string, clipIds?: string[]) => {
      const tId = trackId || selectedTrackId;
      const cIds = clipIds && clipIds.length > 0 ? clipIds : selectedClipIds;
      if (!tId || cIds.length < 2) {
        toast("Pilih minimal 2 klip pada track yang sama untuk digabung [Ctrl+W]", "info");
        return;
      }
      const { project: nextProject, mergedClip } = mergeSelectedClipsInProject(project, tId, cIds);
      if (mergedClip) {
        pushProjectState(nextProject);
        setSelectedClipId(mergedClip.id);
        setSelectedClipIds([mergedClip.id]);
        toast(`Klip berhasil digabung menjadi "${mergedClip.name}" [Ctrl+W]`, "success");
      }
    },
    [project, pushProjectState, selectedTrackId, selectedClipIds, toast]
  );

  const handleRemoveSpaces = useCallback(
    (trackId?: string, clipIds?: string[]) => {
      const tId = trackId || selectedTrackId;
      if (!tId) return;
      const cIds =
        clipIds && clipIds.length > 0
          ? clipIds
          : selectedClipIds.length >= 2
          ? selectedClipIds
          : undefined;
      const nextProject = removeSpacesInProject(project, tId, cIds);
      pushProjectState(nextProject);
      toast("Jeda antar klip berhasil dihapus [Ctrl+J]", "success");
    },
    [project, pushProjectState, selectedTrackId, selectedClipIds, toast]
  );

  const handleDuplicateAndMerge = useCallback(
    (trackId: string, clipId: string) => {
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const { updatedTrack, doubleClip } = duplicateAndMergeClip(track, clipId);
      if (doubleClip) {
        const nextProject: StudioProject = {
          ...project,
          tracks: project.tracks.map((t) => (t.id === trackId ? updatedTrack : t)),
        };
        pushProjectState(nextProject);
        setSelectedClipId(doubleClip.id);
        setSelectedClipIds([doubleClip.id]);
        toast(`Panjang klip digandakan (2x) menjadi "${doubleClip.name}"`, "success");
      }
    },
    [project, pushProjectState, toast]
  );

  // Plugin operations
  const handleAddPlugin = (trackId: string, pluginDefId: string) => {
    const newPlug = {
      id: `plug_${Date.now()}`,
      pluginId: pluginDefId,
      name: pluginDefId.replace("internal.", "").toUpperCase(),
      enabled: true,
      parameters: {},
    };

    if (trackId === "master") {
      const updated: StudioProject = {
        ...project,
        masterTrack: {
          ...project.masterTrack,
          plugins: [...project.masterTrack.plugins, newPlug],
        },
      };
      pushProjectState(updated);
    } else if (project.buses?.some((b) => b.id === trackId)) {
      const updated: StudioProject = {
        ...project,
        buses: (project.buses || []).map((b) =>
          b.id === trackId ? { ...b, plugins: [...b.plugins, newPlug] } : b
        ),
      };
      pushProjectState(updated);
      engine.rebuildAudioGraph();
    } else {
      const updated: StudioProject = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId ? { ...t, plugins: [...t.plugins, newPlug] } : t
        ),
      };
      pushProjectState(updated);
    }
    toast("Efek baru disisipkan ke channel.", "success");
  };

  const handleRemovePlugin = (trackId: string, pluginInstanceId: string) => {
    if (trackId === "master") {
      const updated: StudioProject = {
        ...project,
        masterTrack: {
          ...project.masterTrack,
          plugins: project.masterTrack.plugins.filter((p) => p.id !== pluginInstanceId),
        },
      };
      pushProjectState(updated);
    } else if (project.buses?.some((b) => b.id === trackId)) {
      const updated: StudioProject = {
        ...project,
        buses: (project.buses || []).map((b) =>
          b.id === trackId
            ? { ...b, plugins: b.plugins.filter((p) => p.id !== pluginInstanceId) }
            : b
        ),
      };
      pushProjectState(updated);
      engine.rebuildAudioGraph();
    } else {
      const updated: StudioProject = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId
            ? { ...t, plugins: t.plugins.filter((p) => p.id !== pluginInstanceId) }
            : t
        ),
      };
      pushProjectState(updated);
    }
  };

  // Import backing track audio file
  const handleImportAudioFile = useCallback(
    async (file: File, targetTrackId?: string, atBeat: number = 0) => {
      try {
        const res = await engine.importAudioFile(file);
        const secPerBeat = 60 / project.tempo;
        const durationBeats = res.durationSeconds / secPerBeat;
        const cleanName = file.name.replace(/\.[^/.]+$/, "");

        let targetTrack = targetTrackId ? project.tracks.find((t) => t.id === targetTrackId) : undefined;
        let isNewTrack = false;

        if (!targetTrack || targetTrack.type !== "audio") {
          targetTrack = createTrack("audio", cleanName, project.tracks.length);
          targetTrack.color = "#ec4899"; // Pink audio
          isNewTrack = true;
        }

        const newClip: StudioClip = {
          id: `clip_imported_${Date.now()}`,
          trackId: targetTrack.id,
          type: "audio",
          name: cleanName,
          color: targetTrack.color,
          startBeat: Math.max(0, atBeat),
          durationBeats,
          offsetBeat: 0,
          gain: 1.0,
          assetId: res.assetId,
        };

        let updatedTracks: StudioTrack[];
        if (isNewTrack) {
          targetTrack.clips = [newClip];
          updatedTracks = [...project.tracks, targetTrack];
        } else {
          updatedTracks = project.tracks.map((t) =>
            t.id === targetTrack!.id ? { ...t, clips: [...t.clips, newClip] } : t
          );
        }

        const updatedProject: StudioProject = {
          ...project,
          tracks: updatedTracks,
          assetManifest: {
            ...project.assetManifest,
            [res.assetId]: {
              id: res.assetId,
              name: file.name,
              mimeType: file.type || "audio/wav",
              sizeBytes: file.size,
              durationSeconds: res.durationSeconds,
              sampleRate: res.sampleRate,
              channels: res.channels,
              blobRef: res.assetId,
            },
          },
        };

        pushProjectState(updatedProject);
        setSelectedTrackId(targetTrack.id);
        setSelectedClipId(newClip.id);
        setSelectedClipIds([newClip.id]);
        toast(`Audio "${file.name}" berhasil diimpor ke timeline pada beat ${atBeat.toFixed(1)}!`, "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Gagal mengimpor berkas audio", "error");
      }
    },
    [engine, project, pushProjectState, toast]
  );

  // Mixcraft 10 Separate Music into Stems Handler (Hlm. 650–652)
  const handlePerformStemSeparation = useCallback(
    async (trackId: string, clipId: string, options: StemSeparationOptions) => {
      if (!stemSeparationTarget) return;
      const clip = stemSeparationTarget.clip;
      setIsStemSeparationProcessing(true);
      setStemSeparationProgress(5);
      setStemSeparationStatus("Memuat buffer audio...");

      try {
        let audioBuffer: AudioBuffer | null = null;
        if (clip.assetId) {
          audioBuffer = await engine.loadAssetFromStorage(clip.assetId);
        }
        if (!audioBuffer) {
          throw new Error("Berkas audio untuk klip ini tidak ditemukan pada penyimpanan proyek.");
        }

        const stems = await separateAudioBufferIntoStems(
          audioBuffer,
          options,
          (pct, msg) => {
            setStemSeparationProgress(pct);
            setStemSeparationStatus(msg);
          }
        );

        setStemSeparationStatus("Menyimpan blob stem ke IndexedDB...");
        await saveSeparatedStemsToStorage(stems);
        for (const stem of stems) {
          await engine.setAudioBuffer(stem.assetId, stem.buffer);
        }

        setStemSeparationStatus("Menyusun trek dan klip stem pada proyek...");
        const result = createStemSeparationTracks(
          project,
          trackId,
          clipId,
          stems,
          options
        );

        pushProjectState(result.project);
        setStemSeparationTarget(null);
        toast(`Pemisahan stem selesai! ${stems.length} trek berhasil ditambahkan.`, "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Gagal memisahkan stem audio.", "error");
      } finally {
        setIsStemSeparationProcessing(false);
        setStemSeparationProgress(0);
        setStemSeparationStatus("");
      }
    },
    [stemSeparationTarget, engine, project, pushProjectState, toast]
  );

  // Keyboard Shortcuts (Space for Play/Pause, Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, B, M, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if focus is in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (transport.playing) {
          engine.pause();
        } else {
          engine.play();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedTrackId && selectedClipId) {
          e.preventDefault();
          const trk = project.tracks.find((t) => t.id === selectedTrackId);
          const clip = trk?.clips.find((c) => c.id === selectedClipId);
          if (clip) handleDuplicateClip(selectedTrackId, clip);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        // Mixcraft 10 shortcut: [CTRL]+W to Merge Selected Clips (Hlm. 210-211, 703)
        e.preventDefault();
        handleMergeSelectedClips();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        // Mixcraft 10 shortcut: [CTRL]+J to Remove Spaces Between Clips (Hlm. 703)
        e.preventDefault();
        handleRemoveSpaces();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTrackId && selectedClipIds.length > 0) {
          e.preventDefault();
          handleDeleteSelectedClips(selectedTrackId, selectedClipIds);
        } else if (selectedTrackId && selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedTrackId, selectedClipId);
        } else if (selectedTrackIds.length > 0) {
          e.preventDefault();
          handleDeleteMultipleTracks(selectedTrackIds);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        // Mixcraft 10 shortcut: [CTRL]+B to arm/disarm record for selected track(s)
        e.preventDefault();
        const targets = selectedTrackIds.length > 0 ? selectedTrackIds : (selectedTrackId ? [selectedTrackId] : []);
        if (targets.length > 0) {
          const anyArmed = targets.some((id) => project.tracks.find((t) => t.id === id)?.armRecord);
          targets.forEach((id) => handleUpdateTrack(id, { armRecord: !anyArmed }));
          toast(anyArmed ? "Track Record Arm dinonaktifkan [Ctrl+B]" : "Track Record Arm diaktifkan [Ctrl+B]", "info");
        }
      } else if (e.altKey && e.key.toLowerCase() === "l") {
        // Mixcraft 10 shortcut: [ALT]+L to add lane to track
        e.preventDefault();
        if (selectedTrackId) {
          handleAddLane(selectedTrackId);
        }
      } else if (e.altKey && e.key.toLowerCase() === "k") {
        // Mixcraft 10 shortcut: [ALT]+K to delete empty lanes
        e.preventDefault();
        if (selectedTrackId) {
          handleDeleteEmptyLanes(selectedTrackId);
        }
      } else if (e.key.toLowerCase() === "b") {
        if (selectedTrackId && selectedClipId) {
          e.preventDefault();
          handleSplitClip(selectedTrackId, selectedClipId, transport.currentBeat);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const targets = selectedTrackIds.length > 0 ? selectedTrackIds : [selectedTrackId];
        const anyMuted = targets.some((id) => project.tracks.find((t) => t.id === id)?.mute);
        targets.forEach((id) => handleUpdateTrack(id, { mute: !anyMuted }));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        const targets = selectedTrackIds.length > 0 ? selectedTrackIds : [selectedTrackId];
        const anySoloed = targets.some((id) => project.tracks.find((t) => t.id === id)?.solo);
        targets.forEach((id) => handleUpdateTrack(id, { solo: !anySoloed }));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "~" || e.key === "`")) {
        e.preventDefault();
        handleCycleTrackHeight();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        const targets = selectedTrackIds.length > 0 ? selectedTrackIds : [selectedTrackId];
        const anyArmed = targets.some((id) => project.tracks.find((t) => t.id === id)?.armRecord);
        targets.forEach((id) => handleUpdateTrack(id, { armRecord: !anyArmed }));
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setIsVideoWindowOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setPianoRollTarget(null);
        setIsMixerOpen(false);
        setPluginDialogTrackId(null);
        setIsExportDialogOpen(false);
        setIsProjectDialogOpen(false);
        setIsVideoWindowOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    engine,
    transport.playing,
    transport.currentBeat,
    handleUndo,
    handleRedo,
    selectedTrackId,
    selectedTrackIds,
    selectedClipId,
    selectedClipIds,
    project.tracks,
    handleDuplicateClip,
    handleDeleteClip,
    handleDeleteSelectedClips,
    handleDeleteMultipleTracks,
    handleSplitClip,
    handleMergeSelectedClips,
    handleRemoveSpaces,
    handleUpdateTrack,
    handleCycleTrackHeight,
    handleAddLane,
    handleDeleteEmptyLanes,
    toast,
  ]);

  // Web MIDI API Hardware Controller Listener & Dispatcher (Mixcraft 10 Hlm. 488 & 661)
  useEffect(() => {
    webMidiManager.initialize();

    const unsubscribe = webMidiManager.addListener((event: MidiMessageEvent) => {
      // 1. If we are actively learning a target
      if (isMidiLearnActiveRef.current && midiLearningTargetRef.current) {
        const target = midiLearningTargetRef.current;
        const newMapping: MidiMapping = {
          id: `map_${Date.now()}_${event.controlNumber}`,
          command: target.command,
          label: target.label,
          category: target.category,
          messageType: event.type,
          channel: event.channel,
          controlNumber: event.controlNumber,
          trackId: target.trackId,
          parameter: target.parameter,
        };
        const updated = createOrUpdateMapping(midiMappingsRef.current, newMapping);
        setMidiMappings(updated);
        saveMidiMappingsToStorage(updated);
        toast(`Berhasil memetakan MIDI ${event.type.toUpperCase()} ${event.controlNumber} ke "${target.label}"!`, "success");
        setMidiLearningTarget(null);
        return;
      }

      // 2. Normal live dispatch against mapping table
      const matched = findMatchingMidiMapping(midiMappingsRef.current, event);
      if (!matched) return;

      const current = projectRef.current;
      const isToggle = isToggleTrigger(event);

      switch (matched.command) {
        case "transport_play":
          if (isToggle) {
            if (engine.isPlaying()) engine.pause();
            else engine.play();
          }
          break;
        case "transport_record":
          if (isToggle) {
            if (engine.isRecording()) {
              engine.stopRecording();
            } else {
              const anyArmed = current.tracks.some((t) => t.armRecord);
              if (!anyArmed && selectedTrackIdRef.current) {
                handleUpdateTrack(selectedTrackIdRef.current, { armRecord: true });
              }
              engine.startRecording(selectedDeviceId);
            }
          }
          break;
        case "transport_rewind":
          if (isToggle) {
            engine.seekToBeat(0);
          }
          break;
        case "transport_loop":
          if (isToggle) {
            const nextLoop = !current.loopRange.enabled;
            pushProjectState({
              ...current,
              loopRange: { ...current.loopRange, enabled: nextLoop },
            });
          }
          break;
        case "transport_metronome":
          if (isToggle) {
            engine.toggleMetronome();
          }
          break;
        case "master_volume": {
          const newVol = scaleCcToVolume(event.value);
          pushProjectState({
            ...current,
            masterTrack: { ...current.masterTrack, volume: newVol },
          });
          engine.rebuildAudioGraph();
          break;
        }
        case "master_pan": {
          const newPan = scaleCcToPan(event.value);
          pushProjectState({
            ...current,
            masterTrack: { ...current.masterTrack, pan: newPan },
          });
          engine.rebuildAudioGraph();
          break;
        }
        case "selected_track_volume": {
          if (selectedTrackIdRef.current) {
            handleUpdateTrack(selectedTrackIdRef.current, { volume: scaleCcToVolume(event.value) });
          }
          break;
        }
        case "selected_track_pan": {
          if (selectedTrackIdRef.current) {
            handleUpdateTrack(selectedTrackIdRef.current, { pan: scaleCcToPan(event.value) });
          }
          break;
        }
        case "selected_track_mute": {
          if (selectedTrackIdRef.current && isToggle) {
            const trk = current.tracks.find((t) => t.id === selectedTrackIdRef.current);
            if (trk) handleUpdateTrack(selectedTrackIdRef.current, { mute: !trk.mute });
          }
          break;
        }
        case "selected_track_solo": {
          if (selectedTrackIdRef.current && isToggle) {
            const trk = current.tracks.find((t) => t.id === selectedTrackIdRef.current);
            if (trk) handleUpdateTrack(selectedTrackIdRef.current, { solo: !trk.solo });
          }
          break;
        }
        case "selected_track_arm": {
          if (selectedTrackIdRef.current && isToggle) {
            const trk = current.tracks.find((t) => t.id === selectedTrackIdRef.current);
            if (trk) handleUpdateTrack(selectedTrackIdRef.current, { armRecord: !trk.armRecord });
          }
          break;
        }
        case "selected_track_monitoring": {
          if (selectedTrackIdRef.current && isToggle) {
            const trk = current.tracks.find((t) => t.id === selectedTrackIdRef.current);
            if (trk) handleUpdateTrack(selectedTrackIdRef.current, { monitoringEnabled: !trk.monitoringEnabled });
          }
          break;
        }
        default: {
          // Direct track mapping (track_volume:{trackId}, etc.)
          let targetId = matched.trackId;
          if (!targetId && matched.trackIndex && current.tracks[matched.trackIndex - 1]) {
            targetId = current.tracks[matched.trackIndex - 1].id;
          }
          if (targetId) {
            const trk = current.tracks.find((t) => t.id === targetId);
            if (!trk) break;
            if (matched.parameter === "volume" || matched.command.startsWith("track_volume")) {
              handleUpdateTrack(targetId, { volume: scaleCcToVolume(event.value) });
            } else if (matched.parameter === "pan" || matched.command.startsWith("track_pan")) {
              handleUpdateTrack(targetId, { pan: scaleCcToPan(event.value) });
            } else if (matched.parameter === "mute" && isToggle) {
              handleUpdateTrack(targetId, { mute: !trk.mute });
            } else if (matched.parameter === "solo" && isToggle) {
              handleUpdateTrack(targetId, { solo: !trk.solo });
            } else if (matched.parameter === "arm" && isToggle) {
              handleUpdateTrack(targetId, { armRecord: !trk.armRecord });
            }
          }
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [engine, handleUpdateTrack, pushProjectState, selectedDeviceId, toast]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-zinc-950 overflow-hidden font-sans select-none rounded-2xl border border-white/10 shadow-2xl">
      {/* Top Transport Toolbar */}
      <TransportBar
        projectName={project.name}
        transport={transport}
        masterVolume={project.masterTrack.volume}
        masterLevel={masterLevel}
        inputLevel={inputLevel}
        inputDevices={inputDevices}
        selectedDeviceId={selectedDeviceId}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        onPlay={() => engine.play()}
        onPause={() => engine.pause()}
        onStop={() => engine.stop()}
        onRecord={async () => {
          if (transport.recording) {
            await engine.stopRecording();
          } else {
            try {
              // If nothing else is armed, automatically arm the currently selected track!
              const current = projectRef.current;
              const anyArmed = current.tracks.some((t) => t.armRecord);
              if (!anyArmed && selectedTrackId) {
                handleUpdateTrack(selectedTrackId, { armRecord: true });
              }
              if (countInEnabled) {
                toast("Count-In 1 Bar aktif...", "info");
                const secPerBeat = 60 / project.tempo;
                await new Promise((resolve) => setTimeout(resolve, secPerBeat * 4 * 1000));
              }
              await engine.startRecording(selectedDeviceId);
              toast("Merekam multitrack dimulai!", "success");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Gagal memulai perekaman", "error");
            }
          }
        }}
        onToggleLoop={() => {
          const next = !project.loopRange.enabled;
          const updated: StudioProject = {
            ...project,
            loopRange: { ...project.loopRange, enabled: next },
          };
          pushProjectState(updated);
        }}
        onToggleMetronome={() => engine.toggleMetronome()}
        onToggleCountIn={() => setCountInEnabled(!countInEnabled)}
        hasCountIn={countInEnabled}
        onTempoChange={(bpm) => {
          const updated: StudioProject = { ...project, tempo: bpm };
          pushProjectState(updated);
          engine.setTempo(bpm);
        }}
        onMasterVolumeChange={(vol) => {
          const updated: StudioProject = {
            ...project,
            masterTrack: { ...project.masterTrack, volume: vol },
          };
          pushProjectState(updated);
          engine.rebuildAudioGraph();
        }}
        onSelectInputDevice={setSelectedDeviceId}
        onOpenProjectDialog={() => setIsProjectDialogOpen(true)}
        onOpenExportDialog={() => setIsExportDialogOpen(true)}
        onNewProject={() => {
          const fresh = createEmptyProject("Proyek Baru");
          pushProjectState(fresh);
          toast("Proyek baru dibuat.", "success");
        }}
        onAddTrack={handleAddTrack}
        showEffectsOnTracks={showEffectsOnTracks}
        onToggleShowEffectsOnTracks={() => setShowEffectsOnTracks(!showEffectsOnTracks)}
        showMasterTrack={showMasterTrack}
        onToggleShowMasterTrack={() => setShowMasterTrack(!showMasterTrack)}
        showPerformancePanel={showPerformancePanel}
        onToggleShowPerformancePanel={() => setShowPerformancePanel(!showPerformancePanel)}
        onToggleStepSequencer={() => setIsStepSequencerOpen(!isStepSequencerOpen)}
        isStepSequencerOpen={isStepSequencerOpen}
        onToggleMixer={() => setIsMixerOpen(!isMixerOpen)}
        isMixerOpen={isMixerOpen}
        onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)}
        isLyricsOpen={isLyricsOpen}
        isMidiLearnActive={isMidiLearnActive}
        onToggleMidiLearn={() => {
          const next = !isMidiLearnActive;
          setIsMidiLearnActive(next);
          if (!next) setMidiLearningTarget(null);
          toast(
            next
              ? "Mode MIDI Learn Aktif (Mixcraft 10). Putar knob/fader atau klik kontrol di DAW untuk memetakan."
              : "Mode MIDI Learn dinonaktifkan.",
            "info"
          );
        }}
        onOpenMidiLearnDialog={() => setIsMidiLearnDialogOpen(true)}
        audioDriver={audioDriver}
        onSelectAudioDriver={setAudioDriver}
        metronomeRecording={metronomeRecording}
        metronomePlayback={metronomePlayback}
        countInMeasures={countInMeasures}
        onUpdateMetronomeSettings={(st) => {
          if (st.recording !== undefined) {
            setMetronomeRecording(st.recording);
            engine.setMetronomeSettings({ recording: st.recording });
          }
          if (st.playback !== undefined) {
            setMetronomePlayback(st.playback);
            engine.setMetronomeSettings({ playback: st.playback });
          }
          if (st.countIn !== undefined) setCountInEnabled(st.countIn);
          if (st.countInMeasures !== undefined) setCountInMeasures(st.countInMeasures);
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* MIDI Learn Mode Floating Target Ribbon (Mixcraft 10 Hlm. 488) */}
      {isMidiLearnActive && (
        <div className="flex items-center justify-between border-b border-purple-500/40 bg-purple-950/80 px-4 py-2 text-xs backdrop-blur shadow-md animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5 text-purple-200">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-purple-500/20 text-purple-300">
              <Radio className="size-4 animate-pulse" />
            </span>
            <span>
              <strong>Mode MIDI Learn Aktif (Mixcraft 10 Hlm. 488):</strong>{" "}
              {midiLearningTarget ? (
                <>
                  Menunggu input hardware untuk:{" "}
                  <span className="font-bold text-white underline bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/40">
                    {midiLearningTarget.label}
                  </span>
                  . Gerakkan knob/fader atau tekan tombol controller Anda!
                </>
              ) : (
                "Gerakkan hardware MIDI controller atau klik 'Kelola Pemetaan' untuk mengonfigurasi tombol & fader."
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => setIsMidiLearnDialogOpen(true)}
              className="rounded-lg bg-purple-600 px-3 py-1 font-bold text-white hover:bg-purple-500 transition shadow"
            >
              Kelola Pemetaan...
            </button>
            <button
              onClick={() => {
                setIsMidiLearnActive(false);
                setMidiLearningTarget(null);
              }}
              className="rounded-lg border border-purple-400/30 px-2.5 py-1 text-purple-300 hover:bg-purple-900/50 hover:text-white transition"
            >
              Stop Learning
            </button>
          </div>
        </div>
      )}

      {/* Disaster Recovery Autosave Banner (Mixcraft 10 Hlm. 686) */}
      {autosaveRecovery && (
        <div className="flex items-center justify-between border-b border-amber-500/40 bg-amber-950/80 px-4 py-2 text-xs backdrop-blur shadow-md">
          <div className="flex items-center gap-2.5 text-amber-200">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="size-4" />
            </span>
            <span>
              <strong>Pemulihan Darurat (Disaster Recovery):</strong> Ditemukan snapshot autosave untuk proyek{" "}
              <span className="font-bold text-white">&quot;{autosaveRecovery.project.name}&quot;</span> ({autosaveRecovery.project.tracks.length} track, tersimpan pukul {new Date(autosaveRecovery.savedAt).toLocaleTimeString("id-ID")}). Ingin memulihkan aransemen terakhir? (Mixcraft 10 Hlm. 686)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={handleRestoreAutosave}
              className="rounded-lg bg-amber-500 px-3 py-1 font-bold text-black hover:bg-amber-400 transition shadow"
            >
              Pulihkan Proyek
            </button>
            <button
              onClick={handleDismissAutosave}
              className="rounded-lg border border-amber-400/30 px-2.5 py-1 text-amber-300 hover:bg-amber-900/50 hover:text-white transition"
            >
              Abaikan
            </button>
          </div>
        </div>
      )}

      {/* Main DAW Body (Track Headers List + Performance Panel + Timeline) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Column: Track Headers */}
        <div
          className={`flex shrink-0 flex-col border-r border-white/10 bg-charcoal/90 overflow-y-auto transition-all duration-150 ${
            showEffectsOnTracks ? "w-80" : "w-60"
          }`}
        >
          {/* Track List Top Bar */}
          <div className="relative flex h-7 items-center justify-between border-b border-white/10 px-3 text-[11px] font-bold text-zinc-400">
            <span>TRACKS ({project.tracks.length})</span>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddMenuCoords(null);
                  setIsAddMenuOpen((prev) => !prev);
                }}
                title="Tambah Track Baru (+)..."
                className="flex items-center gap-1 text-violet-400 hover:text-white transition px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <ChevronDown className="size-3" />
              </button>
            </div>
          </div>

          {/* Tracks List */}
          <div className="flex flex-col">
            {project.tracks.map((track, trackIndex) => (
              <TrackHeader
                key={track.id}
                track={track}
                trackIndex={trackIndex}
                buses={project.buses}
                meterLevel={trackLevels[track.id] || 0}
                inputMeterLevel={inputLevel}
                audioDriver={audioDriver}
                isSelected={selectedTrackIds.includes(track.id)}
                selectedTrackCount={selectedTrackIds.length}
                showEffectsOnTracks={showEffectsOnTracks}
                onToggleEffectsOnTracks={() => setShowEffectsOnTracks((prev) => !prev)}
                isAutomationLaneOpen={expandedAutomationTrackIds.has(track.id)}
                onToggleAutomationLane={handleToggleAutomationLane}
                onSelect={(e) => handleSelectTrack(track.id, e)}
                onUpdateTrack={handleUpdateTrack}
                onUpdateTrackRelative={handleUpdateTrackRelative}
                onDeleteTrack={handleDeleteTrack}
                onOpenPluginDialog={(tid) => setPluginDialogTrackId(tid)}
                onCloseAllEffectWindows={() => setPluginDialogTrackId(null)}
                onImportAudioFile={(tid, file) => void handleImportAudioFile(file, tid, 0)}
                onDuplicateTrack={handleDuplicateTrack}
                onMixToNewAudioTrack={handleMixToNewAudioTrack}
                onToggleFreezeTrack={handleToggleFreezeTrack}
                onMoveTrack={handleMoveTrack}
                onResizeAllTracks={handleResizeAllTracks}
                onLinkSelectedTracks={handleLinkSelectedTracks}
                onUnlinkTrack={handleUnlinkTrack}
                onUnlinkAllInGroup={handleUnlinkAllInGroup}
                onMuteCtrlClick={handleMuteCtrlClick}
                onSoloCtrlClick={handleSoloCtrlClick}
                onInsertTrackAbove={(tid, type) => handleInsertTrackAbove(tid, type)}
                onSelectAllClips={handleSelectAllClips}
                onSelectAllLinkedTracks={handleSelectAllLinkedTracks}
                onAddLane={handleAddLane}
                onDeleteBottomLane={handleDeleteBottomLane}
                onDeleteEmptyLanes={handleDeleteEmptyLanes}
                onMuteAllLanes={handleMuteAllLanes}
                onUnmuteAllLanes={handleUnmuteAllLanes}
                onCycleTrackHeight={handleCycleTrackHeight}
                onMoveInstrument={handleMoveInstrument}
                onCopyInstrument={handleCopyInstrument}
                hasVideoTextTrack={project.tracks.some((t) => t.type === "video-text")}
                isVideoWindowOpen={isVideoWindowOpen}
                onToggleVideoWindow={() => setIsVideoWindowOpen((prev) => !prev)}
                onToggleVideoTextTrack={handleToggleVideoTextTrack}
              />
            ))}

            {/* Show Master Track in Track List */}
            {showMasterTrack && (
              <MasterTrackHeader
                masterTrack={project.masterTrack}
                masterLevel={masterLevel}
                showEffectsOnTracks={showEffectsOnTracks}
                onUpdateMasterTrack={(updates) => {
                  const updated: StudioProject = {
                    ...project,
                    masterTrack: { ...project.masterTrack, ...updates },
                  };
                  pushProjectState(updated);
                  engine.rebuildAudioGraph();
                }}
                onOpenPluginDialog={() => setPluginDialogTrackId("master")}
                onCloseAllEffectWindows={() => setPluginDialogTrackId(null)}
              />
            )}
          </div>

          {/* Empty Area Below Tracks (Click or Right-Click opens Add Track Menu) */}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setAddMenuCoords({ x: e.clientX, y: e.clientY });
                setIsAddMenuOpen(true);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setAddMenuCoords({ x: e.clientX, y: e.clientY });
              setIsAddMenuOpen(true);
            }}
            title="Klik area kosong untuk membuka menu Tambah Track (Add / Insert Track)"
            className="flex-1 min-h-[60px] cursor-pointer hover:bg-white/[0.01] transition"
          />

          {/* Bottom Add Track Buttons */}
          <div className="p-3 border-t border-white/5 mt-auto flex flex-col gap-2 bg-charcoal/95">
            <div className="flex gap-2">
              <button
                onClick={() => handleAddTrack("midi")}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-violet-500/30 bg-violet-600/10 py-1.5 text-xs font-bold text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
              >
                <Music className="size-3.5" />
                <span>+ MIDI</span>
              </button>
              <button
                onClick={() => handleAddTrack("audio")}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-pink-500/30 bg-pink-600/10 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-600/20 transition cursor-pointer"
              >
                <Mic2 className="size-3.5" />
                <span>+ Audio</span>
              </button>
            </div>
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setAddMenuCoords({ x: rect.right, y: rect.top });
                setIsAddMenuOpen(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-medium text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Plus className="size-3" />
              <span>More Track Types...</span>
            </button>
          </div>
        </div>

        {/* --- ADD / INSERT TRACK MENU WITH MENU PERSIST SWITCH --- */}
        {isAddMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setIsAddMenuOpen(false);
                setAddMenuCoords(null);
              }}
            />
            <div
              className={`w-64 rounded-2xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md z-50 text-xs animate-in fade-in zoom-in-95 duration-100 select-none ${
                addMenuCoords ? "fixed" : "absolute left-60 top-16"
              }`}
              style={
                addMenuCoords
                  ? {
                      top: `${Math.min(window.innerHeight - 440, addMenuCoords.y)}px`,
                      left: `${Math.min(window.innerWidth - 270, addMenuCoords.x)}px`,
                    }
                  : undefined
              }
            >
              {/* Header with Title and Menu Persist Switch */}
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Track Menu
                </span>
                <label
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuPersist(!menuPersist);
                  }}
                  title="Menu Persist Switch: When enabled, the right-click menu stays open while multiple functions and options are selected. To close, click outside."
                  className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-300 hover:text-white select-none transition"
                >
                  <span className="text-[9px]">Menu Persist</span>
                  <div
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                      menuPersist ? "bg-blue-600 shadow-xs shadow-blue-500/50" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block size-3 transform rounded-full bg-white transition-transform ${
                        menuPersist ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Section: Add Track (Bottom) */}
              <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                Add Track (Bottom)
              </div>
              <button
                onClick={() => {
                  handleAddTrack("audio", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-pink-600/20 hover:text-pink-300 transition cursor-pointer"
              >
                <Mic2 className="size-3.5 text-pink-400" />
                <span>Audio Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("midi", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-violet-600/20 hover:text-violet-300 transition cursor-pointer"
              >
                <Music className="size-3.5 text-violet-400" />
                <span>Instrument Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("video", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-amber-600/20 hover:text-amber-300 transition cursor-pointer"
              >
                <Video className="size-3.5 text-amber-400" />
                <span>Video Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("send", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition cursor-pointer"
              >
                <Sparkles className="size-3.5 text-indigo-400" />
                <span>Send Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("submix", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition cursor-pointer"
              >
                <FolderTree className="size-3.5 text-emerald-400" />
                <span>SubMix Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("output", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-blue-600/20 hover:text-blue-300 transition cursor-pointer"
              >
                <Disc className="size-3.5 text-blue-400" />
                <span>Output Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("vocoder", false);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-fuchsia-600/20 hover:text-fuchsia-300 transition cursor-pointer"
              >
                <Activity className="size-3.5 text-fuchsia-400" />
                <span>Vocoder Track</span>
              </button>

              <div className="my-1.5 border-t border-white/10" />

              {/* Section: Insert Track (Above Selected Track) */}
              <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                Insert Track (Above Selected)
              </div>
              <button
                onClick={() => {
                  handleAddTrack("audio", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-pink-400" />
                <span>Insert Audio Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("midi", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-violet-400" />
                <span>Insert Instrument Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("video", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-amber-400" />
                <span>Insert Video Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("send", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-indigo-400" />
                <span>Insert Send Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("submix", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-emerald-400" />
                <span>Insert SubMix Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("output", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-blue-400" />
                <span>Insert Output Track</span>
              </button>
              <button
                onClick={() => {
                  handleAddTrack("vocoder", true);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Plus className="size-3.5 text-fuchsia-400" />
                <span>Insert Vocoder Track</span>
              </button>

              <div className="my-1.5 border-t border-white/10" />

              {/* Section: Display & UI Options */}
              <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                Options &amp; Views
              </div>
              <button
                onClick={() => {
                  setShowEffectsOnTracks(!showEffectsOnTracks);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <span>Show Effects On Tracks</span>
                {showEffectsOnTracks && <Check className="size-3 text-purple-400" />}
              </button>
              <button
                onClick={() => {
                  setShowPerformancePanel(!showPerformancePanel);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3 text-violet-400" />
                  <span>Performance Panel</span>
                </span>
                {showPerformancePanel && <Check className="size-3 text-emerald-400" />}
              </button>
              <button
                onClick={() => {
                  setShowMasterTrack(!showMasterTrack);
                  if (!menuPersist) {
                    setIsAddMenuOpen(false);
                    setAddMenuCoords(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 transition cursor-pointer"
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

        {/* Middle Column: Performance Panel (if enabled) */}
        {showPerformancePanel && (
          <PerformancePanel
            project={project}
            currentBeat={transport.currentBeat}
            isPlaying={transport.playing}
            onClose={() => setShowPerformancePanel(false)}
            selectedTrackId={selectedTrackId}
            onSelectTrack={setSelectedTrackId}
            onTriggerPerformanceClip={(trackId, slotIdx) => {
              const trk = project.tracks.find((t) => t.id === trackId);
              if (!trk) return;
              const clip = getTrackPerformanceClip(trk, slotIdx);
              if (clip && project.isPerformanceArmed) {
                // If Performance Arm is engaged (Hlm. 414), stamp to main timeline
                const updated = recordPerformanceClipToTimeline(
                  project,
                  trackId,
                  clip,
                  transport.currentBeat
                );
                pushProjectState(updated);
              }
            }}
            onTriggerSet={(setIdx) => {
              if (project.isPerformanceArmed) {
                let currentProj = project;
                for (const trk of project.tracks) {
                  const clip = getTrackPerformanceClip(trk, setIdx);
                  if (clip) {
                    currentProj = recordPerformanceClipToTimeline(
                      currentProj,
                      trk.id,
                      clip,
                      transport.currentBeat
                    );
                  }
                }
                pushProjectState(currentProj);
              }
            }}
            onUpdateProject={(updates) => pushProjectState({ ...project, ...updates })}
            onUpdateTrack={handleUpdateTrack}
          />
        )}

        {/* Right Column: Arrangement Timeline */}
        <Timeline
          project={project}
          currentBeat={transport.currentBeat}
          selectedTrackId={selectedTrackId}
          selectedClipId={selectedClipId}
          selectedClipIds={selectedClipIds}
          onSelectClips={setSelectedClipIds}
          onMergeClips={handleMergeSelectedClips}
          onRemoveSpaces={handleRemoveSpaces}
          onDuplicateAndMergeClip={handleDuplicateAndMerge}
          showMasterTrack={showMasterTrack}
          expandedAutomationTrackIds={expandedAutomationTrackIds}
          onToggleAutomationTrackId={handleToggleAutomationLane}
          onSeek={(beat) => engine.seek(beat)}
          onSelectTrack={setSelectedTrackId}
          onSelectClip={(clip) => {
            setSelectedClipId(clip.id);
            setSelectedClipIds([clip.id]);
          }}
          onOpenPianoRoll={(clip, track) => setPianoRollTarget({ clip, track })}
          onUpdateClip={handleUpdateClip}
          onDeleteClip={handleDeleteClip}
          onDuplicateClip={handleDuplicateClip}
          onSplitClip={handleSplitClip}
          onImportAudioFile={(tid, file, atBeat) => void handleImportAudioFile(file, tid, atBeat ?? 0)}
          onUpdateProject={(updates) => pushProjectState({ ...project, ...updates })}
          onUpdateTrack={handleUpdateTrack}
          onAddLane={handleAddLane}
          onDeleteBottomLane={handleDeleteBottomLane}
          onDeleteEmptyLanes={handleDeleteEmptyLanes}
          onMuteLane={handleMuteLane}
          onUnmuteLane={handleUnmuteLane}
          isPlaying={transport.playing}
          onPlay={() => engine.play()}
          onPause={() => engine.pause()}
          onSeparateStems={(trackId, clip) => setStemSeparationTarget({ trackId, clip })}
        />
      </div>

      {/* Bottom Panels (Step Sequencer OR Piano Roll OR Mixer) */}
      {isStepSequencerOpen && (
        <StepSequencer
          engine={engine}
          currentBeat={transport.currentBeat}
          isPlaying={transport.playing}
          selectedTrackId={selectedTrackId}
          onClose={() => setIsStepSequencerOpen(false)}
          onInsertClipToTimeline={(clip) => {
            let drumTrack = project.tracks.find(
              (t) => t.name.toLowerCase().includes("drum") || t.id === selectedTrackId
            );
            let updatedTracks = [...project.tracks];

            if (!drumTrack) {
              drumTrack = createTrack("midi", "Drum Machine", project.tracks.length);
              drumTrack.color = "#f59e0b";
              drumTrack.clips = [clip];
              updatedTracks.push(drumTrack);
            } else {
              const targetId = drumTrack.id;
              updatedTracks = updatedTracks.map((t) =>
                t.id === targetId ? { ...t, clips: [...t.clips, { ...clip, trackId: targetId }] } : t
              );
            }

            const updatedProject: StudioProject = {
              ...project,
              tracks: updatedTracks,
            };
            pushProjectState(updatedProject);
            toast("Pola beat drum berhasil dimasukkan ke timeline!", "success");
          }}
        />
      )}

      {pianoRollTarget && (
        <PianoRoll
          clip={pianoRollTarget.clip}
          track={pianoRollTarget.track}
          engine={engine}
          onClose={() => setPianoRollTarget(null)}
          onUpdateClipNotes={(trackId, clipId, notes) => {
            handleUpdateClip(trackId, clipId, { notes });
            setPianoRollTarget((prev) =>
              prev ? { ...prev, clip: { ...prev.clip, notes } } : null
            );
          }}
        />
      )}

      {isMixerOpen && (
        <Mixer
          project={project}
          trackLevels={trackLevels}
          busLevels={busLevels}
          masterLevel={masterLevel}
          onClose={() => setIsMixerOpen(false)}
          onUpdateTrack={handleUpdateTrack}
          onUpdateBus={handleUpdateBus}
          onAddBus={handleAddBus}
          onUpdateTrackSend={(trackId, sendKey, val) => {
            engine.updateTrackSend(trackId, sendKey, val);
          }}
          onUpdateMaster={(updates) => {
            if (updates.volume !== undefined) {
              const updated: StudioProject = {
                ...project,
                masterTrack: { ...project.masterTrack, volume: updates.volume },
              };
              pushProjectState(updated);
              engine.rebuildAudioGraph();
            }
          }}
          onOpenPluginDialog={(tid) => setPluginDialogTrackId(tid)}
        />
      )}

      {/* Karaoke Teleprompter Dock */}
      {isLyricsOpen && (
        <KaraokeDock
          project={project}
          currentTimeSeconds={transport.currentTimeSeconds}
          currentBeat={transport.currentBeat}
          isPlaying={transport.playing}
          onUpdateProject={(updater) => {
            const next = updater(project);
            pushProjectState(next);
          }}
          onSeekSeconds={(sec) => engine.seekSeconds(sec)}
          onImportAudioFile={handleImportAudioFile}
          onClose={() => setIsLyricsOpen(false)}
        />
      )}

      {/* Inspector / Plugin Dialog */}
      {pluginDialogTrackId && (
        <PluginDialog
          trackId={pluginDialogTrackId}
          project={project}
          onClose={() => setPluginDialogTrackId(null)}
          onUpdateTrack={handleUpdateTrack}
          onUpdatePluginParam={(tid, pid, param, val) => {
            engine.updatePluginParameter(tid, pid, param, val);
          }}
          onTogglePluginBypass={(tid, pid, bypassed) => {
            engine.setPluginBypass(tid, pid, bypassed);
          }}
          onAddPlugin={handleAddPlugin}
          onRemovePlugin={handleRemovePlugin}
        />
      )}

      {/* Export Audio Dialog */}
      {isExportDialogOpen && (
        <ExportDialog
          project={project}
          cachedBuffers={new Map()}
          onClose={() => setIsExportDialogOpen(false)}
        />
      )}

      {/* Project Manager Dialog */}
      {isProjectDialogOpen && (
        <ProjectDialog
          currentProject={project}
          onClose={() => setIsProjectDialogOpen(false)}
          onLoadProject={(p) => {
            pushProjectState(p);
            setSelectedTrackId(p.tracks[0]?.id || "");
            setSelectedClipId(p.tracks[0]?.clips[0]?.id);
            setSelectedClipIds(p.tracks[0]?.clips[0]?.id ? [p.tracks[0].clips[0].id] : []);
          }}
          onNewProject={() => {
            const fresh = createEmptyProject("Proyek Baru");
            pushProjectState(fresh);
            setIsProjectDialogOpen(false);
            toast("Proyek baru dibuat.", "success");
          }}
        />
      )}

      {/* Floating Video Preview Window (Mixcraft 10 standard) */}
      <VideoWindow
        isOpen={isVideoWindowOpen}
        onClose={() => setIsVideoWindowOpen(false)}
        project={project}
        currentTimeSeconds={transport.currentTimeSeconds}
        currentBeat={transport.currentBeat}
        isPlaying={transport.playing}
        onTogglePlay={() => {
          if (transport.playing) engine.pause();
          else engine.play();
        }}
        onImportVideoFile={handleImportVideoFile}
        onAddTextClip={handleAddVideoTextClip}
      />

      {/* MIDI Control Surface Settings & MIDI Learn Dialog (Mixcraft 10 Hlm. 488, 661) */}
      <MidiLearnDialog
        isOpen={isMidiLearnDialogOpen}
        onClose={() => setIsMidiLearnDialogOpen(false)}
        mappings={midiMappings}
        onUpdateMappings={(updated) => {
          setMidiMappings(updated);
          saveMidiMappingsToStorage(updated);
        }}
        isLearningMode={isMidiLearnActive}
        onToggleLearningMode={(active) => {
          setIsMidiLearnActive(active);
          if (!active) setMidiLearningTarget(null);
        }}
        activeTarget={midiLearningTarget}
        onSetActiveTarget={setMidiLearningTarget}
        tracks={project.tracks}
      />

      {/* Mixcraft 10 Separate Music into Stems Dialog (Hlm. 650–652) */}
      {stemSeparationTarget && (
        <StemSeparationDialog
          isOpen={!!stemSeparationTarget}
          onClose={() => setStemSeparationTarget(null)}
          project={project}
          trackId={stemSeparationTarget.trackId}
          clip={stemSeparationTarget.clip}
          onSeparate={handlePerformStemSeparation}
          isProcessing={isStemSeparationProcessing}
          processingProgress={stemSeparationProgress}
          processingStatus={stemSeparationStatus}
        />
      )}
    </div>
  );
}
