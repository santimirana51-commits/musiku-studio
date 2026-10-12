"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Music,
  Check,
  Disc,
  FileAudio,
  FolderDown,
} from "lucide-react";
import type { StudioProject } from "@/lib/studio/types";
import {
  exportStudioProject,
  exportProjectStems,
  type ExportOptions,
  type StemExportOptions,
  type ExportedStemFile,
} from "@/lib/studio/export";

interface ExportDialogProps {
  project: StudioProject;
  cachedBuffers: Map<string, AudioBuffer>;
  onClose: () => void;
}

export function ExportDialog({
  project,
  cachedBuffers,
  onClose,
}: ExportDialogProps) {
  const [exportMode, setExportMode] = useState<"master" | "stems">("master");
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);
  const [range, setRange] = useState<"all" | "loop">("all");
  const [normalize, setNormalize] = useState(true);

  // Mix Down To Stems specific options (Mixcraft 10 Hlm. 500–501)
  const initialTrackIds = project.tracks
    .filter((t) => t.type !== "video" && t.type !== "video-text" && t.clips.length > 0)
    .map((t) => t.id);
  const [selectedStemTrackIds, setSelectedStemTrackIds] = useState<string[]>(initialTrackIds);
  const [muteTrackEffects, setMuteTrackEffects] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Results
  const [masterResult, setMasterResult] = useState<{
    blob: Blob;
    durationSeconds: number;
    url: string;
  } | null>(null);

  const [stemsResult, setStemsResult] = useState<{
    stems: (ExportedStemFile & { url: string })[];
  } | null>(null);

  const exportableTracks = project.tracks.filter(
    (t) => t.type !== "video" && t.type !== "video-text" && t.clips.length > 0
  );

  const handleToggleTrack = (trackId: string) => {
    setSelectedStemTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const handleSelectAllTracks = () => {
    setSelectedStemTrackIds(exportableTracks.map((t) => t.id));
  };

  const handleSelectNoneTracks = () => {
    setSelectedStemTrackIds([]);
  };

  const handleStartExport = async () => {
    setExporting(true);
    setError(null);
    setProgressPct(5);
    setProgressStatus("Menyiapkan render audio...");

    try {
      if (exportMode === "master") {
        const opts: ExportOptions = {
          sampleRate,
          bitDepth,
          range,
          normalize,
        };
        const result = await exportStudioProject(project, cachedBuffers, opts);
        const url = URL.createObjectURL(result.blob);
        setMasterResult({
          blob: result.blob,
          durationSeconds: result.durationSeconds,
          url,
        });
      } else {
        // Stems export (Mixcraft 10 Hlm. 500–501)
        if (selectedStemTrackIds.length === 0) {
          throw new Error("Pilih minimal satu track untuk diekspor ke stems.");
        }
        const opts: StemExportOptions = {
          sampleRate,
          bitDepth,
          range,
          normalize,
          selectedTrackIds: selectedStemTrackIds,
          muteTrackEffects,
        };
        const stems = await exportProjectStems(
          project,
          cachedBuffers,
          opts,
          (pct, trackName) => {
            setProgressPct(pct);
            setProgressStatus(`Merender Track: "${trackName}" (${pct}%)...`);
          }
        );

        const stemsWithUrls = stems.map((s) => ({
          ...s,
          url: URL.createObjectURL(s.blob),
        }));
        setStemsResult({ stems: stemsWithUrls });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengekspor audio.");
    } finally {
      setExporting(false);
      setProgressPct(0);
      setProgressStatus("");
    }
  };

  const handleDownloadMaster = () => {
    if (!masterResult) return;
    const a = document.createElement("a");
    a.href = masterResult.url;
    const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.download = `${safeName}-${sampleRate}hz-${bitDepth}bit.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSingleStem = (stem: ExportedStemFile & { url: string }) => {
    const a = document.createElement("a");
    a.href = stem.url;
    a.download = stem.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllStems = () => {
    if (!stemsResult) return;
    stemsResult.stems.forEach((stem, i) => {
      setTimeout(() => {
        handleDownloadSingleStem(stem);
      }, i * 350);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm select-none animate-in fade-in">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-400">
              <Download className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Mix Down To Audio Files
                <span className="text-[10px] font-mono uppercase bg-pink-500/20 text-pink-300 px-2.5 py-0.5 rounded-full border border-pink-500/30 font-semibold">
                  Mixcraft 10 Hlm. 496–505
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Ekspor lagu ke master stereo lossless WAV atau stem trek terpisah untuk audio mixing profesional.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Selection: Master vs Stems (Hlm. 496 vs Hlm. 500) */}
        {!masterResult && !stemsResult && (
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-900/80 rounded-2xl border border-white/5 my-4">
            <button
              type="button"
              onClick={() => setExportMode("master")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                exportMode === "master"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Disc className="size-4" />
              <span>Mix Down To Audio File (Master)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportMode("stems")}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                exportMode === "stems"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers className="size-4" />
              <span>Mix Down To Stems... (Individual Tracks)</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!masterResult && !stemsResult ? (
            <div className="space-y-4">
              {/* Stems Mode: Choose Tracks To Mix (Mixcraft 10 Hlm. 500) */}
              {exportMode === "stems" && (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                        Choose Tracks To Mix
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        Pilih trek yang akan diekspor menjadi berkas audio individual terpisah.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllTracks}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                      >
                        Check All
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectNoneTracks}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
                      >
                        Check None
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {exportableTracks.map((t, idx) => {
                      const isChecked = selectedStemTrackIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? "bg-white/5 border-violet-500/40 text-white"
                              : "bg-transparent border-white/5 text-zinc-400 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTrack(t.id)}
                              className="size-3.5 accent-violet-500 rounded"
                            />
                            <span className="font-mono text-zinc-500 text-[10px]">#{idx + 1}</span>
                            <span className="font-semibold text-zinc-200">{t.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {t.clips.length} clip{t.clips.length > 1 ? "s" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Mute Track Effects (Hlm. 501) */}
                  <label className="flex items-start gap-2.5 pt-2 border-t border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={muteTrackEffects}
                      onChange={(e) => setMuteTrackEffects(e.target.checked)}
                      className="mt-0.5 size-3.5 accent-violet-500 rounded"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">
                        Mute Track Effects (Dry Stems)
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        Nonaktifkan plugin insert effect untuk seluruh track saat ekspor agar mixing engineer menerima stem murni tanpa kompresi/EQ yang terbakar ke file (Mixcraft 10 Hlm. 501).
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Sample Rate (Hlm. 502) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Sample Rate (Frekuensi Pencuplikan):</label>
                <div className="grid grid-cols-2 gap-2">
                  {[44100, 48000].map((sr) => (
                    <button
                      key={sr}
                      type="button"
                      onClick={() => setSampleRate(sr)}
                      className={`rounded-xl border py-2 text-xs font-mono font-bold transition ${
                        sampleRate === sr
                          ? "border-pink-500 bg-pink-500/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {sr === 44100 ? "44.1 kHz (CD Audio)" : "48.0 kHz (Studio Video)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bit Depth (Hlm. 502) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Bit Depth (Kedalaman Bit Lossless):</label>
                <div className="grid grid-cols-2 gap-2">
                  {([16, 24] as const).map((bd) => (
                    <button
                      key={bd}
                      type="button"
                      onClick={() => setBitDepth(bd)}
                      className={`rounded-xl border py-2 text-xs font-mono font-bold transition ${
                        bitDepth === bd
                          ? "border-pink-500 bg-pink-500/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {bd}-bit Linear PCM WAV
                    </button>
                  ))}
                </div>
              </div>

              {/* Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Rentang Rendering:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRange("all")}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      range === "all"
                        ? "border-violet-500 bg-violet-500/20 text-white"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Seluruh Lagu (Timeline)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRange("loop")}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      range === "loop"
                        ? "border-violet-500 bg-violet-500/20 text-white"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Area Loop Penanda Saja
                  </button>
                </div>
              </div>

              {/* Normalization Checkbox */}
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={normalize}
                  onChange={(e) => setNormalize(e.target.checked)}
                  className="size-4 accent-pink-500 rounded"
                />
                <span>Normalisasi puncak sinyal otomatis (-0.3 dB True Peak)</span>
              </label>

              {/* Processing Progress State */}
              {exporting && (
                <div className="p-3.5 rounded-xl bg-pink-950/30 border border-pink-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-pink-300 flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin text-pink-400" />
                      {progressStatus}
                    </span>
                    <span className="font-mono font-bold text-pink-300">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-pink-500 to-violet-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, progressPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Start Render Button */}
              <button
                onClick={handleStartExport}
                disabled={exporting || (exportMode === "stems" && selectedStemTrackIds.length === 0)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-pink-600/30 hover:brightness-110 transition disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Merender Audio Offline (Faster than real-time)...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    <span>
                      {exportMode === "master"
                        ? "Mulai Render & Ekspor Master WAV"
                        : `Mulai Ekspor ${selectedStemTrackIds.length} Trek Stems`}
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : masterResult ? (
            /* Master Finished Screen */
            <div className="space-y-4 text-center py-4 animate-in fade-in">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>

              <div>
                <h3 className="font-bold text-white text-base">Master Render Selesai!</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Durasi: {masterResult.durationSeconds.toFixed(1)} detik • Ukuran:{" "}
                  {(masterResult.blob.size / (1024 * 1024)).toFixed(2)} MB • {sampleRate}Hz {bitDepth}-bit
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setMasterResult(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition"
                >
                  Kembali
                </button>
                <button
                  onClick={handleDownloadMaster}
                  className="flex-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                >
                  <Download className="size-4" />
                  <span>Unduh Master WAV</span>
                </button>
              </div>
            </div>
          ) : stemsResult ? (
            /* Stems Finished Screen */
            <div className="space-y-4 animate-in fade-in py-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-violet-600/20 text-violet-400">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {stemsResult.stems.length} Stems Berhasil Dirender!
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Seluruh berkas stem sinkron mulai dari waktu nol (Mixcraft 10 Hlm. 500–501).
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadAllStems}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shadow-md"
                >
                  <FolderDown className="size-3.5" />
                  <span>Unduh Semua ({stemsResult.stems.length})</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {stemsResult.stems.map((stem) => (
                  <div
                    key={stem.trackId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/15 transition text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileAudio className="size-4 text-violet-400" />
                      <div>
                        <span className="font-semibold text-white block">{stem.fileName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {(stem.blob.size / (1024 * 1024)).toFixed(2)} MB • {stem.durationSeconds.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadSingleStem(stem)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white text-[11px] font-semibold transition"
                    >
                      <Download className="size-3" />
                      <span>Unduh</span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStemsResult(null)}
                className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition"
              >
                Render Ulang / Kembali ke Pilihan
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
