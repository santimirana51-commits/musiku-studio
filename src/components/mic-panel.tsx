"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Mic, MicOff, RotateCcw, RefreshCw } from "lucide-react";
import { MicController, type MicDevice, type MicPermissionState } from "@/lib/karaoke/mic";
import { MicEffectsChain } from "@/lib/karaoke/audio-effects";
import {
  EQ_BANDS,
  EQ_PRESETS,
  DEFAULT_EQ_SETTINGS,
  clampDb,
  matchPreset,
  loadEqSettings,
  saveEqSettings,
  type EqSettings,
} from "@/lib/karaoke/equalizer";

const PERMISSION_TEXT: Record<MicPermissionState, string> = {
  unknown: "Izin mikrofon belum diminta.",
  prompt: "Menunggu jawaban izin mikrofon…",
  granted: "Mikrofon aktif. Suara hanya diproses lokal, tidak direkam/diunggah.",
  denied: "Izin mikrofon ditolak.",
  unsupported: "Browser/perangkat tidak mendukung mikrofon.",
  "no-device": "Mikrofon tidak ditemukan.",
};

/**
 * Mode mikrofon + Equalizer & efek vokal (lokal, Web Audio API).
 *
 * KEJUJURAN: seluruh kontrol di bawah HANYA memproses suara mikrofon.
 * Audio video YouTube berjalan di iframe cross-origin yang dilindungi
 * same-origin policy sehingga mustahil dibaca/diubah aplikasi — tidak ada
 * kontrol palsu untuk itu (lihat kotak info di bawah).
 */
