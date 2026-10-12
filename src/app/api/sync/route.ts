// API route /api/sync (Fase 3 & 6)
//
// Menerima operasi sync offline dari client (FIFO), memvalidasi sesi pengguna,
// menegakkan idempotensi via Idempotency-Key, dan mengeksekusi operasi metadata
// ke tabel database PostgreSQL Supabase dengan RLS user-scoped.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import type { SendOutcome, SyncOperation, SyncTable } from "@/lib/sync/types";

// In-memory idempotency cache (TTL 24 jam)
// Key: `${userId}:${idempotencyKey}` -> timestamp
const idempotencyCache = new Map<string, number>();

function isAlreadyProcessed(userId: string, key: string): boolean {
  const compositeKey = `${userId}:${key}`;
  const now = Date.now();
  const cachedTime = idempotencyCache.get(compositeKey);
  if (cachedTime && now - cachedTime < 24 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

function markProcessed(userId: string, key: string): void {
  const compositeKey = `${userId}:${key}`;
  idempotencyCache.set(compositeKey, Date.now());
  // Jaga ukuran memori cache
  if (idempotencyCache.size > 5000) {
    const oldest = Array.from(idempotencyCache.keys()).slice(0, 500);
    for (const k of oldest) idempotencyCache.delete(k);
  }
}

const ALLOWED_TABLES = new Set<SyncTable>([
  "playlists",
  "playlist_items",
  "favorites",
  "music_library",
  "user_preferences",
  "karaoke_lyrics",
  "playback_history",
]);

export async function POST(req: Request) {
  const { user, supabase } = await requireUser();
  if (!user) {
    const outcome: SendOutcome = { kind: "unauthorized", message: "Sesi telah berakhir. Silakan login kembali." };
    return NextResponse.json(outcome, { status: 401 });
  }

  const idempotencyHeader = req.headers.get("Idempotency-Key");
  const body = (await req.json().catch(() => null)) as SyncOperation | null;

  if (!body || !body.key || !body.table || !body.op) {
    const outcome: SendOutcome = { kind: "fatal", message: "Payload operasi sync tidak valid." };
    return NextResponse.json(outcome, { status: 400 });
  }

  const opKey = idempotencyHeader || body.key;

  // 1. Cek Idempotency: Jika sudah pernah diproses, kembalikan 'ok' langsung
  if (isAlreadyProcessed(user.id, opKey)) {
    const outcome: SendOutcome = { kind: "ok" };
    return NextResponse.json(outcome, { status: 200 });
  }

  if (!ALLOWED_TABLES.has(body.table)) {
    const outcome: SendOutcome = { kind: "fatal", message: `Tabel ${body.table} tidak didukung untuk sync.` };
    return NextResponse.json(outcome, { status: 400 });
  }

  try {
    const { table, op, rowId, payload } = body;

    if (op === "delete") {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", rowId)
        .eq("user_id", user.id);

      if (error) {
        const outcome: SendOutcome = { kind: "retryable", message: error.message };
        return NextResponse.json(outcome, { status: 500 });
      }
    } else {
      // Upsert metadata
      const cleanPayload: Record<string, unknown> = {
        ...payload,
        user_id: user.id,
      };

      if (rowId && !cleanPayload.id) {
        cleanPayload.id = rowId;
      }

      // Pastikan updated_at terbarui jika ada
      if (["playlists", "user_preferences", "karaoke_lyrics", "music_library"].includes(table)) {
        cleanPayload.updated_at = new Date().toISOString();
      }

      const { error } = await supabase.from(table).upsert(cleanPayload);

      if (error) {
        // Jika fatal (validasi schema / DDL violation)
        if (error.code === "23502" || error.code === "22P02") {
          const outcome: SendOutcome = { kind: "fatal", message: error.message };
          return NextResponse.json(outcome, { status: 400 });
        }
        const outcome: SendOutcome = { kind: "retryable", message: error.message };
        return NextResponse.json(outcome, { status: 500 });
      }
    }

    // Catat idempotensi berhasil
    markProcessed(user.id, opKey);

    const outcome: SendOutcome = { kind: "ok" };
    return NextResponse.json(outcome, { status: 200 });
  } catch (e) {
    const outcome: SendOutcome = {
      kind: "retryable",
      message: e instanceof Error ? e.message : "Kesalahan server internal saat sinkronisasi.",
    };
    return NextResponse.json(outcome, { status: 500 });
  }
}
