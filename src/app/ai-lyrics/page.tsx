"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Download, AlertCircle, Save, Music } from "lucide-react";
import { useToast } from "@/components/toast";
import { validateLrc, parseLrc } from "@/lib/karaoke/lrc";

export default function AILyricsPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [language, setLanguage] = useState("id");
  const [videoId, setVideoId] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedLrc, setGeneratedLrc] = useState("");
  const [provider, setProvider] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast("Judul lagu wajib diisi.", "error");
      return;
    }
    if (!consent) {
      toast("Persetujuan pemrosesan AI wajib dicentang.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          language,
          userConsent: consent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghasilkan lirik AI.");
      }

      setGeneratedLrc(data.item.lrc);
      setProvider(data.item.provider);
      toast(`Lirik berhasil dibuat via ${data.item.provider}!`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Terjadi kesalahan", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLrc) return;
    navigator.clipboard.writeText(generatedLrc);
    setCopied(true);
    toast("Lirik LRC disalin ke clipboard.", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedLrc) return;
    const blob = new Blob([generatedLrc], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.trim() || "lirik"}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    toast("File .lrc berhasil diunduh.", "success");
  };

  const handleSaveToKaraoke = async () => {
    if (!generatedLrc.trim()) {
      toast("Lirik masih kosong.", "error");
      return;
    }
    if (!videoId.trim() || !/^[a-zA-Z0-9_-]{11}$/.test(videoId.trim())) {
      toast("Sertakan 11 karakter ID video YouTube yang valid untuk ditautkan.", "error");
      return;
    }

    const val = validateLrc(generatedLrc);
    if (!val.ok) {
      toast(`Format LRC tidak valid: ${val.message}`, "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/karaoke/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_video_id: videoId.trim(),
          title: title.trim(),
          language,
          source_type: "user_created",
          source_reference: `Dihasilkan asisten AI MusikKu (${provider || "AI"})`,
          lyrics_lrc: generatedLrc,
          offset_ms: 0,
          visibility: "private",
          rights_confirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan ke koleksi karaoke.");
      }

      toast("Lirik berhasil disimpan ke koleksi Karaoke Anda!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan lirik", "error");
    } finally {
      setSaving(false);
    }
  };

  const previewLines = parseLrc(generatedLrc).lines;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      {/* Header */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-900/30 via-fuchsia-900/20 to-pink-900/10 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="size-6 text-white" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white md:text-2xl">AI Lyrics Studio</h1>
            <p className="text-xs text-zinc-400 md:text-sm">
              Buat dan sinkronkan lirik karaoke berformat standar LRC [mm:ss.xx] menggunakan asisten AI di server yang aman.
            </p>
          </div>
        </div>
      </header>

      {/* Form Pembuatan */}
      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Formulir Lirik AI">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="song-title" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Judul Lagu *
              </label>
              <input
                id="song-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Menghapus Jejakmu"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="song-artist" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Nama Artis / Grup
              </label>
              <input
                id="song-artist"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Contoh: Peterpan"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="song-lang" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Bahasa Lirik
              </label>
              <select
                id="song-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="id">Bahasa Indonesia (id)</option>
                <option value="en">English (en)</option>
                <option value="ja">Japanese (ja)</option>
                <option value="ko">Korean (ko)</option>
                <option value="ms">Bahasa Melayu (ms)</option>
              </select>
            </div>
            <div>
              <label htmlFor="song-video" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                ID Video YouTube (Opsional — untuk tautan karaoke)
              </label>
              <input
                id="song-video"
                type="text"
                value={videoId}
                maxLength={11}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="11 karakter (contoh: dQw4w9WgXcQ)"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Persetujuan Etika & Hak Cipta */}
          <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 rounded accent-violet-500"
              />
              <span className="text-xs leading-relaxed text-zinc-300">
                <strong className="text-white">Pernyataan & Persetujuan Pengguna:</strong> Saya menyetujui pemrosesan teks judul oleh asisten AI server dan memastikan bahwa pembuatan lirik tersinkronisasi ini digunakan untuk keperluan karaoke pribadi yang sah tanpa melanggar hak cipta pihak manapun.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim() || !consent}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="size-4" aria-hidden />
            {loading ? "Menghasilkan Lirik LRC..." : "Buat Lirik dengan AI"}
          </button>
        </form>
      </section>

      {/* Tampilan Hasil LRC */}
      {generatedLrc && (
        <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Hasil Lirik">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Music className="size-5 text-violet-400" aria-hidden />
              <h2 className="font-bold text-white">Lirik LRC Tersinkronisasi</h2>
              {provider && (
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium text-violet-300">
                  Model: {provider}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-white/10 bg-charcoal p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Editor Teks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    activeTab === "preview" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Pratinjau ({previewLines.length} baris)
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
              >
                {copied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
                Salin
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
              >
                <Download className="size-3.5" />
                Unduh .lrc
              </button>
              {videoId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveToKaraoke}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  {saving ? "Menyimpan..." : "Simpan ke Karaoke"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            {activeTab === "edit" ? (
              <textarea
                value={generatedLrc}
                onChange={(e) => setGeneratedLrc(e.target.value)}
                rows={16}
                className="w-full rounded-2xl border border-white/10 bg-charcoal p-4 font-mono text-xs text-white leading-relaxed focus:border-violet-500 focus:outline-none"
              />
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-charcoal p-4">
                {previewLines.map((line, idx) => {
                  const sec = Math.floor(line.timeMs / 1000);
                  const m = Math.floor(sec / 60);
                  const s = String(sec % 60).padStart(2, "0");
                  return (
                    <div key={idx} className="flex items-start gap-3 rounded-lg px-2 py-1 hover:bg-white/5">
                      <span className="font-mono text-[11px] text-violet-400">
                        {m}:{s}
                      </span>
                      <span className="text-sm text-zinc-200">{line.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Catatan Privasi & Kepatuhan */}
      <footer className="rounded-2xl border border-white/5 bg-charcoal/40 p-4 text-xs text-zinc-500">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
          <p>
            <strong>Privasi & Keamanan:</strong> Pemrosesan AI dilakukan sepenuhnya melalui server proksi MusikKu. File audio perangkat Anda tidak pernah dikirim ke pihak ketiga. API key penyedia AI disimpan di lingkungan server aman dan tidak pernah dapat dibaca dari peramban web atau perangkat pengguna.
          </p>
        </div>
      </footer>
    </div>
  );
}
