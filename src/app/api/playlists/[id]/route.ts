import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { playlistSchema, playlistItemSchema } from "@/lib/validation";
import { z } from "zod";

async function ownedPlaylist(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from("playlists")
    .select("id,user_id,name,description,is_public")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  return data;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const pl = await ownedPlaylist(supabase, user.id, params.id);
  if (!pl) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });
  const { data: items } = await supabase
    .from("playlist_items")
    .select("*")
    .eq("playlist_id", params.id)
    .order("position", { ascending: true });
  return NextResponse.json({ playlist: pl, items: items ?? [] });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const pl = await ownedPlaylist(supabase, user.id, params.id);
  if (!pl) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = playlistSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  const { data, error: dbErr } = await supabase
    .from("playlists")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id,name,description,is_public")
    .single();
  if (dbErr) return NextResponse.json({ error: "Gagal memperbarui." }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const pl = await ownedPlaylist(supabase, user.id, params.id);
  if (!pl) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });
  const { error: dbErr } = await supabase.from("playlists").delete().eq("id", params.id);
  if (dbErr) return NextResponse.json({ error: "Gagal menghapus." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
