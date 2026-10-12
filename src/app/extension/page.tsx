"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Puzzle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Sliders,
  HardDrive,
  Volume2,
  ShieldCheck,
  Radio,
  ArrowRight,
  Info,
  Terminal,
} from "lucide-react";
import { useToast } from "@/components/toast";

interface ExtensionStatus {
  detected: boolean;
  version?: string;
  injected?: boolean;
  hasMedia?: boolean;
  lastChecked: number;
}

export default function ExtensionPage() {
  const { toast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [status, setStatus] = useState<ExtensionStatus>({
    detected: false,
    lastChecked: 0,
  });
  const [probing, setProbing] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Deteksi kehadiran content script ekstensi via postMessage & DOM marker
  const probeExtension = () => {
    setProbing(true);

    // Cek atribut DOM jika sudah pernah diinjeksi
    const hasAttr =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-musiku-extension") === "true";

    // Kirim ping ke content script
    if (typeof window !== "undefined") {
      window.postMessage({ type: "MUSIKU_PAGE_PING" }, "*");
    }

    setTimeout(() => {
      setStatus((prev) => ({
        ...prev,
        detected: hasAttr || prev.detected,
        lastChecked: Date.now(),
      }));
      setProbing(false);
    }, 600);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "MUSIKU_EXTENSION_READY" ||
        event.data?.type === "MUSIKU_EXTENSION_PONG"
      ) {
        setStatus({
          detected: true,
          version: event.data.version || "0.1.0",
          injected: event.data.injected ?? true,
          hasMedia: event.data.hasMedia ?? false,
          lastChecked: Date.now(),
        });
      }
    };

    window.addEventListener("message", handleMessage);
    probeExtension();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const copyToClipboard = (text: string, type: "url" | "key" | "path") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast("URL Supabase disalin!", "success");
    } else if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast("Anon Key Supabase disalin!", "success");
    } else {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
      toast("Path direktori ekstensi disalin!", "success");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-charcoal via-card to-zinc-950 p-6 md:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 size-72 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-16 size-64 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
              <Puzzle className="size-3.5" />
              <span>Chrome & Chromium MV3 Extension</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
              MusikKu Universal Controller
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
              Kontrol pemutaran dari tab mana pun, putar audio lokal secara mandiri di latar belakang
              dengan 10-Band Equalizer, dan sinkronkan pustaka Anda langsung melalui popup browser.
            </p>
          </div>

          {/* Status Badge Card */}
          <div className="flex shrink-0 flex-col items-start rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur md:items-end">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Status Koneksi Tab
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${
                  status.detected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="font-bold text-white text-sm">
                {status.detected
                  ? `Terhubung (${status.version || "v0.1.0"})`
                  : "Belum Terdeteksi"}
              </span>
            </div>
            <button
              onClick={probeExtension}
              disabled={probing}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${probing ? "animate-spin" : ""}`} />
              <span>{probing ? "Mengecek..." : "Cek Ulang"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Status Live Notification */}
      {status.detected ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <div className="text-xs md:text-sm leading-relaxed">
            <p className="font-bold text-emerald-300">Ekstensi aktif dan terhubung ke tab MusikKu ini!</p>
            <p className="text-emerald-300/80 mt-0.5">
              Anda dapat mengontrol play/pause/seek langsung melalui popup ekstensi di toolbar browser.
              {status.hasMedia
                ? " Elemen media audio terdeteksi di tab ini."
                : " Sedang tidak ada audio yang diputar di tab ini."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="text-xs md:text-sm leading-relaxed">
            <p className="font-bold text-amber-300">Ekstensi belum dimuat atau belum berizin pada tab ini</p>
            <p className="text-amber-300/80 mt-0.5">
              Jika Anda sudah memasang ekstensi, buka popup ekstensi MusikKu dan klik pada tab ini untuk memberikan izin kontrol.
              Jika belum terpasang, ikuti panduan instalasi 5 langkah di bawah.
            </p>
          </div>
        </div>
      )}

      {/* Feature Highlights Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Keunggulan & Fitur Mandiri</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-card p-4 space-y-2">
            <div className="size-8 rounded-xl bg-violet-500/20 grid place-items-center text-violet-400">
              <HardDrive className="size-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Player Offscreen Lokal</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Memutar file audio lokal di dokumen background terpisah dengan Media Session API tanpa perlu membuka tab web.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-card p-4 space-y-2">
            <div className="size-8 rounded-xl bg-fuchsia-500/20 grid place-items-center text-fuchsia-400">
              <Sliders className="size-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Equalizer 10-Band EQ</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pemrosesan Web Audio API mandiri di popup untuk musik lokal dengan preset Bass Boost, Vokal, Pop, & Rock.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-card p-4 space-y-2">
            <div className="size-8 rounded-xl bg-pink-500/20 grid place-items-center text-pink-400">
              <Volume2 className="size-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Arbitrasi Multi-Tab</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Mendeteksi tab browser yang bersuara (audible) secara cerdas dengan opsi mute cepat dan prioritas fokus.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-card p-4 space-y-2">
            <div className="size-8 rounded-xl bg-indigo-500/20 grid place-items-center text-indigo-400">
              <Radio className="size-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Akses Akun Supabase</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sinkronisasi jumlah playlist dan favorit pengguna secara baca-saja tanpa menyimpan kata sandi.
            </p>
          </div>
        </div>
      </section>

      {/* Honest Capabilities Matrix */}
      <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-bold text-white text-base md:text-lg flex items-center gap-2">
            <ShieldCheck className="size-5 text-violet-400" />
            <span>Matriks Kapabilitas Jujur (Honest Capabilities)</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Sesuai prinsip transparansi MusikKu, kapabilitas kontrol dibatasi oleh batas teknis dan keamanan browser:
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                <th className="pb-3 font-semibold">Sumber Suara</th>
                <th className="pb-3 font-semibold">Play / Pause</th>
                <th className="pb-3 font-semibold">Seek (Waktu)</th>
                <th className="pb-3 font-semibold">Next / Prev</th>
                <th className="pb-3 font-semibold">Equalizer 10-Band</th>
                <th className="pb-3 font-semibold">Catatan Transparansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Player Lokal Ekstensi
                </td>
                <td className="py-3 text-emerald-400">✓ Penuh</td>
                <td className="py-3 text-emerald-400">✓ Penuh</td>
                <td className="py-3 text-emerald-400">✓ Penuh</td>
                <td className="py-3 text-emerald-400">✓ Penuh (Web Audio)</td>
                <td className="py-3 text-zinc-400 text-xs">Offscreen audio mandiri tanpa dependensi tab.</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-violet-400" />
                  Tab Web MusikKu
                </td>
                <td className="py-3 text-emerald-400">✓ Didukung</td>
                <td className="py-3 text-emerald-400">✓ Didukung</td>
                <td className="py-3 text-zinc-500">✕ Nonaktif</td>
                <td className="py-3 text-zinc-500">✕ Nonaktif (CORS)</td>
                <td className="py-3 text-zinc-400 text-xs">YouTube IFrame CORS mencegah manipulasi audio filter langsung.</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-zinc-400" />
                  Tab Media Lain (Generic)
                </td>
                <td className="py-3 text-zinc-500">✕ Terbatas (Mute saja)</td>
                <td className="py-3 text-zinc-500">✕ Tidak ada</td>
                <td className="py-3 text-zinc-500">✕ Tidak ada</td>
                <td className="py-3 text-zinc-500">✕ Tidak ada</td>
                <td className="py-3 text-zinc-400 text-xs">Hanya deteksi tab bersuara & mute demi privasi pengguna.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Step-by-Step Installation Guide */}
      <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-6">
        <div>
          <h2 className="font-bold text-white text-lg">Panduan Pemasangan Ekstensi (Developer Mode)</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Ekstensi MusikKu siap dipasang di semua browser berbasis Chromium (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi).
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              1
            </span>
            <div className="space-y-2 flex-1">
              <h3 className="font-semibold text-white text-sm">Build bundle ekstensi</h3>
              <p className="text-xs text-zinc-400">
                Jalankan perintah berikut di terminal repositori Anda untuk menghasilkan berkas produksi di folder <code className="text-violet-300">extension/dist</code>:
              </p>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-300">
                <span className="text-violet-400">npm run build:extension</span>
                <span className="text-[10px] text-zinc-500">Otomatis siap</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              2
            </span>
            <div className="space-y-2 flex-1">
              <h3 className="font-semibold text-white text-sm">Buka Halaman Ekstensi Browser</h3>
              <p className="text-xs text-zinc-400">
                Buka tab baru di browser Anda dan ketikkan alamat berikut di address bar:
              </p>
              <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-fuchsia-300">
                chrome://extensions
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              3
            </span>
            <div className="space-y-1 flex-1">
              <h3 className="font-semibold text-white text-sm">Aktifkan Developer Mode</h3>
              <p className="text-xs text-zinc-400">
                Nyalakan toggle switch <strong>Developer mode</strong> (Mode pengembang) di pojok kanan atas layar browser Anda.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              4
            </span>
            <div className="space-y-2 flex-1">
              <h3 className="font-semibold text-white text-sm">Klik &quot;Load unpacked&quot;</h3>
              <p className="text-xs text-zinc-400">
                Klik tombol <strong>Load unpacked</strong> (Muat yang belum dibongkar) di pojok kiri atas, kemudian pilih folder berikut:
              </p>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-300">
                <span className="truncate text-pink-300">projec/musiku/extension/dist</span>
                <button
                  onClick={() => copyToClipboard("/home/miran/projec/musiku/extension/dist", "path")}
                  className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  {copiedPath ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copiedPath ? "Tersalin" : "Salin Path"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              5
            </span>
            <div className="space-y-1 flex-1">
              <h3 className="font-semibold text-white text-sm">Pin Ikon & Mulai Menggunakan!</h3>
              <p className="text-xs text-zinc-400">
                Klik ikon puzzle di toolbar browser dan pin <strong>MusikKu Controller</strong> untuk akses cepat ke pemutar musik kapan saja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supabase Account Sync Setup Card */}
      <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-bold text-white text-base md:text-lg flex items-center gap-2">
            <Radio className="size-5 text-pink-400" />
            <span>Kredensial Sinkronisasi Supabase untuk Ekstensi</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Di popup ekstensi (tab <strong>Akun</strong>), masukkan URL Supabase & Anon Key di bawah ini bersama email & password MusikKu Anda untuk melihat statistik playlist dan favorit:
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Supabase URL */}
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">Supabase Project URL</span>
              <button
                onClick={() => copyToClipboard(supabaseUrl, "url")}
                className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-white transition"
              >
                {copiedUrl ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copiedUrl ? "Tersalin" : "Salin"}</span>
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-300 truncate">
              {supabaseUrl || "https://contoh.supabase.co"}
            </div>
          </div>

          {/* Supabase Anon Key */}
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">Supabase Public Anon Key</span>
              <button
                onClick={() => copyToClipboard(supabaseAnon, "key")}
                className="flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-white transition"
              >
                {copiedKey ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copiedKey ? "Tersalin" : "Salin"}</span>
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-300 truncate">
              {supabaseAnon ? `${supabaseAnon.slice(0, 32)}…` : "eyJhbGciOi..."}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          * Keamanan: Ekstensi hanya memakai kunci publik anonim (bukan service role). Kata sandi hanya digunakan sekali saat verifikasi login dan tidak pernah disimpan secara lokal.
        </p>
      </section>

      {/* Quick Action Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
        <Link
          href="/equalizer"
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition"
        >
          <Sliders className="size-4 text-violet-400" />
          <span>Buka Equalizer Web Studio</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition"
        >
          <span>Kembali ke Pengaturan</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
