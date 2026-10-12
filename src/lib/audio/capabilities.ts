// Deteksi kemampuan platform Web (Fase 2).
//
// Jujur: mengembalikan boolean apa adanya, tanpa polyfill palsu.
// Android/Windows native akan punya modul capabilities sendiri (Fase 4/5).

export interface WebCapabilities {
  hasAudioElement: boolean;
  hasAudioContext: boolean;
  hasMediaSession: boolean;
  hasIndexedDB: boolean;
  hasPersistentStorage: boolean;
}

export function detectWebCapabilities(): WebCapabilities {
  const g = globalThis as Record<string, unknown>;
  const nav = (g.navigator ?? {}) as Record<string, unknown>;
  const storage = nav.storage as Record<string, unknown> | undefined;
  return {
    hasAudioElement: typeof (g.Audio as unknown) !== "undefined",
    hasAudioContext:
      typeof (g.AudioContext as unknown) !== "undefined" ||
      typeof (g as Record<string, unknown>).webkitAudioContext !== "undefined",
    hasMediaSession: typeof nav.mediaSession !== "undefined",
    hasIndexedDB: typeof (g.indexedDB as unknown) !== "undefined",
    hasPersistentStorage:
      typeof storage?.persist === "function" || typeof storage?.estimate === "function",
  };
}
