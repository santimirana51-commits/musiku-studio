import { NextResponse } from "next/server";
import { requireUser, isAdminEmail } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  // Otorisasi ganda: email allowlist ATAU role admin di profiles
  let isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }
  if (!isAdmin) return NextResponse.json({ error: "Akses ditolak. Khusus admin." }, { status: 403 });

  const [users, playlists, favorites, history] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("playlists").select("id", { count: "exact", head: true }),
    supabase.from("favorites").select("id", { count: "exact", head: true }),
    supabase.from("playback_history").select("id", { count: "exact", head: true }),
  ]);
  const { data: recentPlaylists } = await supabase
    .from("playlists")
    .select("id,name,is_public,created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({
    stats: {
      users: users.count ?? 0,
      playlists: playlists.count ?? 0,
      favorites: favorites.count ?? 0,
      plays: history.count ?? 0,
    },
    recentPlaylists: recentPlaylists ?? [],
    note: "Statistik agregat dari data yang benar-benar tersedia. Tidak ada API key/rahasia yang ditampilkan.",
  });
}
