// stream-proxy/server.test.ts
// Unit test komprehensif untuk StreamProxy microservice

import { describe, it, expect } from "vitest";

// Server module menggunakan CommonJS exports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  findYtDlpBinary,
  getNodeRuntime,
  selectBestAudioFormat,
  classifyExtractionError,
  sanitizeLog,
  extractExpiryMs,
} = require("./server");

describe("StreamProxy Module", () => {
  describe("findYtDlpBinary & getNodeRuntime", () => {
    it("locates yt-dlp binary on the system", () => {
      const binary = findYtDlpBinary();
      expect(typeof binary).toBe("string");
      expect(binary.length).toBeGreaterThan(0);
    });

    it("detects valid Node.js runtime executable path", () => {
      const runtime = getNodeRuntime();
      expect(typeof runtime).toBe("string");
      expect(runtime).toContain("node");
    });
  });

  describe("selectBestAudioFormat", () => {
    it("returns null for empty formats list", () => {
      expect(selectBestAudioFormat([])).toBeNull();
      expect(selectBestAudioFormat(null)).toBeNull();
    });

    it("prefers standalone AAC m4a audio stream (e.g. format 140)", () => {
      const sampleFormats = [
        { format_id: "139", ext: "m4a", acodec: "mp4a.40.5", vcodec: "none", abr: 48, url: "https://googlevideo.com/139" },
        { format_id: "140", ext: "m4a", acodec: "mp4a.40.2", vcodec: "none", abr: 128, url: "https://googlevideo.com/140" },
        { format_id: "251", ext: "webm", acodec: "opus", vcodec: "none", abr: 128, url: "https://googlevideo.com/251" },
        { format_id: "18", ext: "mp4", acodec: "mp4a.40.2", vcodec: "avc1.42001E", tbr: 440, url: "https://googlevideo.com/18" },
      ];

      const best = selectBestAudioFormat(sampleFormats);
      expect(best).not.toBeNull();
      expect(best.formatId).toBe("140");
      expect(best.ext).toBe("m4a");
      expect(best.url).toBe("https://googlevideo.com/140");
    });

    it("falls back to format 18 (video+audio) when standalone audio is unavailable", () => {
      // Skenario YouTube client android/tv di mana audio-only dibatasi
      const limitedFormats = [
        { format_id: "sb0", ext: "mhtml", acodec: "none", vcodec: "none", url: "https://googlevideo.com/sb0" },
        { format_id: "18", ext: "mp4", acodec: "mp4a.40.2", vcodec: "avc1.42001E", tbr: 440, url: "https://googlevideo.com/18" },
      ];

      const best = selectBestAudioFormat(limitedFormats);
      expect(best).not.toBeNull();
      expect(best.formatId).toBe("18");
      expect(best.ext).toBe("mp4");
      expect(best.url).toBe("https://googlevideo.com/18");
    });

    it("ignores HLS m3u8 playlists and storyboard images", () => {
      const mixedFormats = [
        { format_id: "233", ext: "mp4", acodec: "unknown", url: "https://manifest.googlevideo.com/api/manifest/hls_playlist/233.m3u8" },
        { format_id: "251", ext: "webm", acodec: "opus", vcodec: "none", abr: 128, url: "https://googlevideo.com/251" },
      ];

      const best = selectBestAudioFormat(mixedFormats);
      expect(best).not.toBeNull();
      expect(best.formatId).toBe("251");
    });
  });

  describe("classifyExtractionError", () => {
    it("classifies page reload error correctly", () => {
      const err = "ERROR: [youtube] dQw4w9WgXcQ: The page needs to be reloaded. (UNPLAYABLE)";
      expect(classifyExtractionError(err)).toBe("PAGE_RELOAD");
    });

    it("classifies format not available error correctly", () => {
      const err = "ERROR: Requested format is not available";
      expect(classifyExtractionError(err)).toBe("FORMAT_UNAVAILABLE");
    });

    it("classifies bot check correctly", () => {
      const err = "ERROR: Sign in to confirm you’re not a bot.";
      expect(classifyExtractionError(err)).toBe("BOT_CHECK");
    });

    it("classifies unavailable video correctly", () => {
      const err = "ERROR: [youtube] 123: This video is unavailable";
      expect(classifyExtractionError(err)).toBe("UNAVAILABLE");
    });

    it("classifies unknown error as UNKNOWN", () => {
      expect(classifyExtractionError("Some random network glitch")).toBe("UNKNOWN");
    });
  });

  describe("sanitizeLog", () => {
    it("redacts cookies and tokens from log messages", () => {
      const sensitive = "Error with cookie: SID=xyz123; HSID=abc456 and token=secret_po_token_999";
      const sanitized = sanitizeLog(sensitive);
      expect(sanitized).not.toContain("xyz123");
      expect(sanitized).not.toContain("secret_po_token_999");
      expect(sanitized).toContain("[REDACTED]");
    });

    it("redacts stream query params in videoplayback URLs", () => {
      const urlMsg = "Streaming from https://rr5---sn.googlevideo.com/videoplayback?expire=123&sig=SECRET_SIG&lsig=SECRET_LSIG";
      const sanitized = sanitizeLog(urlMsg);
      expect(sanitized).not.toContain("SECRET_SIG");
      expect(sanitized).not.toContain("SECRET_LSIG");
      expect(sanitized).toContain("[STREAM_PARAMS_REDACTED]");
    });
  });

  describe("extractExpiryMs", () => {
    it("extracts expire param from URL and subtracts 5 minute buffer", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const expireInOneHour = nowSec + 3600;
      const url = `https://rr1.googlevideo.com/videoplayback?expire=${expireInOneHour}&itag=140`;

      const expiryMs = extractExpiryMs(url);
      const expectedMs = expireInOneHour * 1000 - 5 * 60 * 1000;
      expect(expiryMs).toBe(expectedMs);
    });

    it("falls back to default TTL if expire param is absent", () => {
      const url = "https://example.com/stream.mp4";
      const expiryMs = extractExpiryMs(url);
      expect(expiryMs).toBeGreaterThan(Date.now());
    });
  });
});
