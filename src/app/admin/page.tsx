"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminPage() {
  const [data, setData] = useState<{ stats?: { users: number; playlists: number; favorites: number; plays: number }; recentPlaylists?: { id: string; name: string; is_public: boolean; created_at: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Gagal memuat.");
        setData(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-white md:text-2xl">
        <ShieldCheck className="size-6 text-fuchsia-300" aria-hidden /> Panel Admin
      </h1>
      <p className="text-sm text-zinc-400">Dilindungi otorisasi server (email allowlist ADMIN_EMAILS atau role admin di profiles). Tidak pernah menampilkan API key/rahasia.</p>
      {loading ? (
        <p className="text-sm text-zinc-400">Memuat statistik…</p>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-sm text-red-200">
          <p className="font-semibold">Akses ditolak atau gagal.</p>
          <p className="mt-1">{error}</p>
          <Link href="/login" className="mt-3 inline-block rounded-xl bg-white/10 px-4 py-2 font-semibold text-white">Masuk</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["Pengguna", data?.stats?.users ?? 0],
                ["Playlist", data?.stats?.playlists ?? 0],
                ["Favorit", data?.stats?.favorites ?? 0],
                ["Pemutaran", data?.stats?.plays ?? 0],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-2xl border border-white/5 bg-card p-4">
                <p className="text-2xl font-extrabold text-white">{v}</p>
                <p className="text-xs text-zinc-400">{label}</p>
              </div>
            ))}
          </div>
          <section className="rounded-2xl border border-white/5 bg-card p-4">
            <h2 className="font-bold text-white">Playlist terbaru</h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {(data?.recentPlaylists ?? []).map((p) => (
                <li key={p.id} className="flex justify-between gap-2 border-b border-white/5 py-2 last:border-0">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{p.is_public ? "Publik" : "Privat"}</span>
                </li>
              ))}
              {(data?.recentPlaylists ?? []).length === 0 && <li className="text-zinc-500">Belum ada data.</li>}
            </ul>
          </section>
          <section className="rounded-2xl border border-white/5 bg-card p-4 text-sm text-zinc-400">
            <h2 className="font-bold text-white">Pemantauan</h2>
            <p className="mt-1">Penggunaan YouTube Data API dipantau di Google Cloud Console → APIs & Services → Dashboard & Quotas. Endpoint pencarian MusikKu memakai cache 60 detik, debounce 600 ms, dan batas 25 hasil/request untuk hemat kuota.</p>
          </section>
        </>
      )}
    </div>
  );
}
