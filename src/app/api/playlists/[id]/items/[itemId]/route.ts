import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: pl } = await supabase.from("playlists").select("id,user_id").eq("id", params.id).single();
  if (!pl || pl.user_id !== user.id) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });
  const { error: dbErr } = await supabase.from("playlist_items").delete().eq("id", params.itemId).eq("playlist_id", params.id);
  if (dbErr) return NextResponse.json({ error: "Gagal menghapus item." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
