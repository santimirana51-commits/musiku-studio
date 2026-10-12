// Nilai EQ disalin dari src/lib/karaoke/equalizer.ts (web) agar ekstensi
// mandiri untuk paket Chrome Web Store. Jaga sinkron manual bila berubah.
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = [
    { name: "flat", label: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "bass", label: "Bass Boost", gains: [6, 5, 4, 3, 1, 0, 0, 0, 0, 0] },
    { name: "pop", label: "Pop", gains: [4, 3, 2, 0, 0, 1, 2, 3, 3, 2] },
    { name: "rock", label: "Rock", gains: [5, 4, 2, 0, -1, -1, 1, 3, 4, 5] },
    { name: "jazz", label: "Jazz", gains: [3, 2, 1, 0, 0, 0, 1, 2, 3, 2] },
    { name: "vocal", label: "Vocal Clear", gains: [-3, -2, -1, 0, 1, 2, 3, 3, 2, 1] },
];
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export function clampDb(v) {
    if (!Number.isFinite(v))
        return 0;
    return Math.min(EQ_MAX_DB, Math.max(EQ_MIN_DB, v));
}
export function presetGains(name) {
    const p = EQ_PRESETS.find((x) => x.name === name);
    return p ? [...p.gains] : null;
}
