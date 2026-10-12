// Arbitrasi sumber: beberapa tab bisa audible bersamaan — jangan berasumsi
// satu tab selalu benar. Prioritas: pilihan eksplisit user > tab audible yang
// juga aktif (focused) > tab audible terbaru > local > null.

import type { SourceState } from "./media-types.js";

export interface TabCandidate {
  tabId: number;
  audible: boolean;
  active: boolean;
  lastSeen: number; // epoch ms
}

/** Pilih tab terbaik di antara kandidat audible. */
export function pickAudibleTab(cands: TabCandidate[]): number | null {
  const audible = cands.filter((c) => c.audible);
  if (audible.length === 0) return null;
  const activeAudible = audible.filter((c) => c.active);
  const pool = activeAudible.length > 0 ? activeAudible : audible;
  pool.sort((a, b) => b.lastSeen - a.lastSeen);
  return pool[0].tabId;
}

/** Sumber aktif = pilihan user bila masih ada, sonst hasil arbitrasi. */
export function resolveActiveSource(
  sources: SourceState[],
  selectedId: string | null,
  audibleTabId: number | null
): string | null {
  if (selectedId && sources.some((s) => s.id === selectedId)) return selectedId;
  if (audibleTabId !== null) {
    const tid = `tab:${audibleTabId}`;
    if (sources.some((s) => s.id === tid)) return tid;
  }
  if (sources.some((s) => s.id === "local")) return "local";
  return sources[0]?.id ?? null;
}

/** Apakah origin ini target integrasi MusikKu (butuh izin host opsional). */
export function isMusikuUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      /(^|\.)musiku\./.test(u.hostname)
    );
  } catch {
    return false;
  }
}
