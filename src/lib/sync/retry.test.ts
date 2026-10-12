import { describe, it, expect } from "vitest";
import { classifyFailure, computeBackoffMs, maxSyncAttempts } from "@/lib/sync/retry";

describe("computeBackoffMs", () => {
  it("tumbuh eksponensial dari 1 detik", () => {
    const noJitter = () => 0;
    expect(computeBackoffMs(0, noJitter)).toBe(1000);
    expect(computeBackoffMs(1, noJitter)).toBe(2000);
    expect(computeBackoffMs(2, noJitter)).toBe(4000);
    expect(computeBackoffMs(3, noJitter)).toBe(8000);
  });

  it("dibatasi 5 menit + jitter maks 20%", () => {
    const noJitter = () => 0;
    expect(computeBackoffMs(99, noJitter)).toBe(300000);
    expect(computeBackoffMs(99, () => 1)).toBe(360000);
    expect(maxSyncAttempts()).toBe(10);
  });
});

describe("classifyFailure", () => {
  it("jaringan/429/5xx → retryable", () => {
    expect(classifyFailure({ status: null, message: "x" })).toBe("retryable");
    expect(classifyFailure({ status: 429, message: "x" })).toBe("retryable");
    expect(classifyFailure({ status: 500, message: "x" })).toBe("retryable");
    expect(classifyFailure({ status: 503, message: "x" })).toBe("retryable");
  });
  it("401 → unauthorized (jeda, bukan drop)", () => {
    expect(classifyFailure({ status: 401, message: "x" })).toBe("unauthorized");
  });
  it("400/403/404/422 → fatal (drop + catat)", () => {
    for (const s of [400, 403, 404, 422]) {
      expect(classifyFailure({ status: s, message: "x" })).toBe("fatal");
    }
  });
});
