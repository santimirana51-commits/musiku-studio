"use client";

import { useEffect, useState } from "react";
import { Sliders, RotateCcw, Check, Info, Music, Volume2 } from "lucide-react";
import { useToast } from "@/components/toast";
import {
  EQ_BANDS,
  EQ_MIN_DB,
  EQ_MAX_DB,
  EQ_PRESETS,
  getPreset,
  matchPreset,
  loadEqSettings,
  saveEqSettings,
  type EqSettings,
} from "@/lib/karaoke/equalizer";

export default function EqualizerPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EqSettings>(() => loadEqSettings());
  const [activePreset, setActivePreset] = useState<string>("flat");

  useEffect(() => {
    const s = loadEqSettings();
    setSettings(s);
    setActivePreset(s.preset);
  }, []);

  const handleBandChange = (index: number, value: number) => {
    const nextGains = [...settings.gains];
    nextGains[index] = value;
    const matched = matchPreset(nextGains) ?? "custom";
    const nextSettings: EqSettings = {
      ...settings,
      gains: nextGains,
      preset: matched,
    };
    setSettings(nextSettings);
    setActivePreset(matched);
    saveEqSettings(nextSettings);
    // Simpan juga ke local player storage agar langsung diterapkan
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(nextGains));
    } catch {}
  };

  const handleApplyPreset = (presetName: string) => {
    const p = getPreset(presetName);
    if (!p) return;
    const nextSettings: EqSettings = {
      ...settings,
      preset: p.name,
      gains: [...p.gains],
    };
    setSettings(nextSettings);
    setActivePreset(p.name);
    saveEqSettings(nextSettings);
    try {
      localStorage.setItem("musikku:local-eq", JSON.stringify(p.gains));
    } catch {}
    toast(`Preset ${p.label} diterapkan.`, "success");
  };

  const handleReset = () => {
    handleApplyPreset("flat");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      {/* Header */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-900/30 via-fuchsia-900/20 to-pink-900/10 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Sliders className="size-6 text-white" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white md:text-2xl">Master Equalizer 10-Band</h1>
            <p className="text-xs text-zinc-400 md:text-sm">
              Atur kurva respons frekuensi audio untuk pemutaran file musik lokal, file cloud, dan pemrosesan mikrofon karaoke.
            </p>
          </div>
        </div>
      </header>

      {/* Capability Banner (Kejujuran Kemampuan Platform — §H & §C) */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 text-emerald-400">
            <Check className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-emerald-300">Didukung Penuh (Web Audio API)</h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Aktif pada file lagu <strong>Lokal (IndexedDB)</strong>, <strong>Cloud (Supabase Storage)</strong>, dan pemrosesan <strong>Mikrofon Karaoke</strong>. Filter Biquad 10-band disisipkan langsung pada jalur audio.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <div className="mt-0.5 rounded-full bg-amber-500/20 p-1 text-amber-400">
            <Info className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-amber-300">Tidak Didukung pada YouTube</h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Sesuai aturan keamanan peramban (Same-Origin Policy), audio dari <strong>YouTube IFrame</strong> terisolasi dan tidak dapat dicegat atau dimodifikasi oleh filter EQ. MusikKu tidak membuat klaim palsu.
            </p>
          </div>
        </div>
      </section>

      {/* Preset Selector */}
      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Preset Equalizer">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-violet-400" />
            <span className="text-sm font-bold text-white">Preset Suara</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300 uppercase">
              {activePreset}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
          >
            <RotateCcw className="size-3.5" />
            Reset ke Flat
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {EQ_PRESETS.map((p) => {
            const isSelected = activePreset === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.name)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  isSelected
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30"
                    : "border border-white/10 bg-charcoal text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 10-Band EQ Sliders */}
      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="10 Band Sliders">
        <h2 className="mb-6 font-bold text-white">Frekuensi 10-Band (-12 dB hingga +12 dB)</h2>

        <div className="grid grid-cols-5 gap-4 sm:grid-cols-10">
          {EQ_BANDS.map((band, idx) => {
            const gain = settings.gains[idx] ?? 0;
            return (
              <div key={band.freq} className="flex flex-col items-center gap-3">
                <span className="font-mono text-[11px] font-semibold text-violet-300">
                  {gain > 0 ? `+${gain}` : gain} dB
                </span>

                <div className="relative flex h-48 w-8 items-center justify-center">
                  <input
                    type="range"
                    min={EQ_MIN_DB}
                    max={EQ_MAX_DB}
                    step={1}
                    value={gain}
                    onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                    className="h-40 w-2 cursor-pointer rounded-full bg-charcoal accent-violet-500"
                  />
                </div>

                <div className="text-center">
                  <span className="block font-mono text-[10px] text-zinc-400">{band.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
