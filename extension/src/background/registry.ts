// Registry sumber media: murni (tanpa API chrome) agar unit-testable.
// Service worker hanya menjadi lapisan tipis di atasnya.

import { NO_CAPS, type Capabilities, type SourceState } from "../shared/media-types.js";
import { resolveActiveSource } from "../shared/arbitration.js";

export interface TabInfo {
  tabId: number;
  title: string;
  url: string;
  audible: boolean;
  muted: boolean;
  active: boolean;
}

const LIMITED: Capabilities = { ...NO_CAPS, mute: true };

export class SourceRegistry {
  private sources = new Map<string, SourceState>();
  private selectedId: string | null = null;
  private local: SourceState | null = null;

  setLocal(s: SourceState | null): void {
    this.local = s;
    if (s) this.sources.set("local", s);
    else this.sources.delete("local");
  }

  upsertTab(tab: TabInfo, opts: { isMusiku: boolean; hasAccess: boolean; hasMedia?: boolean }): SourceState {
    const id = `tab:${tab.tabId}`;
    const caps: Capabilities =
      opts.isMusiku && opts.hasAccess && opts.hasMedia
        ? { play: true, pause: true, next: false, prev: false, seek: true, mute: true, eq: false }
        : { ...LIMITED };
    const statusNote = opts.isMusiku
      ? opts.hasAccess
        ? opts.hasMedia
          ? "Kontrol terbatas"
          : "Sumber tidak didukung"
        : "Kontrol terbatas"
      : "Kontrol terbatas";
    const s: SourceState = {
      id,
      kind: opts.isMusiku ? "musiku-tab" : "generic-tab",
      tabId: tab.tabId,
      tabTitle: tab.title,
      tabUrl: tab.url,
      audible: tab.audible,
      muted: tab.muted,
      media: {
        title: tab.title || "Tab media",
        artist: "",
        artwork: "",
        duration: NaN,
        position: 0,
        playing: tab.audible,
      },
      caps,
      statusNote,
    };
    this.sources.set(id, s);
    return s;
  }

  /** Hapus sumber tab yang tak lagi audible (dipanggil tiap refresh). */
  prune(audibleTabIds: Set<number>): void {
    this.sources.forEach((s, id) => {
      if (s.tabId !== undefined && !audibleTabIds.has(s.tabId)) this.sources.delete(id);
    });
    if (this.selectedId && !this.sources.has(this.selectedId)) this.selectedId = null;
  }

  removeTab(tabId: number): void {
    this.sources.delete(`tab:${tabId}`);
    if (this.selectedId === `tab:${tabId}`) this.selectedId = null;
  }

  select(id: string): boolean {
    if (!this.sources.has(id)) return false;
    this.selectedId = id;
    return true;
  }

  list(): SourceState[] {
    return Array.from(this.sources.values());
  }

  active(audibleTabId: number | null): SourceState | null {
    const id = resolveActiveSource(this.list(), this.selectedId, audibleTabId);
    return this.sources.get(id ?? "") ?? null;
  }

  get selected(): string | null {
    return this.selectedId;
  }
}
