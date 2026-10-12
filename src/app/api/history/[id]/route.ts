import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { error } = await supabase.from("playback_history").delete().eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Gagal menghapus item." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
