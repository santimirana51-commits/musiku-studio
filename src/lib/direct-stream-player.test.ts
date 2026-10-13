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
});
