import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout, loadSession, authedFetch, getCounts, type SyncDeps } from "./musiku-sync.js";

function deps(): SyncDeps & { mem: Record<string, unknown> } {
  const mem: Record<string, unknown> = {};
  return {
    mem,
    fetchFn: vi.fn(),
    store: {
      get: async (k) => {
        const keys = k === null ? Object.keys(mem) : Array.isArray(k) ? k : [k];
        const out: Record<string, unknown> = {};
        for (const key of keys) out[key] = mem[key];
        return out;
      },
      set: async (o) => {
        Object.assign(mem, o);
      },
      remove: async (k) => {
        for (const key of Array.isArray(k) ? k : [k]) delete mem[key];
      },
    },
  };
}

const ok = (json: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({ ok: status < 300, status, json: async () => json, headers: new Headers(headers) }) as Response;

describe("musiku-sync", () => {
  let d: ReturnType<typeof deps>;
  beforeEach(() => {
    d = deps();
  });

  it("login menyimpan sesi, bukan password", async () => {
    (d.fetchFn as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      ok({ access_token: "AT", refresh_token: "RT", expires_in: 3600 })
    );
    await login(d, { url: "https://x.supabase.co/", anon: "ANON", email: "a@b.id", password: "pw123456" });
    const s = await loadSession(d);
    expect(s?.accessToken).toBe("AT");
    expect(JSON.stringify(d.mem)).not.toContain("pw123456");
    expect((d.mem["musiku-sync-meta"] as { anon: string }).anon).toBe("ANON");
  });

  it("login menolak URL/anon tak valid", async () => {
    await expect(login(d, { url: "x", anon: "A", email: "a@b.id", password: "x" })).rejects.toThrow(/URL/);
    await expect(
      login(d, { url: "https://x.supabase.co", anon: "", email: "a@b.id", password: "x" })
    ).rejects.toThrow(/Anon key/);
  });

  it("authedFetch refresh sekali saat 401 lalu sukses", async () => {
    d.mem["musiku-sync-session"] = { url: "https://x.supabase.co", accessToken: "OLD", refreshToken: "RT", expiresAt: 1 };
    d.mem["musiku-sync-meta"] = { url: "https://x.supabase.co", anon: "ANON" };
    const f = d.fetchFn as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers() } as Response)
      .mockResolvedValueOnce(ok({ access_token: "NEW", refresh_token: "RT2", expires_in: 3600 }))
      .mockResolvedValueOnce(ok({ items: [] }));
    const res = await authedFetch(d, "playlists?select=id");
    expect(res.ok).toBe(true);
    expect((await loadSession(d))?.accessToken).toBe("NEW");
  });

  it("refresh gagal = logout + error sesi kedaluwarsa", async () => {
    d.mem["musiku-sync-session"] = { url: "https://x.supabase.co", accessToken: "OLD", refreshToken: "", expiresAt: 1 };
    const f = d.fetchFn as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers() } as Response);
    await expect(authedFetch(d, "playlists")).rejects.toThrow(/kedaluwarsa/i);
    expect(await loadSession(d)).toBeNull();
  });

  it("getCounts membaca Content-Range; null bila belum login", async () => {
    expect(await getCounts(d)).toBeNull();
    d.mem["musiku-sync-session"] = { url: "https://x.supabase.co", accessToken: "AT", refreshToken: "R", expiresAt: 9 };
    d.mem["musiku-sync-meta"] = { url: "https://x.supabase.co", anon: "ANON" };
    const f = d.fetchFn as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(ok([], 206, { "Content-Range": "0-0/7" }))
      .mockResolvedValueOnce(ok([], 206, { "Content-Range": "0-0/3" }));
    expect(await getCounts(d)).toEqual({ playlists: 7, favorites: 3 });
    await logout(d);
    expect(await loadSession(d)).toBeNull();
  });
});
