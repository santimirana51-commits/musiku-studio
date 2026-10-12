import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

// DELETE /api/karaoke/lyrics/:id — hapus lirik milik sendiri (wajib login).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { error } = await supabase
    .from("karaoke_lyrics")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Gagal menghapus lirik." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
