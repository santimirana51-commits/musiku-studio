"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env-client";

export function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }: { data: { user?: { email?: string | null } | null } }) => {
        if (isMounted) {
          setEmail(data?.user?.email ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_e: unknown, session: { user?: { email?: string | null } } | null) => {
        if (isMounted) {
          setEmail(session?.user?.email ?? null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (!supabaseConfigured()) {
    return <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400">Mode tamu</span>;
  }

  // Tampilkan placeholder halus saat sesi masih diverifikasi untuk mencegah kedipan FOUC
  if (isLoading) {
    return <div className="h-7 w-20 animate-pulse rounded-full bg-white/5" aria-hidden="true" />;
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-1.5 text-xs font-bold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <User className="size-3.5" aria-hidden /> Masuk
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs text-zinc-400 sm:block" title={email}>
        {email}
      </span>
      <button
        type="button"
        disabled={isSigningOut}
        onClick={async () => {
          setIsSigningOut(true);
          try {
            await createClient().auth.signOut();
            setEmail(null);
            router.refresh();
          } catch (err) {
            console.error("Gagal keluar:", err);
          } finally {
            setIsSigningOut(false);
          }
        }}
        aria-label="Keluar"
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
      >
        {isSigningOut ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <LogOut className="size-3.5" aria-hidden />
        )}
        {isSigningOut ? "Keluar…" : "Keluar"}
      </button>
    </div>
  );
}
