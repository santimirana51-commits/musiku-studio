import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai-lyrics/route";

vi.mock("@/lib/supabase/server", () => ({
  requireUser: vi.fn(),
}));

describe("POST /api/ai-lyrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 jika pengguna belum login", async () => {
    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: null,
      supabase: {} as any,
      error: "Unauthorized",
    });

    const req = new Request("http://localhost/api/ai-lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Lagu",
        userConsent: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error).toMatch(/masuk/i);
  });

  it("400 jika userConsent bernilai false atau tidak ada", async () => {
    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "user-123" } as any,
      supabase: {} as any,
      error: null,
    });

    const req = new Request("http://localhost/api/ai-lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Lagu",
        userConsent: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toMatch(/Persetujuan/i);
  });

  it("200 sukses menghasilkan lirik LRC jika valid dan user login", async () => {
    const { requireUser } = await import("@/lib/supabase/server");
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "user-123" } as any,
      supabase: {} as any,
      error: null,
    });

    const req = new Request("http://localhost/api/ai-lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Kemesraan",
        artist: "Iwan Fals",
        language: "id",
        userConsent: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.item.lrc).toContain("Kemesraan");
    expect(j.item.lineCount).toBeGreaterThan(0);
  });
});
