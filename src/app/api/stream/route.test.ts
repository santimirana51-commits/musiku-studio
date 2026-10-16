import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, HEAD, OPTIONS } from "@/app/api/stream/route";
import { NextRequest } from "next/server";

describe("/api/stream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("OPTIONS /api/stream", () => {
    it("returns 204 with comprehensive CORS and Range headers for Web Audio API", async () => {
      const req = new NextRequest("http://localhost:3000/api/stream", { method: "OPTIONS" });
      const res = await OPTIONS(req);
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      expect(res.headers.get("access-control-allow-methods")).toContain("HEAD");
      expect(res.headers.get("access-control-allow-methods")).toContain("OPTIONS");
      expect(res.headers.get("access-control-allow-headers")).toContain("Range");
      expect(res.headers.get("access-control-expose-headers")).toContain("Content-Range");
    });
  });

  describe("GET /api/stream validation", () => {
    it("returns 400 with CORS header if videoId is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/stream");
      const res = await GET(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      const body = await res.json();
      expect(body.error).toContain("tidak valid");
    });

    it("returns 400 if videoId is malformed", async () => {
      const req = new NextRequest("http://localhost:3000/api/stream?v=invalid_id");
      const res = await GET(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  describe("HEAD /api/stream validation", () => {
    it("returns 400 if videoId is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/stream", { method: "HEAD" });
      const res = await HEAD(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("returns 400 if videoId is malformed", async () => {
      const req = new NextRequest("http://localhost:3000/api/stream?v=short", { method: "HEAD" });
      const res = await HEAD(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  describe("External Stream Proxy Redirect", () => {
    const originalEnv = process.env.STREAM_PROXY_URL;

    it("redirects with 307 to external proxy URL when configured", async () => {
      process.env.STREAM_PROXY_URL = "https://musiku-stream.example.com";
      const req = new NextRequest("http://localhost:3000/api/stream?v=3anKQbvVS90");
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://musiku-stream.example.com/api/stream?v=3anKQbvVS90");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      process.env.STREAM_PROXY_URL = originalEnv;
    });
  });
});
