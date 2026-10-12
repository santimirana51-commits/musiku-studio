/**
 * Markers & Marker List Module
 * Mixcraft 10 User Guide Chapter 14 (Hlm. 524–528) & Hlm. 115, 479 (MC10-ARR-007)
 *
 * Provides timeline marker management, tempo/key/time-signature flags,
 * marker-to-marker loop generation, and playback navigation.
 */

import type { StudioMarker } from "./types";

export const MARKER_PALETTE = [
  { name: "Purple", color: "#8b5cf6" },
  { name: "Pink", color: "#ec4899" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Emerald", color: "#10b981" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Cyan", color: "#06b6d4" },
  { name: "Rose", color: "#f43f5e" },
  { name: "Indigo", color: "#6366f1" },
];

export const STANDARD_KEY_SIGNATURES = [
  "C Major",
  "G Major",
  "D Major",
  "A Major",
  "E Major",
  "B Major",
  "F Major",
  "Bb Major",
  "Eb Major",
  "Ab Major",
  "A Minor",
  "E Minor",
  "B Minor",
  "F# Minor",
  "C# Minor",
  "D Minor",
  "G Minor",
  "C Minor",
];

export const STANDARD_TIME_SIGNATURES: Array<[number, number]> = [
  [4, 4],
  [3, 4],
  [2, 4],
  [6, 8],
  [12, 8],
  [5, 4],
  [7, 8],
];

/**
 * Sorts markers chronologically by their timeline beat.
 */
export function sortMarkers(markers: StudioMarker[]): StudioMarker[] {
  return [...markers].sort((a, b) => a.beat - b.beat);
}

/**
 * Creates a new marker instance.
 */
export function createMarker(
  beat: number,
  name: string = "Marker",
  color: string = "#8b5cf6",
  tempo?: number,
  timeSignature?: [number, number],
  keySignature?: string
): StudioMarker {
  return {
    id: `marker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    beat: Math.max(0, beat),
    color,
    tempo: tempo && tempo >= 20 && tempo <= 320 ? tempo : undefined,
    timeSignature,
    keySignature,
  };
}

/**
 * Updates a marker by its ID and maintains sorted ordering.
 */
export function updateMarker(
  markers: StudioMarker[],
  markerId: string,
  updates: Partial<StudioMarker>
): StudioMarker[] {
  const updated = markers.map((m) => {
    if (m.id !== markerId) return m;
    return {
      ...m,
      ...updates,
      beat: updates.beat !== undefined ? Math.max(0, updates.beat) : m.beat,
    };
  });
  return sortMarkers(updated);
}

/**
 * Deletes a marker by its ID.
 */
export function deleteMarker(markers: StudioMarker[], markerId: string): StudioMarker[] {
  return markers.filter((m) => m.id !== markerId);
}

/**
 * Calculates a loop range between a marker and the following marker.
 * Mixcraft 10 Hlm. 527: "Mixcraft automatically loops playback between the selected marker and the following marker"
 */
export function getMarkerLoopRange(
  markers: StudioMarker[],
  markerId: string,
  maxProjectBeats: number = 64
): { startBeat: number; endBeat: number } | null {
  const sorted = sortMarkers(markers);
  const targetIdx = sorted.findIndex((m) => m.id === markerId);
  if (targetIdx < 0) return null;

  const current = sorted[targetIdx];
  const next = sorted[targetIdx + 1];

  const startBeat = current.beat;
  let endBeat: number;

  if (next && next.beat > startBeat) {
    endBeat = next.beat;
  } else {
    // Default loop span of 16 beats (4 bars) if this is the last marker
    endBeat = Math.max(startBeat + 16, maxProjectBeats);
  }

  return { startBeat, endBeat };
}

/**
 * Navigates to previous or next marker relative to current beat.
 * Mixcraft 10 Hlm. 663: "Play From Previous Marker", "Play From Next Marker"
 */
export function getPreviousAndNextMarker(
  markers: StudioMarker[],
  currentBeat: number
): { previous?: StudioMarker; next?: StudioMarker } {
  const sorted = sortMarkers(markers);
  let previous: StudioMarker | undefined;
  let next: StudioMarker | undefined;

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.beat < currentBeat - 0.05) {
      previous = m;
    } else if (m.beat > currentBeat + 0.05 && !next) {
      next = m;
      break;
    }
  }

  return { previous, next };
}

/**
 * Formats beat offset into Measure.Beat notation (e.g. Bar 1 Beat 1 = 1.1)
 */
export function beatToBarBeat(
  beat: number,
  beatsPerBar: number = 4
): { bar: number; beatInBar: number; display: string } {
  const positiveBeat = Math.max(0, beat);
  const bar = Math.floor(positiveBeat / beatsPerBar) + 1;
  const beatInBar = Math.floor(positiveBeat % beatsPerBar) + 1;
  const fraction = (positiveBeat % 1).toFixed(2).slice(1); // e.g. .25
  const display = `${bar}.${beatInBar}${fraction !== ".00" ? fraction : ""}`;
  return { bar, beatInBar, display };
}
