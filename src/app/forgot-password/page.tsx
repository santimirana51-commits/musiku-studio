"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Lupa kata sandi</h1>
      <p className="text-sm text-zinc-400">Masukkan email akunmu. Kami kirimkan tautan reset bila email terdaftar dan SMTP Supabase dikonfigurasi.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setMsg(null);
          try {
            const supabase = createClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setMsg("Jika email terdaftar, tautan reset telah dikirim. Cek kotak masuk/spam.");
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Gagal mengirim email reset.");
          }
        }}
        className="space-y-3 rounded-3xl border border-white/10 bg-card p-6"
      >
        <label htmlFor="email" className="text-sm text-zinc-300">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" />
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        {msg && <p role="status" className="text-sm text-emerald-300">{msg}</p>}
        <button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-2.5 text-sm font-bold text-white">Kirim tautan reset</button>
      </form>
    </div>
  );
}
