import { describe, it, expect } from "vitest";
import { formatDuration, formatSeconds } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

describe("format durasi", () => {
  it("mengurai ISO 8601 YouTube", () => {
    expect(formatDuration("PT4M13S")).toBe("4:13");
    expect(formatDuration("PT1H2M3S")).toBe("1:02:03");
    expect(formatDuration(undefined)).toBe("");
  });
  it("memformat detik player", () => {
    expect(formatSeconds(65)).toBe("1:05");
    expect(formatSeconds(3661)).toBe("1:01:01");
    expect(formatSeconds(-1)).toBe("0:00");
  });
});

describe("rate limit", () => {
  it("membatasi melebihi limit", () => {
    const key = `tes-${Date.now()}`;
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
