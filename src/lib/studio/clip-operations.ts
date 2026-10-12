import type { StudioClip, StudioProject, StudioTrack, MidiNote } from "./types";

/**
 * Mixcraft 10 Clip Operations: Merging, Removing Spaces, Auto-Crossfades, and Double-Length
 * Mapped against Mixcraft 10 User Guide (Hlm. 210–212, 221–222, 703).
 */

/**
 * Merges two or more clips on the same track into a single contiguous clip.
 * Mixcraft 10 User Guide Hlm. 210–211, 703 ([CTRL]+W):
 * "Merges the selected clips into a new clip. This functions on a per-track basis and does not combine clips from different tracks."
 */
export function mergeClipsOnTrack(
  track: StudioTrack,
  clipIds: string[]
): { updatedTrack: StudioTrack; mergedClip: StudioClip | null } {
  if (clipIds.length < 2) {
    const single = track.clips.find((c) => clipIds.includes(c.id)) ?? null;
    return { updatedTrack: track, mergedClip: single };
  }

  const selectedClips = track.clips
    .filter((c) => clipIds.includes(c.id))
    .sort((a, b) => a.startBeat - b.startBeat);

  if (selectedClips.length < 2) {
    return { updatedTrack: track, mergedClip: null };
  }

  const minStartBeat = Math.min(...selectedClips.map((c) => c.startBeat));
  const maxEndBeat = Math.max(...selectedClips.map((c) => c.startBeat + c.durationBeats));
  const totalDurationBeats = Math.max(0.25, maxEndBeat - minStartBeat);

  const firstClip = selectedClips[0];
  const mergedId = `clip_merged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const mergedName = `${firstClip.name.replace(/ \(Merged\)$/, "")} (Merged)`;

  let mergedNotes: MidiNote[] | undefined;

  if (track.type === "midi") {
    // Combine all notes from all selected clips, adjusting startBeat relative to minStartBeat
    const allNotes: MidiNote[] = [];
    for (const clip of selectedClips) {
      const clipOffsetFromMin = clip.startBeat - minStartBeat;
      if (clip.notes && clip.notes.length > 0) {
        for (const note of clip.notes) {
          allNotes.push({
            ...note,
            id: `note_${mergedId}_${allNotes.length}`,
            startBeat: Math.max(0, clipOffsetFromMin + note.startBeat),
          });
        }
      }
    }
    // Sort combined notes by startBeat
    allNotes.sort((a, b) => a.startBeat - b.startBeat);
    mergedNotes = allNotes;
  }

  const mergedClip: StudioClip = {
    id: mergedId,
    trackId: track.id,
    type: firstClip.type,
    name: mergedName,
    color: firstClip.color ?? track.color,
    startBeat: minStartBeat,
    durationBeats: totalDurationBeats,
    offsetBeat: 0,
    gain: 1.0,
    laneIndex: firstClip.laneIndex ?? 0,
    muted: false,
    notes: mergedNotes,
    assetId: firstClip.assetId,
    pitchShiftSemitones: firstClip.pitchShiftSemitones,
  };

  // Replace merged clips on track
  const remainingClips = track.clips.filter((c) => !clipIds.includes(c.id));
  const updatedClips = [...remainingClips, mergedClip].sort((a, b) => a.startBeat - b.startBeat);

  return {
    updatedTrack: {
      ...track,
      clips: updatedClips,
    },
    mergedClip,
  };
}

/**
 * Removes spaces and silence between selected clips by moving them consecutively.
 * Mixcraft 10 User Guide Hlm. 703 ([CTRL]+J):
 * "Removing space between the clips eliminates gaps or silence between selected clips by moving the selected clips together."
 */
export function removeSpacesBetweenClips(
  track: StudioTrack,
  clipIds?: string[]
): StudioTrack {
  const targetIds = clipIds && clipIds.length >= 2 ? clipIds : track.clips.map((c) => c.id);
  if (targetIds.length < 2) return track;

  const targetClips = track.clips
    .filter((c) => targetIds.includes(c.id))
    .sort((a, b) => a.startBeat - b.startBeat);

  if (targetClips.length < 2) return track;

  const nonTargetClips = track.clips.filter((c) => !targetIds.includes(c.id));

  // First clip stays at its original startBeat
  const packedClips: StudioClip[] = [targetClips[0]];
  let currentEndBeat = targetClips[0].startBeat + targetClips[0].durationBeats;

  for (let i = 1; i < targetClips.length; i++) {
    const originalClip = targetClips[i];
    const packedClip: StudioClip = {
      ...originalClip,
      startBeat: currentEndBeat,
    };
    packedClips.push(packedClip);
    currentEndBeat += packedClip.durationBeats;
  }

  const finalClips = [...nonTargetClips, ...packedClips].sort((a, b) => a.startBeat - b.startBeat);

  return {
    ...track,
    clips: finalClips,
  };
}

/**
 * Automatically calculates and applies equal-power crossfades between overlapping clips.
 * Mixcraft 10 User Guide Hlm. 221–222:
 * "Simply drag one sound over another and a crossfade is instantly and visibly created.
 * The length of the crossfade corresponds to the size of the overlap of neighboring clips."
 */
export function applyAutoCrossfades(track: StudioTrack): StudioTrack {
  if (track.clips.length < 2) return track;

  const sortedClips = [...track.clips].sort((a, b) => a.startBeat - b.startBeat);
  const updatedClips = sortedClips.map((c) => ({ ...c }));

  for (let i = 0; i < updatedClips.length - 1; i++) {
    const clipA = updatedClips[i];
    const clipB = updatedClips[i + 1];

    // Only crossfade clips sharing the same lane (or default lane)
    const laneA = clipA.laneIndex ?? 0;
    const laneB = clipB.laneIndex ?? 0;
    if (laneA !== laneB) continue;

    const clipAEnd = clipA.startBeat + clipA.durationBeats;
    const overlapBeats = clipAEnd - clipB.startBeat;

    if (overlapBeats > 0.01) {
      // Overlap detected: crossfade length matches overlap duration
      const crossfadeDuration = Math.min(
        overlapBeats,
        clipA.durationBeats,
        clipB.durationBeats
      );
      clipA.fadeOutBeats = crossfadeDuration;
      clipB.fadeInBeats = crossfadeDuration;
    }
  }

  return {
    ...track,
    clips: updatedClips,
  };
}

/**
 * Duplicates the current clip and merges them, creating one large double-length clip.
 * Mixcraft 10 User Guide Hlm. 5453, 6371:
 * "Duplicates the current clip and merges them, creating one large double-length clip."
 */
export function duplicateAndMergeClip(
  track: StudioTrack,
  clipId: string
): { updatedTrack: StudioTrack; doubleClip: StudioClip | null } {
  const clip = track.clips.find((c) => c.id === clipId);
  if (!clip) return { updatedTrack: track, doubleClip: null };

  const doubleDuration = clip.durationBeats * 2;
  const doubleId = `clip_dbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let doubleNotes: MidiNote[] | undefined;
  if (track.type === "midi" && clip.notes) {
    const secondPassNotes = clip.notes.map((n, idx) => ({
      ...n,
      id: `note_dbl_${idx}_${Date.now()}`,
      startBeat: n.startBeat + clip.durationBeats,
    }));
    doubleNotes = [...clip.notes, ...secondPassNotes].sort((a, b) => a.startBeat - b.startBeat);
  }

  const doubleClip: StudioClip = {
    ...clip,
    id: doubleId,
    durationBeats: doubleDuration,
    name: `${clip.name} (2x)`,
    notes: doubleNotes,
  };

  const remainingClips = track.clips.filter((c) => c.id !== clipId);
  const updatedClips = [...remainingClips, doubleClip].sort((a, b) => a.startBeat - b.startBeat);

  return {
    updatedTrack: {
      ...track,
      clips: updatedClips,
    },
    doubleClip,
  };
}

/**
 * Batch project-level helper to merge selected clips on a specific track
 */
export function mergeSelectedClipsInProject(
  project: StudioProject,
  trackId: string,
  clipIds: string[]
): { project: StudioProject; mergedClip: StudioClip | null } {
  const trackIndex = project.tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1) return { project, mergedClip: null };

  const track = project.tracks[trackIndex];
  const { updatedTrack, mergedClip } = mergeClipsOnTrack(track, clipIds);

  const updatedTracks = [...project.tracks];
  updatedTracks[trackIndex] = updatedTrack;

  return {
    project: {
      ...project,
      tracks: updatedTracks,
    },
    mergedClip,
  };
}

/**
 * Batch project-level helper to remove spaces between clips on a track
 */
export function removeSpacesInProject(
  project: StudioProject,
  trackId: string,
  clipIds?: string[]
): StudioProject {
  const trackIndex = project.tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1) return project;

  const track = project.tracks[trackIndex];
  const updatedTrack = removeSpacesBetweenClips(track, clipIds);

  const updatedTracks = [...project.tracks];
  updatedTracks[trackIndex] = updatedTrack;

  return {
    ...project,
    tracks: updatedTracks,
  };
}
