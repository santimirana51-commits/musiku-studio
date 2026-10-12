import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/sync/route";
import type { SyncOperation } from "@/lib/sync/types";

vi.mock("@/lib/supabase/server", () => ({
  requireUser: vi.fn(),
}));

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 bila belum login", async () => {
    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: null,
      supabase: {} as any,
      error: "Unauthorized",
    });

    const req = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "test-key-1",
        table: "favorites",
        op: "upsert",
        rowId: "fav-1",
        payload: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.kind).toBe("unauthorized");
  });

  it("400 bila payload tidak valid", async () => {
    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "user-1" } as any,
      supabase: {} as any,
      error: null,
    });

    const req = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.kind).toBe("fatal");
  });

  it("200 sukses mengeksekusi operasi dan idempoten pada kiriman kedua", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({
      upsert: upsertMock,
    });

    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "user-test-idempotent" } as any,
      supabase: { from: fromMock } as any,
      error: null,
    });

    const op: SyncOperation = {
      key: "unique-idempotent-key-999",
      table: "favorites",
      op: "upsert",
      rowId: "fav-123",
      payload: { youtube_video_id: "dQw4w9WgXcQ" },
      baseUpdatedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      attempts: 0,
      nextRetryAt: "2026-01-01T00:00:00.000Z",
      lastError: null,
    };

    // Kiriman pertama: mengeksekusi DB
    const req1 = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": op.key,
      },
      body: JSON.stringify(op),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const j1 = await res1.json();
    expect(j1.kind).toBe("ok");
    expect(upsertMock).toHaveBeenCalledTimes(1);

    // Kiriman kedua dengan key yang sama: harus deduped via cache tanpa panggil DB lagi
    const req2 = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": op.key,
      },
      body: JSON.stringify(op),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const j2 = await res2.json();
    expect(j2.kind).toBe("ok");
    // upsertMock TIDAK bertambah karena ditangkap oleh cache idempotensi
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
