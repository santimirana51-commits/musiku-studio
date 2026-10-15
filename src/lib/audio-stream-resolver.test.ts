import { describe, it, expect, beforeEach } from "vitest";
import {
  extractExpiryMs,
  findYtDlpBinary,
  streamUrlCache,
  DEFAULT_CACHE_TTL_MS,
} from "./audio-stream-resolver";

describe("audio-stream-resolver", () => {
  beforeEach(() => {
    streamUrlCache.clear();
  });

  describe("findYtDlpBinary", () => {
    it("returns a string binary path", () => {
      const binary = findYtDlpBinary();
      expect(typeof binary).toBe("string");
      expect(binary.length).toBeGreaterThan(0);
    });
  });

  describe("extractExpiryMs", () => {
    it("uses default TTL if expire parameter is missing", () => {
      const url = "https://example.com/audio.m4a";
      const before = Date.now() + DEFAULT_CACHE_TTL_MS;
      const expiry = extractExpiryMs(url);
      const after = Date.now() + DEFAULT_CACHE_TTL_MS;
      expect(expiry).toBeGreaterThanOrEqual(before);
      expect(expiry).toBeLessThanOrEqual(after + 100);
    });

    it("parses unix expire param with 5 minute buffer", () => {
      // Future timestamp (1 hour from now)
      const futureSec = Math.floor(Date.now() / 1000) + 3600;
      const url = `https://rr.googlevideo.com/videoplayback?expire=${futureSec}&itag=140`;
      const expiry = extractExpiryMs(url);
      const expected = futureSec * 1000 - 5 * 60 * 1000;
      expect(expiry).toBe(expected);
    });

    it("falls back to default TTL if expire is in the past", () => {
      const pastSec = 1000000;
      const url = `https://rr.googlevideo.com/videoplayback?expire=${pastSec}&itag=140`;
      const expiry = extractExpiryMs(url);
      expect(expiry).toBeGreaterThan(Date.now());
    });
  });
});
