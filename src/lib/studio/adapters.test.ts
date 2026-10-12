import { describe, it, expect } from "vitest";
import {
  createAudioBackendAdapter,
  WebAudioBackendAdapter,
  WindowsNativeBackendAdapter,
  AndroidNativeBackendAdapter,
} from "./adapters";
import { createEmptyProject, createTrack } from "./schema";

describe("Multiplatform Audio Backend Adapters", () => {
  it("instantiates WebAudioBackendAdapter correctly and retrieves audio stats", async () => {
    const adapter = new WebAudioBackendAdapter();
    expect(adapter.backendType).toBe("web-audio");

    const stats = await adapter.getStats();
    expect(stats.backendType).toBe("web-audio");
    expect(stats.sampleRate).toBeGreaterThan(0);
    expect(stats.isRealtimeSafe).toBe(true);
  });

  it("instantiates WindowsNativeBackendAdapter with separated architecture and safe fallback", async () => {
    const adapter = new WindowsNativeBackendAdapter();
    expect(adapter.backendType).toBe("windows-native");

    const stats = await adapter.getStats();
    expect(stats.backendType).toBe("windows-native");
    expect(stats.driverName).toContain("Windows Native");
  });

  it("instantiates AndroidNativeBackendAdapter with Oboe C++ profile and safe fallback", async () => {
    const adapter = new AndroidNativeBackendAdapter();
    expect(adapter.backendType).toBe("android-native");

    const stats = await adapter.getStats();
    expect(stats.backendType).toBe("android-native");
    expect(stats.driverName).toContain("Android");
  });

  it("loads the identical StudioProject schema across all 3 platform adapters without errors", async () => {
    const project = createEmptyProject("Multiplatform Shared Project");
    project.tracks.push(createTrack("audio", "Vocal Stem", 2));

    const webAdapter = new WebAudioBackendAdapter();
    const winAdapter = new WindowsNativeBackendAdapter();
    const androidAdapter = new AndroidNativeBackendAdapter();

    await expect(webAdapter.loadProject(project)).resolves.not.toThrow();
    await expect(winAdapter.loadProject(project)).resolves.not.toThrow();
    await expect(androidAdapter.loadProject(project)).resolves.not.toThrow();
  });

  it("factory createAudioBackendAdapter resolves forced and detected platform correctly", () => {
    const web = createAudioBackendAdapter("web-audio");
    expect(web.backendType).toBe("web-audio");

    const win = createAudioBackendAdapter("windows-native");
    expect(win.backendType).toBe("windows-native");

    const android = createAudioBackendAdapter("android-native");
    expect(android.backendType).toBe("android-native");
  });
});
