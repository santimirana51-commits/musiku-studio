import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { playlistItemSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: pl } = await supabase.from("playlists").select("id,user_id").eq("id", params.id).single();
  if (!pl || pl.user_id !== user.id) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = playlistItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });

  const { count } = await supabase.from("playlist_items").select("id", { count: "exact", head: true }).eq("playlist_id", params.id);
  const { data, error: dbErr } = await supabase
    .from("playlist_items")
    .insert({ playlist_id: params.id, position: count ?? 0, ...parsed.data })
    .select("*")
    .single();
  if (dbErr) return NextResponse.json({ error: "Gagal menambah item." }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // Reorder: body { order: string[] (item ids) }
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data: pl } = await supabase.from("playlists").select("id,user_id").eq("id", params.id).single();
  if (!pl || pl.user_id !== user.id) return NextResponse.json({ error: "Playlist tidak ditemukan." }, { status: 404 });
  const body = await req.json().catch(() => null) as { order?: string[] } | null;
  if (!body?.order || !Array.isArray(body.order) || body.order.length > 200) {
    return NextResponse.json({ error: "Urutan tidak valid." }, { status: 400 });
  }
  for (let i = 0; i < body.order.length; i++) {
    await supabase.from("playlist_items").update({ position: i }).eq("id", body.order[i]).eq("playlist_id", params.id);
  }
  return NextResponse.json({ ok: true });
}
