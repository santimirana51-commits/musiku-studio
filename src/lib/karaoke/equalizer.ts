// Equalizer 10-band + preset + persistensi untuk mode karaoke.
//
// Batasan kejujuran (lihat juga docs/karaoke.md):
// - EQ ini HANYA memproses sinyal mikrofon lokal via Web Audio API.
// - Audio video YouTube berjalan di iframe cross-origin yang dilindungi
//   same-origin policy: tidak dapat dibaca/dimodifikasi aplikasi.
//   Jangan pernah mengklaim/menampilkan seolah EQ mengubah suara YouTube.

export interface EqBand {
  freq: number; // Hz
  label: string;
}

export const EQ_BANDS: EqBand[] = [
  { freq: 32, label: "32 Hz" },
  { freq: 64, label: "64 Hz" },
  { freq: 125, label: "125 Hz" },
  { freq: 250, label: "250 Hz" },
  { freq: 500, label: "500 Hz" },
  { freq: 1000, label: "1 kHz" },
  { freq: 2000, label: "2 kHz" },
  { freq: 4000, label: "4 kHz" },
  { freq: 8000, label: "8 kHz" },
  { freq: 16000, label: "16 kHz" },
];

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

export function clampDb(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(EQ_MAX_DB, Math.max(EQ_MIN_DB, v));
}

export interface EqPreset {
  name: string;
  label: string;
  gains: number[]; // 10 nilai dB sesuai urutan EQ_BANDS
}

export const EQ_PRESETS: EqPreset[] = [
  { name: "flat", label: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "bass", label: "Bass Boost", gains: [6, 5, 4, 3, 1, 0, 0, 0, 0, 0] },
  { name: "vocal", label: "Vocal Clear", gains: [-3, -2, -1, 0, 1, 2, 3, 3, 2, 1] },
  { name: "pop", label: "Pop", gains: [4, 3, 2, 0, 0, 1, 2, 3, 3, 2] },
  { name: "rock", label: "Rock", gains: [5, 4, 2, 0, -1, -1, 1, 3, 4, 5] },
  { name: "jazz", label: "Jazz", gains: [3, 2, 1, 0, 0, 0, 1, 2, 3, 2] },
];

export function getPreset(name: string): EqPreset | null {
  return EQ_PRESETS.find((p) => p.name === name) ?? null;
}

/** true bila gains sama persis dengan salah satu preset (untuk label). */
export function matchPreset(gains: number[]): string | null {
  for (const p of EQ_PRESETS) {
    if (p.gains.length === gains.length && p.gains.every((g, i) => g === gains[i])) {
      return p.name;
    }
  }
  return null;
}

// ---------- persistensi (localStorage, sesuai pola storage.ts) ----------

const EQ_KEY = "musikku:eq-settings";

export interface EqSettings {
  preset: string; // nama preset atau "custom"
  gains: number[];
  echo: number; // 0..1 mix
  reverb: number; // 0..1 mix
  micVolume: number; // 0..1.5
  monitor: boolean;
}

export const DEFAULT_EQ_SETTINGS: EqSettings = {
  preset: "flat",
  gains: [...EQ_PRESETS[0].gains],
  echo: 0.25,
  reverb: 0.3,
  micVolume: 0.8,
  monitor: false,
};

function cleanGains(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== EQ_BANDS.length) return [...DEFAULT_EQ_SETTINGS.gains];
  return raw.map((v) => clampDb(typeof v === "number" ? v : 0));
}

function clean01(raw: unknown, fallback: number): number {
  const v = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  return Math.min(1, Math.max(0, v));
}

export function loadEqSettings(): EqSettings {
  try {
    if (typeof localStorage === "undefined") return { ...DEFAULT_EQ_SETTINGS, gains: [...DEFAULT_EQ_SETTINGS.gains] };
    let raw = localStorage.getItem(EQ_KEY);
    if (!raw) {
      const ytRaw = localStorage.getItem("musikku:youtube-eq");
      if (ytRaw) {
        try {
          const ytObj = JSON.parse(ytRaw);
          if (Array.isArray(ytObj.gains10)) {
            raw = JSON.stringify({ preset: ytObj.preset, gains: ytObj.gains10 });
          }
        } catch {}
      }
    }
    if (!raw) return { ...DEFAULT_EQ_SETTINGS, gains: [...DEFAULT_EQ_SETTINGS.gains] };
    const j = JSON.parse(raw) as Partial<EqSettings>;
    const gains = cleanGains(j.gains);
    return {
      preset: typeof j.preset === "string" ? j.preset : matchPreset(gains) ?? "custom",
      gains,
      echo: clean01(j.echo, DEFAULT_EQ_SETTINGS.echo),
      reverb: clean01(j.reverb, DEFAULT_EQ_SETTINGS.reverb),
      micVolume: Math.min(1.5, Math.max(0, typeof j.micVolume === "number" && Number.isFinite(j.micVolume) ? j.micVolume : DEFAULT_EQ_SETTINGS.micVolume)),
      monitor: false, // monitor selalu mati awal (anti feedback mendadak)
    };
  } catch {
    return { ...DEFAULT_EQ_SETTINGS, gains: [...DEFAULT_EQ_SETTINGS.gains] };
  }
}

export function saveEqSettings(s: EqSettings): void {
  try {
    const clampedGains = s.gains.map(clampDb);
    localStorage.setItem(
      EQ_KEY,
      JSON.stringify({ ...s, gains: clampedGains, monitor: false })
    );
    localStorage.setItem(
      "musikku:youtube-eq",
      JSON.stringify({
        enabled: true,
        bandCount: 10,
        preset: s.preset,
        preamp: 0,
        gains10: clampedGains,
      })
    );
    localStorage.setItem("musikku:local-eq", JSON.stringify(clampedGains));
  } catch {}
}
