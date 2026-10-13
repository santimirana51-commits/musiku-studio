import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/stream/route";
import { NextRequest } from "next/server";

describe("GET /api/stream", () => {
  it("returns 400 if videoId is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/stream");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("tidak valid");
  });

  it("returns 400 if videoId is malformed", async () => {
    const req = new NextRequest("http://localhost:3000/api/stream?v=invalid_id");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
