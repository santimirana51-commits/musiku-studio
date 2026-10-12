"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env-client";

export function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!supabaseConfigured()) {
    return <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400">Mode tamu</span>;
  }
  if (!email) {
    return (
      <Link href="/login" className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-1.5 text-xs font-bold text-white">
        <User className="size-3.5" aria-hidden /> Masuk
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs text-zinc-400 sm:block" title={email}>{email}</span>
      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.refresh();
        }}
        aria-label="Keluar"
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
      >
        <LogOut className="size-3.5" aria-hidden /> Keluar
      </button>
    </div>
  );
}
