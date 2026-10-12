import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { aiLyricsRequestSchema, generateAILyrics } from "@/lib/karaoke/ai-lyrics";

// POST /api/ai-lyrics
// Menghasilkan lirik LRC menggunakan model AI di sisi server.
//
// Aturan Keamanan & Kepatuhan (§H & §J):
// - Memerlukan autentikasi pengguna (user harus login).
// - Memerlukan persetujuan eksplisit pengguna (userConsent: true).
// - API key AI tidak pernah dikirim ke client.
// - Dibatasi rate-limit ketat (10 request per menit per IP).
export async function POST(req: Request) {
  const ip = clientKey(req);
  if (!rateLimit(`ai-lyrics:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan pembuatan lirik AI. Silakan coba lagi nanti." },
      { status: 429 }
    );
  }

  const { user } = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Anda harus masuk untuk menggunakan fitur AI Lyrics." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = aiLyricsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Data permintaan tidak valid." },
      { status: 400 }
    );
  }

  try {
    const result = await generateAILyrics(parsed.data);
    return NextResponse.json(
      {
        ok: true,
        item: result,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal memproses lirik AI." },
      { status: 500 }
    );
  }
}