export function MicPanel() {
  const ctrlRef = useRef<MicController | null>(null);
  if (!ctrlRef.current) ctrlRef.current = new MicController();
  const chainRef = useRef<MicEffectsChain | null>(null);

  const [running, setRunning] = useState(false);
  const [permission, setPermission] = useState<MicPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [detecting, setDetecting] = useState(false);
  const [fx, setFx] = useState<EqSettings>(DEFAULT_EQ_SETTINGS);
  const supported = MicController.supported();

  const detect = async () => {
    if (!supported) return;
    setDetecting(true);
    try {
      const list = await MicController.listMicrophones();
      setDevices(list);
      // Pertahankan pilihan bila masih ada; default = perangkat pertama.
      setDeviceId((prev) => (list.some((d) => d.deviceId === prev) ? prev : (list[0]?.deviceId ?? "")));
      if (list.length === 0) setError("Tidak ada mikrofon terdeteksi di perangkat ini.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mendeteksi mikrofon.");
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    setFx(loadEqSettings());
    void detect();
    const ctrl = ctrlRef.current!;
    const chain = chainRef.current;
    return () => {
      // Bersihkan SEMUA: rantai efek, context, track — saat tutup/unmount.
      try { chain?.dispose(); } catch {}
      chainRef.current = null;
      ctrl.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: EqSettings) => {
    setFx(next);
    saveEqSettings(next);
  };

  const toggle = async () => {
    const ctrl = ctrlRef.current!;
    setError(null);
    if (ctrl.isRunning) {
      try { chainRef.current?.dispose(); } catch {}
      chainRef.current = null;
      ctrl.stop();
      setRunning(false);
      setPermission(ctrl.permission);
      setLevel(0);
      return;
    }
    setPermission("prompt");
    try {
      await ctrl.start((lv) => setLevel(lv), deviceId ? { deviceId } : {});
      // Sesudah izin diberikan browser membuka label asli — deteksi ulang.
      void detect();
      const stream = ctrl.getStream();
      if (stream) {
        const chain = new MicEffectsChain();
        await chain.init(stream, fx);
        chainRef.current = chain;
      }
      setRunning(true);
      setPermission(ctrl.permission);
    } catch (e) {
      try { chainRef.current?.dispose(); } catch {}
      chainRef.current = null;
      setPermission(ctrl.permission);
      setError(e instanceof Error ? e.message : "Gagal mengakses mikrofon.");
    }
  };

  const setGains = (gains: number[], preset: string) => {
    const next = { ...fx, gains, preset };
    chainRef.current?.applyParams(next);
    persist(next);
  };

  const applyPreset = (name: string) => {
    const p = EQ_PRESETS.find((x) => x.name === name);
    if (!p) return;
    setGains([...p.gains], name);
  };

  const tweak = (patch: Partial<EqSettings>) => {
    const next = { ...fx, ...patch, preset: patch.gains ? (matchPreset(patch.gains) ?? "custom") : fx.preset };
    chainRef.current?.applyParams(next);
    persist(next);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-card p-4" aria-label="Mode mikrofon dan equalizer">
      {/* Mic on/off */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Mode Mikrofon (opsional)</h3>
          <p className="mt-0.5 text-xs text-zinc-400" role="status">{PERMISSION_TEXT[permission]}</p>
        </div>
        <button
          onClick={toggle}
          disabled={!supported}
          aria-pressed={running}
          title={!supported ? "Fitur belum tersedia di browser ini" : running ? "Matikan mikrofon" : "Nyalakan mikrofon"}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          {running ? "Berhenti" : "Mulai"}
        </button>
      </div>
      {running && (
        <div aria-label="Level suara masuk">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width]"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Deteksi perangkat */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-2.5">
        <span className="text-xs font-bold text-zinc-200" role="status">
          {detecting
            ? "Mendeteksi mikrofon…"
            : devices.length === 0
              ? "Belum ada mikrofon terdeteksi"
              : `${devices.length} mikrofon terdeteksi`}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={running || devices.length === 0}
            aria-label="Pilih mikrofon"
            title={running ? "Matikan mic dulu untuk ganti perangkat" : "Pilih mikrofon"}
            className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {devices.length === 0 && <option value="">— tidak ada perangkat —</option>}
            {devices.map((d) => (
              <option key={d.deviceId || d.label} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void detect()}
            disabled={detecting}
            aria-label="Deteksi ulang mikrofon"
            title="Deteksi ulang mikrofon"
            className="rounded-lg bg-white/10 p-2 text-zinc-200 hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${detecting ? "animate-spin" : ""}`} aria-hidden />
          </button>
        </div>
        <p className="w-full text-[11px] text-zinc-500">
          Label asli muncul setelah izin diberikan (aturan privasi browser).
        </p>
      </div>

      {/* Equalizer */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Equalizer vokal {running ? "" : "(aktif setelah mic dinyalakan)"}
          </h4>
          <button
            onClick={() => setGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "flat")}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/15"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Preset equalizer">
          {EQ_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.name)}
              aria-pressed={fx.preset === p.name}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                fx.preset === p.name
                  ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                  : "bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
          {fx.preset === "custom" && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-fuchsia-200">Custom</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label="Slider frekuensi equalizer">
          {EQ_BANDS.map((b, i) => (
            <label key={b.freq} className="flex flex-col items-center gap-1">
              <span className="font-mono text-[11px] font-bold text-fuchsia-200" aria-live="off">
                {fx.gains[i] > 0 ? `+${fx.gains[i]}` : fx.gains[i]} dB
              </span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={fx.gains[i]}
                onChange={(e) => {
                  const gains = fx.gains.slice();
                  gains[i] = clampDb(Number(e.target.value));
                  setGains(gains, matchPreset(gains) ?? "custom");
                }}
                aria-label={`Equalizer ${b.label}`}
                className="h-24 w-full"
                style={{ writingMode: "vertical-lr", direction: "rtl" } as CSSProperties}
              />
              <span className="text-[10px] text-zinc-400">{b.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Efek mic */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            { key: "echo", label: "Echo", value: fx.echo, hint: "Gaung tunda" },
            { key: "reverb", label: "Reverb", value: fx.reverb, hint: "Gema ruangan" },
            { key: "micVolume", label: "Volume mic", value: fx.micVolume, hint: "0–150%" },
          ] as const
        ).map((c) => (
          <label key={c.key} className="rounded-xl bg-white/5 p-2.5">
            <span className="flex justify-between text-[11px] font-bold text-zinc-200">
              {c.label}
              <span className="font-mono text-fuchsia-200">
                {c.key === "micVolume" ? `${Math.round(c.value * 100)}%` : `${Math.round(c.value * 100)}%`}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={c.key === "micVolume" ? 1.5 : 1}
              step={0.05}
              value={c.value}
              onChange={(e) => tweak({ [c.key]: Number(e.target.value) } as Partial<EqSettings>)}
              aria-label={`${c.label} mikrofon (${c.hint})`}
              className="mt-1 w-full"
            />
          </label>
        ))}
      </div>
      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={fx.monitor}
          onChange={(e) => tweak({ monitor: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Monitor: dengar suara sendiri lewat speaker. <strong>Gunakan headphone</strong> agar
          tidak feedback (suara melengking).
        </span>
      </label>

      {/* Kejujuran sumber */}
      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-zinc-400">
        EQ &amp; efek di atas <strong className="text-zinc-200">memproses suara mikrofon Anda</strong>.
        Untuk menyetel equalizer musik pengiring / backing track YouTube, gunakan modul <strong>YouTube EQ</strong> di atas (dengan penangkapan audio tab atau ekstensi Chrome YouTube EQ).
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Preferensi tersimpan otomatis di perangkat ini. Penilaian pitch & ketepatan waktu:
        belum tersedia — level meter adalah data input mentah, bukan skor.
      </p>
    </section>
  );
}
