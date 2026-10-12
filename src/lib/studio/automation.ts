import type { AutomationPoint, AutomationLane, StudioMarker } from "./types";

/**
 * Mixcraft 10 User Guide Chapter 12 - Automation & Controller Mapping
 * Pure algorithmic functions for multi-parameter automation, instant boost/trim, and tempo mapping.
 */

export interface ParameterBounds {
  min: number;
  max: number;
  defaultValue: number;
  label: string;
  unit: string;
}

export const AUTOMATION_PARAM_CONFIGS: Record<string, ParameterBounds> = {
  volume: {
    min: 0.0,
    max: 1.5,
    defaultValue: 1.0,
    label: "Track Volume",
    unit: "x",
  },
  pan: {
    min: -1.0,
    max: 1.0,
    defaultValue: 0.0,
    label: "Pan (L / R)",
    unit: "",
  },
  reverb: {
    min: 0.0,
    max: 1.0,
    defaultValue: 0.0,
    label: "Aux Reverb Send",
    unit: "",
  },
  delay: {
    min: 0.0,
    max: 1.0,
    defaultValue: 0.0,
    label: "Aux Delay Send",
    unit: "",
  },
  cutoff: {
    min: 20,
    max: 20000,
    defaultValue: 20000,
    label: "Filter Cutoff",
    unit: "Hz",
  },
};

/**
 * Dapatkan batasan nilai (min, max, default) untuk parameter tertentu.
 */
export function getParameterBounds(parameter: string): ParameterBounds {
  return (
    AUTOMATION_PARAM_CONFIGS[parameter] || {
      min: 0.0,
      max: 1.0,
      defaultValue: 0.0,
      label: parameter,
      unit: "",
    }
  );
}

/**
 * Interpolasi nilai automasi secara linear pada posisi beat tertentu (Mixcraft 10 Hlm. 471–476).
 */
export function interpolateAutomationValue(
  points: AutomationPoint[],
  beat: number,
  defaultValue = 1.0
): number {
  if (!points || points.length === 0) return defaultValue;

  const sorted = [...points].sort((a, b) => a.beat - b.beat);

  if (beat <= sorted[0].beat) return sorted[0].value;
  if (beat >= sorted[sorted.length - 1].beat) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (beat >= p1.beat && beat <= p2.beat) {
      const beatSpan = p2.beat - p1.beat;
      if (beatSpan <= 0) return p2.value;
      const frac = (beat - p1.beat) / beatSpan;
      return p1.value + frac * (p2.value - p1.value);
    }
  }

  return sorted[sorted.length - 1].value;
}

/**
 * Alat Penyesuaian Instan Garis Automasi: Boost / Reduce (Mixcraft 10 Hlm. 477–478).
 * Menambahkan delta ke seluruh breakpoint pada jalur automasi, dijepit dalam batas [min, max].
 */
export function adjustAutomationPoints(
  points: AutomationPoint[],
  delta: number,
  min = 0.0,
  max = 1.5
): AutomationPoint[] {
  return points.map((p) => {
    const newVal = Math.max(min, Math.min(max, p.value + delta));
    return {
      ...p,
      value: parseFloat(newVal.toFixed(3)),
    };
  });
}

/**
 * Skala proporsional breakpoint automasi (misal +10% atau -10%) terhadap titik pivot.
 */
export function scaleAutomationPoints(
  points: AutomationPoint[],
  factor: number,
  pivot = 1.0,
  min = 0.0,
  max = 1.5
): AutomationPoint[] {
  return points.map((p) => {
    const newVal = pivot + (p.value - pivot) * factor;
    const clamped = Math.max(min, Math.min(max, newVal));
    return {
      ...p,
      value: parseFloat(clamped.toFixed(3)),
    };
  });
}

/**
 * Pembalikan kurva automasi (Invert Envelope) secara simetris antara min dan max.
 */
export function invertAutomationPoints(
  points: AutomationPoint[],
  min = 0.0,
  max = 1.5
): AutomationPoint[] {
  return points.map((p) => {
    const inverted = max - p.value + min;
    const clamped = Math.max(min, Math.min(max, inverted));
    return {
      ...p,
      value: parseFloat(clamped.toFixed(3)),
    };
  });
}

/**
 * Hitung tempo efektif pada posisi birama tertentu berdasarkan penanda tempo (Mixcraft 10 Hlm. 479).
 */
export function getEffectiveTempoAtBeat(
  baseTempo: number,
  markers: StudioMarker[] | undefined,
  beat: number
): number {
  if (!markers || markers.length === 0) return baseTempo;

  const tempoMarkers = markers
    .filter((m) => typeof m.tempo === "number" && m.tempo > 0 && m.beat <= beat)
    .sort((a, b) => b.beat - a.beat);

  return tempoMarkers[0]?.tempo || baseTempo;
}

/**
 * Menghitung durasi detik fisik antara dua beat dengan memperhitungkan perubahan tempo dinamis.
 */
export function calculateBeatsDurationSeconds(
  startBeat: number,
  endBeat: number,
  baseTempo: number,
  markers: StudioMarker[] = []
): number {
  if (endBeat <= startBeat) return 0;

  // Filter tempo markers within the range [startBeat, endBeat]
  const relevantMarkers = markers
    .filter((m) => typeof m.tempo === "number" && m.tempo > 0 && m.beat > startBeat && m.beat < endBeat)
    .sort((a, b) => a.beat - b.beat);

  let totalSeconds = 0;
  let currentBeat = startBeat;
  let currentTempo = getEffectiveTempoAtBeat(baseTempo, markers, startBeat);

  for (const m of relevantMarkers) {
    const segmentBeats = m.beat - currentBeat;
    totalSeconds += (segmentBeats * 60) / currentTempo;
    currentBeat = m.beat;
    currentTempo = m.tempo!;
  }

  // Final segment from last marker to endBeat
  const remainingBeats = endBeat - currentBeat;
  totalSeconds += (remainingBeats * 60) / currentTempo;

  return totalSeconds;
}
