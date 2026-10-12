import type { AudioBackendAdapter, AudioBackendType } from "./types";
import { WebAudioBackendAdapter } from "./web-adapter";
import { WindowsNativeBackendAdapter } from "./windows-adapter";
import { AndroidNativeBackendAdapter } from "./android-adapter";

/**
 * Deteksi platform dan instansiasi adapter audio yang sesuai:
 * - Desktop Windows (Tauri): WindowsNativeBackendAdapter (WASAPI/ASIO + VST3 host)
 * - Android (Capacitor): AndroidNativeBackendAdapter (Oboe/AAudio C++)
 * - Web Browser / PWA: WebAudioBackendAdapter (Web Audio API + AudioWorklet)
 */
export function createAudioBackendAdapter(forcedType?: AudioBackendType): AudioBackendAdapter {
  if (forcedType === "windows-native") {
    return new WindowsNativeBackendAdapter();
  }
  if (forcedType === "android-native") {
    return new AndroidNativeBackendAdapter();
  }
  if (forcedType === "web-audio") {
    return new WebAudioBackendAdapter();
  }

  if (typeof window === "undefined") {
    return new WebAudioBackendAdapter();
  }

  // Cek Tauri Desktop
  const isTauri = Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
  const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent || navigator.platform || "");
  if (isTauri && isWindows) {
    return new WindowsNativeBackendAdapter();
  }

  // Cek Capacitor Android
  const isCapacitor = Boolean(
    (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android"
  );
  if (isCapacitor) {
    return new AndroidNativeBackendAdapter();
  }

  // Default: Web Audio API
  return new WebAudioBackendAdapter();
}
