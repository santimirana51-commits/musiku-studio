import type {
  StudioProject,
  StudioTrack,
  StudioClip,
  PerformanceSet,
  PerformanceCueQuantize,
} from "./types";

/**
 * Menghitung ketukan (*beat*) aktivasi berikutnya berdasarkan kuantisasi Cue Mixcraft 10 (Hlm. 414–415)
 */
export function getNextCueBeat(
  currentBeat: number,
  cueSetting: PerformanceCueQuantize = "1",
  beatsPerBar = 4
): number {
  if (cueSetting === "instant") return currentBeat;

  const epsilon = 0.001;
  const beat = Math.max(0, currentBeat);

  switch (cueSetting) {
    case "1/4": {
      const step = 0.25;
      const next = Math.ceil((beat + epsilon) / step) * step;
      return Number(next.toFixed(3));
    }
    case "1/2": {
      const step = 0.5;
      const next = Math.ceil((beat + epsilon) / step) * step;
      return Number(next.toFixed(3));
    }
    case "1": {
      const next = Math.ceil(beat + epsilon);
      return Math.max(1, next);
    }
    case "2": {
      const step = 2;
      const next = Math.ceil((beat + epsilon) / step) * step;
      return Math.max(2, next);
    }
    case "4": {
      const barStep = Math.max(1, beatsPerBar);
      const next = Math.ceil((beat + epsilon) / barStep) * barStep;
      return Math.max(barStep, next);
    }
    default:
      return Math.ceil(beat + epsilon);
  }
}

/**
 * Ambil klip yang tersimpan pada slot Performance Panel tertentu untuk sebuah track
 */
export function getTrackPerformanceClip(
  track: StudioTrack,
  slotIndex: number
): StudioClip | null {
  if (track.performanceClips && track.performanceClips[slotIndex] !== undefined) {
    return track.performanceClips[slotIndex];
  }
  // Fallback ke timeline clip pada index tersebut jika ada
  return track.clips[slotIndex] || null;
}

/**
 * Salin klip dari timeline aransemen ke slot Performance Panel (Mixcraft 10 Hlm. 7823)
 */
export function copyTimelineClipToPerformanceSlot(
  track: StudioTrack,
  clip: StudioClip,
  slotIndex: number
): StudioTrack {
  const cloned: StudioClip = {
    ...clip,
    id: `perf_clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    trackId: track.id,
    startBeat: 0, // Performance loop selalu mulai dari beat 0 di dalam slotnya
  };

  const updatedClips = [...(track.performanceClips || [])];
  // Pastikan array cukup panjang
  while (updatedClips.length <= slotIndex) {
    updatedClips.push(null);
  }
  updatedClips[slotIndex] = cloned;

  return {
    ...track,
    performanceClips: updatedClips,
  };
}

/**
 * Buat atau update klip di dalam slot Performance Panel
 */
export function updatePerformanceClipSlot(
  track: StudioTrack,
  slotIndex: number,
  clip: StudioClip | null
): StudioTrack {
  const updatedClips = [...(track.performanceClips || [])];
  while (updatedClips.length <= slotIndex) {
    updatedClips.push(null);
  }
  updatedClips[slotIndex] = clip;
  return {
    ...track,
    performanceClips: updatedClips,
  };
}

/**
 * Rekam klip yang dimainkan di Performance Panel langsung ke Main Clip Grid pada Timeline (Mixcraft 10 Hlm. 414)
 */
export function recordPerformanceClipToTimeline(
  project: StudioProject,
  trackId: string,
  clip: StudioClip,
  atBeat: number
): StudioProject {
  const targetTrack = project.tracks.find((t) => t.id === trackId);
  if (!targetTrack) return project;

  const newTimelineClip: StudioClip = {
    ...clip,
    id: `timeline_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    trackId,
    startBeat: Math.max(0, atBeat),
  };

  const updatedTracks = project.tracks.map((t) => {
    if (t.id !== trackId) return t;
    return {
      ...t,
      clips: [...t.clips, newTimelineClip],
    };
  });

  return {
    ...project,
    tracks: updatedTracks,
  };
}

/**
 * Tambah Set / Adegan baru di sebelah kanan (+Add Set, Hlm. 413)
 */
export function addPerformanceSet(
  project: StudioProject,
  name?: string
): StudioProject {
  const existingSets = project.performanceSets || [];
  const nextIndex = existingSets.length + 1;
  const newSet: PerformanceSet = {
    id: `set_${Date.now()}`,
    name: name || `Set ${nextIndex}`,
    color: "#a855f7",
  };

  return {
    ...project,
    performanceSets: [...existingSets, newSet],
  };
}

/**
 * Hapus Set / Adegan pada index tertentu
 */
export function deletePerformanceSet(
  project: StudioProject,
  setIndex: number
): StudioProject {
  const existingSets = project.performanceSets || [];
  if (existingSets.length <= 1) return project; // Sisakan minimal 1 set

  const updatedSets = existingSets.filter((_, idx) => idx !== setIndex);
  const updatedTracks = project.tracks.map((t) => {
    if (!t.performanceClips) return t;
    const nextClips = t.performanceClips.filter((_, idx) => idx !== setIndex);
    return { ...t, performanceClips: nextClips };
  });

  return {
    ...project,
    performanceSets: updatedSets,
    tracks: updatedTracks,
  };
}

/**
 * Duplikasi Set pada index tertentu
 */
export function duplicatePerformanceSet(
  project: StudioProject,
  setIndex: number
): StudioProject {
  const existingSets = project.performanceSets || [];
  const source = existingSets[setIndex];
  if (!source) return project;

  const duplicatedSet: PerformanceSet = {
    id: `set_${Date.now()}`,
    name: `${source.name} (Copy)`,
    color: source.color,
  };

  const updatedSets = [
    ...existingSets.slice(0, setIndex + 1),
    duplicatedSet,
    ...existingSets.slice(setIndex + 1),
  ];

  const updatedTracks = project.tracks.map((t) => {
    const list = [...(t.performanceClips || [])];
    const sourceClip = list[setIndex];
    const cloned = sourceClip
      ? {
          ...sourceClip,
          id: `perf_clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        }
      : null;
    list.splice(setIndex + 1, 0, cloned);
    return { ...t, performanceClips: list };
  });

  return {
    ...project,
    performanceSets: updatedSets,
    tracks: updatedTracks,
  };
}
