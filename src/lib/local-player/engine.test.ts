import { describe, it, expect, vi } from "vitest";
import { LocalAudioEngine, type LocalEngineTrack } from "@/lib/local-player/engine";

function fakeAudio() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    src: "",
    currentTime: 0,
    duration: 120,
    volume: 0.9,
    paused: true,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn((t: string, fn: () => void) => {
      listeners.set(t, [...(listeners.get(t) ?? []), fn]);
    }),
    removeEventListener: vi.fn(),
    fire: (t: string) => listeners.get(t)?.forEach((fn) => fn()),
  };
}

function fakeCtx() {
  return {
    currentTime: 0,
    destination: {},
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({
      type: "", frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 },
      connect: vi.fn(), disconnect: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

const T = (id: string): LocalEngineTrack => ({ id, title: id, artist: "", duration: 60, src: `blob:${id}` });

describe("LocalAudioEngine antrean", () => {
  it("setQueue + play + next/prev berurutan", async () => {
    const el = fakeAudio();
    const ev: string[] = [];
    const eng = new LocalAudioEngine((e) => ev.push(e.type), {
      createAudio: () => el as never,
      createCtx: () => fakeCtx() as unknown as AudioContext,
    });
    eng.setQueue([T("a"), T("b"), T("c")], 0);
    expect(eng.current?.id).toBe("a");
    await eng.play();
    expect(el.play).toHaveBeenCalled();
    eng.next();
    expect(eng.current?.id).toBe("b");
    eng.prev();
    expect(eng.current?.id).toBe("a");
    expect(ev).toContain("track");
    eng.destroy();
  });

  it("repeat all melingkar; repeat off berhenti di akhir", async () => {
    const el = fakeAudio();
    const eng = new LocalAudioEngine(() => {}, {
      createAudio: () => el as never,
      createCtx: () => fakeCtx() as unknown as AudioContext,
    });
    eng.setQueue([T("a"), T("b")], 1);
    eng.setRepeat("all");
    eng.next();
    expect(eng.current?.id).toBe("a");
    eng.setRepeat("off");
    eng.setQueue([T("a"), T("b")], 1);
    el.fire("ended");
    expect(eng.current?.id).toBe("b"); // tidak maju
    eng.destroy();
  });

  it("repeat one mengulang lagu yang sama", async () => {
    const el = fakeAudio();
    const eng = new LocalAudioEngine(() => {}, {
      createAudio: () => el as never,
      createCtx: () => fakeCtx() as unknown as AudioContext,
    });
    eng.setQueue([T("a")], 0);
    eng.setRepeat("one");
    el.currentTime = 55;
    el.fire("ended");
    expect(el.currentTime).toBe(0);
    expect(eng.current?.id).toBe("a");
    eng.destroy();
  });

  it("shuffle mencakup semua lagu tanpa duplikat posisi", () => {
    const el = fakeAudio();
    const eng = new LocalAudioEngine(() => {}, {
      createAudio: () => el as never,
      createCtx: () => fakeCtx() as unknown as AudioContext,
    });
    eng.setQueue([T("a"), T("b"), T("c"), T("d")], 0);
    eng.setShuffle(true);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add(eng.current!.id);
      eng.next();
    }
    expect(seen).toEqual(new Set(["a", "b", "c", "d"]));
    eng.destroy();
  });

  it("seek/volume di-clamp; EQ gain diteruskan (clamp ±12)", async () => {
    const el = fakeAudio();
    const ctx = fakeCtx();
    const eng = new LocalAudioEngine(() => {}, {
      createAudio: () => el as never,
      createCtx: () => ctx as unknown as AudioContext,
    });
    eng.setQueue([T("a")], 0);
    await eng.play(); // membangun graph
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(10);
    eng.applyEq([99, 0, 0, 0, 0, 0, 0, 0, 0, -99]);
    const filters = vi.mocked(ctx.createBiquadFilter).mock.results;
    expect(filters[0].value.gain.value).toBe(12);
    expect(filters[9].value.gain.value).toBe(-12);
    eng.seekTo(9999);
    expect(el.currentTime).toBe(120);
    eng.setVolume(5);
    expect(eng.getVolume()).toBe(1);
    eng.destroy();
    expect(ctx.close).toHaveBeenCalled();
  });
});
