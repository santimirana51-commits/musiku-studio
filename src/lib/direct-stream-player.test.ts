import { describe, it, expect, vi, beforeEach } from "vitest";
import { DirectStreamPlayer } from "./direct-stream-player";

describe("DirectStreamPlayer Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes in idle state", () => {
    const player = new DirectStreamPlayer();
    expect(player.getState()).toBe("idle");
    expect(player.getCurrentVideoId()).toBeNull();
  });

  it("subscribes to state updates", () => {
    const player = new DirectStreamPlayer();
    const states: string[] = [];
    const unsub = player.subscribe({
      onState: (s) => states.push(s),
    });

    expect(states).toContain("idle");
    unsub();
  });

  it("accepts gain updates without errors", () => {
    const player = new DirectStreamPlayer();
    player.applyGains([5, 4, 3, 2, 1, 0, -1, -2, -3, -4], true);
    player.setPreamp(2);
    // Does not throw
    expect(true).toBe(true);
  });

  describe("resolveStreamApiUrl", () => {
    it("returns local /api/stream by default", async () => {
      const { resolveStreamApiUrl } = await import("./direct-stream-player");
      const url = resolveStreamApiUrl("3anKQbvVS90");
      expect(url).toBe("/api/stream?v=3anKQbvVS90");
    });

    it("uses NEXT_PUBLIC_STREAM_PROXY_URL when set", async () => {
      const prev = process.env.NEXT_PUBLIC_STREAM_PROXY_URL;
      process.env.NEXT_PUBLIC_STREAM_PROXY_URL = "https://stream.example.com";
      const { resolveStreamApiUrl } = await import("./direct-stream-player");
      const url = resolveStreamApiUrl("3anKQbvVS90");
      expect(url).toBe("https://stream.example.com/api/stream?v=3anKQbvVS90");
      process.env.NEXT_PUBLIC_STREAM_PROXY_URL = prev;
    });
  });
});
