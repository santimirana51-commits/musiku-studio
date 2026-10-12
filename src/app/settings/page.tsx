"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Puzzle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { useSyncEngine } from "@/lib/sync/use-sync";
import { clearSyncQueue } from "@/lib/sync/queue";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const { status: syncStatus, queueCount, syncManual, pauseSync, resetError, error } = useSyncEngine();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setDisplayName((data.user?.user_metadata?.display_name as string) ?? "");
      if (data.user) {
        const { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", data.user.id).single();
        if (prefs) setHistoryEnabled(prefs.history_enabled !== false);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast("Masuk dulu untuk menyimpan preferensi cloud.", "error");
        return;
      }
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: data.user.id, history_enabled: historyEnabled, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      await supabase.auth.updateUser({ data: { display_name: displayName } });
      toast("Pengaturan disimpan.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menyimpan.", "error");
    }
  };

  const logout = async () => {
    // Hapus antrean sync engine agar data stale milik akun lama tidak terlanjur terkirim ke akun baru.
    clearSyncQueue();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) return <p className="text-sm text-zinc-400">Memuat pengaturan…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold text-white md:text-2xl">Pengaturan</h1>

      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Profil">
        <h2 className="font-bold text-white">Profil</h2>
        <p className="mt-1 text-sm text-zinc-400">{email ? `Masuk sebagai ${email}` : "Belum masuk (mode tamu)."}</p>
        <label htmlFor="nama" className="mt-4 block text-sm text-zinc-300">Nama tampilan</label>
        <input id="nama" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" />
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Preferensi">
        <h2 className="font-bold text-white">Preferensi aplikasi</h2>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-300">
          <span>Simpan riwayat pemutaran <span className="block text-xs text-zinc-500">Jika mati, riwayat cloud tidak dicatat.</span></span>
          <input type="checkbox" checked={historyEnabled} onChange={(e) => setHistoryEnabled(e.target.checked)} className="size-5 accent-fuchsia-500" />
        </label>
        <p className="mt-3 text-xs text-zinc-500">Tema: mode gelap premium (satu-satunya tema yang didukung saat ini).</p>
        <div className="mt-3 flex items-start gap-2">
          <button onClick={syncManual} className="rounded-sm bg-gray-800 text-sm text-zinc-300 hover:bg-gray-700 px-3 py-1.5">
            {syncStatus === "syncing" ? "Synchronizing…" : "Sync now"}
          </button>
          {syncStatus === "paused" && (
            <span className="text-[10px] text-zinc-500">Sinkronisasi dijeda (login ulang untuk melanjutkan)</span>
          )}
          {syncStatus === "error" && (
            <span className="text-[10px] text-red-400">Error: {error ?? "unknown"}</span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Ekstensi Browser">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <Puzzle className="size-4 text-violet-400" />
              <span>Ekstensi Browser MusikKu (Chrome MV3)</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Kontrol pemutaran dari tab mana pun, putar audio lokal mandiri di background dengan 10-Band EQ, dan pantau pustaka cloud.
            </p>
          </div>
          <Link
            href="/extension"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/30 hover:text-white transition"
          >
            <span>Pusat Ekstensi</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-6" aria-label="Privasi">
        <h2 className="font-bold text-white">Privasi</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>Kami hanya menyimpan referensi video YouTube (ID, judul, channel, thumbnail) — tidak pernah menyimpan file audio/video.</li>
          <li>Playlist privat hanya bisa diakses pemiliknya. Data favorit & riwayat terisolasi per akun (RLS).</li>
          <li>Pemutaran memakai player resmi YouTube; kebijakan privasi & persyaratan YouTube/Google berlaku.</li>
          <li>Hapus riwayat kapan saja di halaman Riwayat.</li>
        </ul>
      </section>

      <div className="flex gap-2">
        <button onClick={save} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-2.5 text-sm font-bold text-white">Simpan</button>
        {email && <button onClick={logout} className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/15">Keluar</button>}
      </div>
    </div>
  );
}
