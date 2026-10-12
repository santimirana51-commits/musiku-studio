import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "@/app/api/search/route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

describe("GET /api/search", () => {
  it("400 untuk query kosong", async () => {
    process.env.YOUTUBE_API_KEY = "dummy";
    const res = await GET(new Request("http://localhost/api/search?q=%20%20"));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBeTruthy();
  });

  it("503 bila API key belum dikonfigurasi", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=noah"));
    expect(res.status).toBe(503);
  });

  it("429 ramah saat kuota habis tanpa retry loop", async () => {
    process.env.YOUTUBE_API_KEY = "dummy";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }),
          { status: 403 }
        )
      )
    );
    const res = await GET(new Request("http://localhost/api/search?q=noah"));
    expect(res.status).toBe(429);
    const j = await res.json();
    expect(j.error).toMatch(/Kuota/i);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("200 memetakan hasil resmi", async () => {
    process.env.YOUTUBE_API_KEY = "dummy";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: { videoId: "dQw4w9WgXcQ" },
                snippet: {
                  title: "Judul",
                  channelTitle: "Channel",
                  thumbnails: { medium: { url: "https://i.ytimg.com/vi/x/mqdefault.jpg" } },
                },
              },
            ],
            nextPageToken: "TOKEN",
          }),
          { status: 200 }
        )
      )
    );
    const res = await GET(new Request("http://localhost/api/search?q=noah&maxResults=5"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.items[0].videoId).toBe("dQw4w9WgXcQ");
    expect(j.nextPageToken).toBe("TOKEN");
  });
});
