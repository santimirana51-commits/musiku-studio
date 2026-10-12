/**
 * Track Regions & Song Section Re-Arranger Module
 * Mixcraft 10 User Guide Chapter 7 (Hlm. 199–202) (MC10-ADV-104)
 *
 * Enables master and submix song section re-tooling:
 * - Splitting song sections at the playhead
 * - Moving entire song sections (all clips, MIDI notes, and automation across all tracks)
 * - [Alt]+Drag duplication of song sections
 * - Ripple delete of song sections
 */

import type { StudioProject, StudioTrack, StudioClip, TrackRegion } from "./types";

export const DEFAULT_SECTION_COLORS = [
  "#8b5cf6", // Purple (Intro)
  "#3b82f6", // Blue (Verse)
  "#ec4899", // Pink (Chorus)
  "#10b981", // Emerald (Solo)
  "#f59e0b", // Amber (Bridge)
  "#06b6d4", // Cyan (Outro)
  "#e11d48", // Rose
];

/**
 * Splits a track region at a specific beat position.
 * Mixcraft 10 Hlm. 200: "Place the Caret at the beginning/end of the chorus, right-click, Split"
 */
export function splitRegionAtBeat(regions: TrackRegion[], splitBeat: number): TrackRegion[] {
  if (splitBeat <= 0) return regions;

  const targetIdx = regions.findIndex(
    (r) => splitBeat > r.startBeat && splitBeat < r.endBeat
  );

  if (targetIdx < 0) {
    // If exact boundary or outside, return unchanged
    return regions;
  }

  const target = regions[targetIdx];
  const color = target.color || DEFAULT_SECTION_COLORS[targetIdx % DEFAULT_SECTION_COLORS.length];

  const part1: TrackRegion = {
    ...target,
    id: `${target.id}_p1`,
    name: target.name,
    startBeat: target.startBeat,
    endBeat: splitBeat,
    color,
  };

  const part2: TrackRegion = {
    ...target,
    id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${target.name} (Part 2)`,
    startBeat: splitBeat,
    endBeat: target.endBeat,
    color,
  };

  const result = [...regions];
  result.splice(targetIdx, 1, part1, part2);
  return result.sort((a, b) => a.startBeat - b.startBeat);
}

/**
 * Moves or duplicates an entire track region and all clips/automation underneath.
 * Mixcraft 10 Hlm. 200:
 * - Drag: moves all clips beneath
 * - [ALT]+Drag: duplicates all clips and region/lane automation
 */
export function moveRegionAndClips(
  project: StudioProject,
  regionId: string,
  deltaBeats: number,
  isCopy: boolean = false
): StudioProject {
  const regions = project.regions || [];
  const targetRegion = regions.find((r) => r.id === regionId);
  if (!targetRegion || deltaBeats === 0) return project;

  const origStart = targetRegion.startBeat;
  const origEnd = targetRegion.endBeat;
  const effectiveDelta = Math.max(-origStart, deltaBeats);
  const newStart = origStart + effectiveDelta;
  const newEnd = origEnd + effectiveDelta;

  // Process tracks and clips
  const updatedTracks: StudioTrack[] = project.tracks.map((track) => {
    // If region is scoped to a specific submix, only affect tracks in that submix
    if (targetRegion.submixId && track.submixTrackId !== targetRegion.submixId) {
      return track;
    }

    // Filter clips belonging to this region's time range
    const clipsToProcess = track.clips.filter(
      (c) => c.startBeat >= origStart && c.startBeat < origEnd
    );

    if (clipsToProcess.length === 0) return track;

    if (isCopy) {
      // Duplicate clips at new position
      const duplicatedClips: StudioClip[] = clipsToProcess.map((c) => ({
        ...c,
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        startBeat: Math.max(0, c.startBeat + effectiveDelta),
        notes: c.notes ? c.notes.map((n) => ({ ...n, id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` })) : undefined,
      }));

      // Duplicate automation points within range
      const updatedAutomation = track.automationLanes.map((lane) => {
        const pointsToCopy = lane.points.filter(
          (p) => p.beat >= origStart && p.beat <= origEnd
        );
        const copiedPoints = pointsToCopy.map((p) => ({
          ...p,
          id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          beat: p.beat + effectiveDelta,
        }));
        return {
          ...lane,
          points: [...lane.points, ...copiedPoints].sort((a, b) => a.beat - b.beat),
        };
      });

      return {
        ...track,
        clips: [...track.clips, ...duplicatedClips].sort((a, b) => a.startBeat - b.startBeat),
        automationLanes: updatedAutomation,
      };
    } else {
      // Move existing clips
      const processedClipIds = new Set(clipsToProcess.map((c) => c.id));
      const movedClips: StudioClip[] = track.clips.map((c) => {
        if (!processedClipIds.has(c.id)) return c;
        return {
          ...c,
          startBeat: Math.max(0, c.startBeat + effectiveDelta),
        };
      });

      // Shift automation points
      const updatedAutomation = track.automationLanes.map((lane) => ({
        ...lane,
        points: lane.points.map((p) => {
          if (p.beat >= origStart && p.beat <= origEnd) {
            return { ...p, beat: Math.max(0, p.beat + effectiveDelta) };
          }
          return p;
        }).sort((a, b) => a.beat - b.beat),
      }));

      return {
        ...track,
        clips: movedClips.sort((a, b) => a.startBeat - b.startBeat),
        automationLanes: updatedAutomation,
      };
    }
  });

  // Update regions array
  let updatedRegions: TrackRegion[];
  if (isCopy) {
    const copyRegion: TrackRegion = {
      ...targetRegion,
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${targetRegion.name} (Copy)`,
      startBeat: newStart,
      endBeat: newEnd,
    };
    updatedRegions = [...regions, copyRegion].sort((a, b) => a.startBeat - b.startBeat);
  } else {
    updatedRegions = regions.map((r) => {
      if (r.id !== regionId) return r;
      return {
        ...r,
        startBeat: newStart,
        endBeat: newEnd,
      };
    }).sort((a, b) => a.startBeat - b.startBeat);
  }

  return {
    ...project,
    regions: updatedRegions,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deletes a track region, optionally performing a ripple delete.
 * With ripple=true, deletes clips in that section and shifts subsequent clips backward.
 */
export function deleteRegion(
  project: StudioProject,
  regionId: string,
  ripple: boolean = false
): StudioProject {
  const regions = project.regions || [];
  const target = regions.find((r) => r.id === regionId);
  if (!target) return project;

  const span = target.endBeat - target.startBeat;
  const start = target.startBeat;
  const end = target.endBeat;

  if (!ripple) {
    // Non-ripple: just remove region header, leave clips intact
    return {
      ...project,
      regions: regions.filter((r) => r.id !== regionId),
      updatedAt: new Date().toISOString(),
    };
  }

  // Ripple delete: remove clips in range and shift rightward clips left
  const updatedTracks: StudioTrack[] = project.tracks.map((track) => {
    if (target.submixId && track.submixTrackId !== target.submixId) {
      return track;
    }

    const filteredClips = track.clips
      .filter((c) => !(c.startBeat >= start && c.startBeat < end))
      .map((c) => {
        if (c.startBeat >= end) {
          return { ...c, startBeat: Math.max(0, c.startBeat - span) };
        }
        return c;
      });

    const filteredAutomation = track.automationLanes.map((lane) => ({
      ...lane,
      points: lane.points
        .filter((p) => !(p.beat >= start && p.beat < end))
        .map((p) => {
          if (p.beat >= end) {
            return { ...p, beat: Math.max(0, p.beat - span) };
          }
          return p;
        }),
    }));

    return {
      ...track,
      clips: filteredClips,
      automationLanes: filteredAutomation,
    };
  });

  // Ripple shift remaining regions
  const updatedRegions = regions
    .filter((r) => r.id !== regionId)
    .map((r) => {
      if (r.startBeat >= end) {
        return {
          ...r,
          startBeat: Math.max(0, r.startBeat - span),
          endBeat: Math.max(0, r.endBeat - span),
        };
      }
      return r;
    });

  return {
    ...project,
    regions: updatedRegions,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Finds which song region covers a specific beat.
 */
export function findRegionAtBeat(regions: TrackRegion[], beat: number): TrackRegion | undefined {
  return regions.find((r) => beat >= r.startBeat && beat < r.endBeat);
}
