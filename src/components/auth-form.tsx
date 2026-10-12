"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env-client";

const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Minimal 6 karakter"),
  displayName: z.string().max(60).optional(),
});

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  if (!supabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-6 text-sm text-amber-200">
        <p className="font-semibold">Supabase belum dikonfigurasi.</p>
        <p className="mt-1">Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local lalu jalankan ulang. Lihat README.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        setInfo(null);
        const supabase = createClient();
        try {
          if (mode === "register") {
            const { error } = await supabase.auth.signUp({
              email: v.email,
              password: v.password,
              options: { data: { display_name: v.displayName ?? "" } },
            });
            if (error) throw error;
            setInfo("Pendaftaran berhasil. Cek email untuk verifikasi bila diaktifkan, lalu masuk.");
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
            if (error) throw error;
            router.push("/");
            router.refresh();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Autentikasi gagal.");
        }
      })}
      className="space-y-4 rounded-3xl border border-white/10 bg-card p-6"
    >
      {mode === "register" && (
        <div>
          <label htmlFor="displayName" className="text-sm text-zinc-300">Nama tampilan</label>
          <input id="displayName" {...register("displayName")} className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" maxLength={60} />
        </div>
      )}
      <div>
        <label htmlFor="email" className="text-sm text-zinc-300">Email</label>
        <input id="email" type="email" {...register("email")} className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" autoComplete="email" />
        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-sm text-zinc-300">Kata sandi</label>
        <input id="password" type="password" {...register("password")} className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-white" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {info && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-sm text-emerald-200">{info}</p>}
      <button disabled={isSubmitting} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {isSubmitting ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
      </button>
      <p className="text-center text-sm text-zinc-400">
        {mode === "login" ? (
          <>Belum punya akun? <Link href="/register" className="text-fuchsia-300 hover:underline">Daftar</Link> · <Link href="/forgot-password" className="text-fuchsia-300 hover:underline">Lupa kata sandi</Link></>
        ) : (
          <>Sudah punya akun? <Link href="/login" className="text-fuchsia-300 hover:underline">Masuk</Link></>
        )}
      </p>
    </form>
  );
}
