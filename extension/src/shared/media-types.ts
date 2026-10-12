// Tipe pesan & state bersama service-worker <-> popup <-> offscreen.

export type SourceKind = "local" | "musiku-tab" | "generic-tab";

export interface Capabilities {
  play: boolean;
  pause: boolean;
  next: boolean;
  prev: boolean;
  seek: boolean;
  mute: boolean;
  eq: boolean;
}

export const NO_CAPS: Capabilities = {
  play: false, pause: false, next: false, prev: false, seek: false, mute: false, eq: false,
};

export interface MediaInfo {
  title: string;
  artist: string;
  artwork: string; // URL data/http, "" bila tak ada
  duration: number; // detik, NaN bila tak diketahui
  position: number; // detik
  playing: boolean;
}

export interface SourceState {
  id: string; // "local" | `tab:${tabId}`
  kind: SourceKind;
  tabId?: number;
  tabTitle?: string;
  tabUrl?: string;
  audible?: boolean;
  muted?: boolean;
  media: MediaInfo;
  caps: Capabilities;
  /** Chip status jujur untuk UI. */
  statusNote: "EQ tersedia" | "Kontrol terbatas" | "Sumber tidak didukung" | "Siap";
}

export type MediaCommand =
  | { cmd: "play" | "pause" | "next" | "prev" }
  | { cmd: "seek"; value: number }
  | { cmd: "mute"; value: boolean };

export type ExtensionMessage =
  | { type: "GET_STATE" }
  | { type: "SELECT"; id: string }
  | { type: "COMMAND"; id: string; command: MediaCommand }
  | { type: "OPEN_TAB"; tabId: number }
  | { type: "LOCAL_LIST" }
  | { type: "LOCAL_ADD"; name: string; mime: string; buffer: ArrayBuffer }
  | { type: "LOCAL_DELETE"; id: string }
  | { type: "LOCAL_PLAY"; index: number }
  | { type: "LOCAL_EQ"; gains: number[] }
  | { type: "LOCAL_VOLUME"; value: number }
  | { type: "AUTH_STATUS" }
  | { type: "AUTH_COUNTS" }
  | { type: "AUTH_LOGIN"; url: string; anon: string; email: string; password: string }
  | { type: "AUTH_LOGOUT" }
  | { type: "CAPTURE_CHECK"; tabId: number };
