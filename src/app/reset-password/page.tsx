"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Atur ulang kata sandi</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password: pw });
            if (error) throw error;
            setMsg("Kata sandi diperbarui. Mengalihkan ke beranda…");
            setTimeout(() => router.push("/"), 1200);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Gagal memperbarui kata sandi.");
          }
        }}
        className="space-y-3 rounded-3xl border border-white/10 bg-card p-6"
      >
        <label htmlFor="pw" className="text-sm text-zinc-300">Kata sandi baru (min. 6 karakter)</label>
        <input id="pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" />
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        {msg && <p role="status" className="text-sm text-emerald-300">{msg}</p>}
        <button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-2.5 text-sm font-bold text-white">Simpan kata sandi</button>
      </form>
    </div>
  );
}
