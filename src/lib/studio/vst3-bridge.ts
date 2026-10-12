import type { Vst3PluginDescriptor } from "./types";
import type { NativeAudioStats } from "./adapters/types";

/**
 * Cek apakah platform saat ini adalah desktop Windows dengan host VST3 native
 */
export function isNativeVst3Supported(): boolean {
  if (typeof window === "undefined") return false;
  const isTauri = Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
  const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent || navigator.platform || "");
  return isTauri && isWindows;
}

interface TauriInvoke {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}

function getTauri(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const tauri = (window as unknown as { __TAURI__?: TauriInvoke }).__TAURI__;
  if (tauri && typeof tauri.invoke === "function") {
    return tauri;
  }
  return null;
}

/**
 * Pindai plugin VST3 yang terinstal di komputer Windows (via IPC Tauri)
 */
export async function scanVst3Plugins(): Promise<Vst3PluginDescriptor[]> {
  if (!isNativeVst3Supported()) {
    return [];
  }

  const tauri = getTauri();
  if (!tauri) return [];

  try {
    const results = await tauri.invoke("scan_vst3_plugins");
    return Array.isArray(results) ? (results as Vst3PluginDescriptor[]) : [];
  } catch (err) {
    console.warn("Gagal memindai plugin VST3 via host native:", err);
  }

  return [];
}

/**
 * Muat instance VST3 ke dalam host native terisolasi di background thread
 */
export async function loadVst3Plugin(
  trackId: string,
  pluginPath: string
): Promise<{ instanceId: string; status: string } | null> {
  const tauri = getTauri();
  if (!tauri) return null;

  try {
    const res = (await tauri.invoke("load_vst3_plugin", {
      trackId,
      pluginPath,
    })) as { instanceId: string; status: string };
    return res;
  } catch (err) {
    console.warn("Gagal memuat instance VST3:", err);
    return null;
  }
}

/**
 * Unload plugin VST3 dari memori
 */
export async function unloadVst3Plugin(instanceId: string): Promise<boolean> {
  const tauri = getTauri();
  if (!tauri) return false;

  try {
    const res = await tauri.invoke("unload_vst3_plugin", { pluginInstanceId: instanceId });
    return Boolean(res);
  } catch {
    return false;
  }
}

/**
 * Ambil telemetri performa audio native Windows
 */
export async function getNativeAudioStats(): Promise<NativeAudioStats | null> {
  const tauri = getTauri();
  if (!tauri) return null;

  try {
    const res = (await tauri.invoke("get_native_audio_stats")) as NativeAudioStats;
    return res;
  } catch {
    return null;
  }
}
