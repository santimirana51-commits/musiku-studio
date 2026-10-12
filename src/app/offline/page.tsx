import Link from "next/link";
import { WifiOff, HardDrive, RotateCcw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-white/5 border border-white/10 text-zinc-400">
        <WifiOff className="size-8" aria-hidden />
      </div>

      <h1 className="text-xl font-extrabold text-white md:text-2xl">Mode Offline</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400 leading-relaxed">
        Koneksi internet tidak tersedia. Anda tetap dapat mendengarkan koleksi musik yang telah disimpan di perangkat Anda.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/library?tab=devices"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
        >
          <HardDrive className="size-4" />
          Buka Pustaka Lokal
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10"
        >
          <RotateCcw className="size-4" />
          Coba Lagi
        </Link>
      </div>
    </div>
  );
}
