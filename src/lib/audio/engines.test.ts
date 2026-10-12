import { describe, it, expect, vi } from "vitest";
import { WebYouTubeEngine, webYouTubeCapabilities } from "@/lib/audio/web-youtube-engine";
import { WebLocalEngine, webLocalCapabilities } from "@/lib/audio/web-local-engine";
import { detectWebCapabilities } from "@/lib/audio/capabilities";
import { LocalAudioEngine } from "@/lib/local-player/engine";
import type { AudioTrack } from "@/lib/audio/types";

const YT = (id: string): AudioTrack => ({ id, kind: "youtube", title: id, artist: "ch", src: "", duration: null });
const LOCAL = (id: string): AudioTrack => ({ id, kind: "local-indexeddb", title: id, artist: "a", src: `blob:${id}`, duration: 60 });

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

describe("WebYouTubeEngine: capability jujur + transisi antrean", () => {
  it("capability: tanpa seek/volume/EQ/background/mediaSession", () => {
    const c = webYouTubeCapabilities();
    expect(c.canQueue && c.canNext && c.canPrev && c.canPlay && c.canPause).toBe(true);
    expect(c.canSeek).toBe(false);
    expect(c.canVolume).toBe(false);
    expect(c.canEqualize).toBe(false);
    expect(c.canBackground).toBe(false);
    expect(c.canMediaSession).toBe(false);
  });

  it("load hanya menerima track youtube; non-youtube difilter", () => {
    const e = new WebYouTubeEngine();
    e.load([YT("a"), LOCAL("b"), YT("c")], 0);
    expect(e.current?.id).toBe("a");
    e.next();
    expect(e.current?.id).toBe("c"); // b terfilter
    e.destroy();
  });

  it("play→playing, pause→paused, stop→idle kosong, error jujur", () => {
    const e = new WebYouTubeEngine();
    const states: string[] = [];
    e.onEvent((ev) => states.push(ev.state));
    e.load([YT("a")]);
    e.play();
    expect(e.state).toBe("playing");
    e.pause();
    expect(e.state).toBe("paused");
    e.setPlaybackError("Video tidak mengizinkan embedding (150)");
    expect(e.state).toBe("error");
    expect(e.error).toMatch(/150/);
    e.clearError();
    expect(e.state).toBe("paused");
    e.stop();
    expect(e.state).toBe("idle");
    expect(e.current).toBeNull();
    expect(states).toContain("playing");
    e.destroy();
  });

  it("next/prev melingkar; seek/volume/mute no-op aman", () => {
    const e = new WebYouTubeEngine();
    e.load([YT("a"), YT("b")], 0);
    e.play();
    e.next();
    expect(e.current?.id).toBe("b");
    e.next();
    expect(e.current?.id).toBe("a");
    e.prev();
    expect(e.current?.id).toBe("b");
    expect(() => {
      e.seekTo(30);
      e.setVolume(0.1);
      e.setMuted(true);
      e.setShuffle(true);
      e.setRepeat("all");
    }).not.toThrow();
    expect(e.isMuted()).toBe(false);
    e.destroy();
  });
});

describe("WebLocalEngine: adapter LocalAudioEngine", () => {
  function make() {
    const el = fakeAudio();
    const inner = new LocalAudioEngine(() => {}, {
      createAudio: () => el as never,
      createCtx: () => fakeCtx() as unknown as AudioContext,
    });
    const eng = new WebLocalEngine(() => inner);
    return { el, eng };
  }

  it("capability: background=false; equalize mengikuti AudioContext", () => {
    const c = webLocalCapabilities();
    expect(c.canBackground).toBe(false);
    expect(c.canSeek && c.canVolume && c.canQueue).toBe(true);
  });

  it("load→paused, play→playing, pause→paused, stop→idle", async () => {
    const { el, eng } = make();
    eng.load([LOCAL("a"), LOCAL("b")], 0);
    expect(eng.state).toBe("paused");
    expect(eng.current?.id).toBe("a");
    await eng.play();
    expect(eng.state).toBe("playing");
    expect(el.play).toHaveBeenCalled();
    eng.pause();
    expect(eng.state).toBe("paused");
    eng.stop();
    expect(eng.state).toBe("idle");
    eng.destroy();
  });

  it("mute menyimpan volume; unmute mengembalikan", async () => {
    const { eng } = make();
    eng.load([LOCAL("a")]);
    eng.setVolume(0.5);
    expect(eng.getVolume()).toBeCloseTo(0.5);
    eng.setMuted(true);
    expect(eng.isMuted()).toBe(true);
    eng.setMuted(false);
    expect(eng.isMuted()).toBe(false);
    expect(eng.getVolume()).toBeCloseTo(0.5);
    eng.destroy();
  });

  it("buffered() null jujur; duration dari track", () => {
    const { eng } = make();
    eng.load([LOCAL("a")]);
    expect(eng.buffered()).toBeNull();
    expect(eng.duration()).toBe(60);
    eng.destroy();
  });

  it("terhubung ke navigator.mediaSession bila tersedia di browser", () => {
    const handlers: Record<string, Function | null> = {};
    const mediaSessionMock = {
      metadata: null as any,
      playbackState: "none",
      setActionHandler: vi.fn((act: string, fn: any) => {
        handlers[act] = fn;
      }),
    };
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      mediaSession: mediaSessionMock,
    });
    vi.stubGlobal("MediaMetadata", class {
      title: string;
      artist: string;
      album: string;
      artwork: any[];
      constructor(init: any) {
        this.title = init.title;
        this.artist = init.artist;
        this.album = init.album;
        this.artwork = init.artwork;
      }
    });

    const { eng } = make();
    eng.load([LOCAL("a")]);
    expect(mediaSessionMock.metadata?.title).toBe("a");
    expect(mediaSessionMock.setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
    expect(mediaSessionMock.setActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));

    eng.destroy();
    expect(mediaSessionMock.metadata).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("detectWebCapabilities: boolean jujur", () => {
  it("mengembalikan boolean untuk semua flag", () => {
    const w = detectWebCapabilities();
    for (const v of Object.values(w)) expect(typeof v).toBe("boolean");
  });
});
