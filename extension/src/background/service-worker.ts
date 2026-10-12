// Service worker MV3: deteksi tab audible + routing pesan. Logika murni di
// registry.ts & musiku-sync.ts (teruji); di sini hanya wiring chrome.*.

import { SourceRegistry } from "./registry.js";
import { isMusikuUrl, pickAudibleTab } from "../shared/arbitration.js";
import { login, logout, loadSession, getCounts } from "./musiku-sync.js";
import type { ExtensionMessage, MediaCommand } from "../shared/media-types.js";

const registry = new SourceRegistry();
const lastSeen = new Map<number, number>();
const injectedTabs = new Set<number>();

const deps = {
  fetchFn: fetch.bind(globalThis),
  store: chrome.storage.local,
};

async function hasMusikuAccess(url: string | undefined): Promise<boolean> {
  if (!isMusikuUrl(url)) return false;
  try {
    return await chrome.permissions.contains({ origins: ["http://localhost/*", "https://localhost/*"] });
  } catch {
    return false;
  }
}

async function probeTabMedia(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/musiku-media.js"],
    });
    injectedTabs.add(tabId);
    const rep = await chrome.tabs.sendMessage<{ hasMedia: boolean }>(tabId, { type: "MUSIKU_MEDIA_GET" });
    return rep?.hasMedia === true;
  } catch {
    return false;
  }
}

async function tabMediaState(tabId: number): Promise<{ paused: boolean; position: number; duration: number } | null> {
  if (!injectedTabs.has(tabId)) return null;
  try {
    const rep = await chrome.tabs.sendMessage<{ hasMedia: boolean; paused: boolean; currentTime: number; duration: number }>(tabId, { type: "MUSIKU_MEDIA_GET" });
    if (!rep?.hasMedia) return null;
    return { paused: rep.paused, position: rep.currentTime, duration: rep.duration };
  } catch {
    return null;
  }
}

async function refreshTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ audible: true });
  } catch {
    return;
  }
  const now = Date.now();
  const ids = new Set<number>();
  for (const t of tabs) {
    if (t.id === undefined) continue;
    ids.add(t.id);
    lastSeen.set(t.id, now);
    const access = await hasMusikuAccess(t.url);
    const hasMedia = access ? await probeTabMedia(t.id) : false;
    registry.upsertTab(
      {
        tabId: t.id,
        title: t.title ?? "Tab media",
        url: t.url ?? "",
        audible: !!t.audible,
        muted: !!t.mutedInfo?.muted,
        active: !!t.active,
      },
      { isMusiku: isMusikuUrl(t.url), hasAccess: access, hasMedia }
    );
  }
  registry.prune(ids);
}

async function ensureOffscreen(): Promise<boolean> {
  try {
    if (await chrome.offscreen.hasDocument()) return true;
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Pemutaran file lokal MusikKu + equalizer + Media Session.",
    });
    return true;
  } catch {
    return false;
  }
}

async function forwardToOffscreen(msg: unknown): Promise<unknown> {
  if (!(await ensureOffscreen())) throw new Error("Offscreen tak tersedia di browser ini.");
  return chrome.runtime.sendMessage(msg);
}

async function commandTab(tabId: number, command: MediaCommand): Promise<{ ok: boolean; note: string }> {
  if (command.cmd === "mute") {
    await chrome.tabs.update(tabId, { muted: command.value });
    return { ok: true, note: "ok" };
  }
  // Jalur utama: content script yang sudah diinjeksi (bila ada).
  if (injectedTabs.has(tabId) && (command.cmd === "play" || command.cmd === "pause" || command.cmd === "seek")) {
    try {
      const res = await chrome.tabs.sendMessage<{ ok: boolean; note: string }>(tabId, {
        type: "MUSIKU_MEDIA_CMD",
        cmd: command.cmd,
        value: command.cmd === "seek" ? command.value : undefined,
      });
      if (res && typeof res.ok === "boolean") return res;
    } catch {
      // Lanjut ke fallback func di bawah.
    }
  }
  // Fallback: injeksi fungsi sekali pakai (butuh izin host yang sama).
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: (cmd: string, value: number | undefined) => {
        const els = Array.from(document.querySelectorAll("audio,video")).filter(
          (e): e is HTMLMediaElement => e instanceof HTMLMediaElement
        );
        const m = els.find((e) => !e.paused) ?? els[0];
        if (!m) return "no-media";
        if (cmd === "play") void m.play().catch(() => {});
        else if (cmd === "pause") m.pause();
        else if (cmd === "seek" && typeof value === "number") {
          try {
            m.currentTime = Math.max(0, value);
          } catch {
            return "seek-unsupported";
          }
        } else return "unsupported";
        return "ok";
      },
      args: [command.cmd, command.cmd === "seek" ? command.value : undefined],
    });
    const r = String(res[0]?.result ?? "unsupported");
    return { ok: r === "ok", note: r };
  } catch {
    // Tanpa izin host: scripting ditolak — laporkan jujur, jangan klaim sukses.
    return { ok: false, note: "no-access" };
  }
}

chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.audible !== undefined) void refreshTabs();
});
chrome.tabs.onRemoved.addListener((id) => {
  registry.removeTab(id);
  injectedTabs.delete(id);
});

chrome.runtime.onMessage.addListener((raw, sender, respond) => {
  // Pesan dari offscreen (tanpa tab) diteruskan apa adanya bila perlu.
  if (sender.tab !== undefined) return;
  const msg = raw as ExtensionMessage;
  (async () => {
    switch (msg.type) {
      case "GET_STATE": {
        await refreshTabs();
        const tabs = await chrome.tabs.query({ audible: true }).catch(() => []);
        const cands = tabs
          .filter((t) => t.id !== undefined)
          .map((t) => ({ tabId: t.id!, audible: !!t.audible, active: !!t.active, lastSeen: lastSeen.get(t.id!) ?? 0 }));
        const act = registry.active(pickAudibleTab(cands));
        // Perkaya kartu aktif tab-MusikKu dengan posisi/playing live.
        if (act && act.tabId !== undefined && act.kind === "musiku-tab") {
          const st = await tabMediaState(act.tabId);
          if (st) {
            act.media = { ...act.media, position: st.position, duration: st.duration, playing: !st.paused };
          }
        }
        respond({ sources: registry.list(), active: act });
        break;
      }
      case "SELECT":
        respond({ ok: registry.select(msg.id) });
        break;
      case "COMMAND": {
        const target = registry.list().find((s) => s.id === msg.id);
        if (!target) {
          respond({ ok: false, note: "unknown-source" });
          break;
        }
        if (target.id === "local" || target.kind === "local") {
          respond(await forwardToOffscreen(msg).catch((e) => ({ ok: false, note: String(e) })));
          break;
        }
        if (target.tabId === undefined) {
          respond({ ok: false, note: "unknown-source" });
          break;
        }
        respond(await commandTab(target.tabId, msg.command));
        break;
      }
      case "OPEN_TAB":
        await chrome.tabs.update(msg.tabId, { active: true });
        respond({ ok: true });
        break;
      case "LOCAL_LIST":
      case "LOCAL_ADD":
      case "LOCAL_DELETE":
      case "LOCAL_PLAY":
      case "LOCAL_EQ":
      case "LOCAL_VOLUME":
        respond(await forwardToOffscreen(msg).catch((e) => ({ ok: false, note: String(e) })));
        break;
      case "AUTH_STATUS": {
        const s = await loadSession(deps);
        respond({ loggedIn: !!s, url: s?.url ?? null });
        break;
      }
      case "AUTH_LOGIN":
        try {
          await login(deps, { url: msg.url, anon: msg.anon ?? "", email: msg.email, password: msg.password });
          respond({ ok: true });
        } catch (e) {
          respond({ ok: false, note: e instanceof Error ? e.message : "Login gagal." });
        }
        break;
      case "AUTH_LOGOUT":
        await logout(deps);
        respond({ ok: true });
        break;
      case "AUTH_COUNTS":
        try {
          const counts = await getCounts(deps);
          respond({ ok: true, counts });
        } catch (e) {
          respond({ ok: false, note: e instanceof Error ? e.message : "gagal" });
        }
        break;
      default:
        respond({ ok: false, note: "unknown-message" });
    }
  })();
  return true;
});

// Permintaan izin host opsional dipicu dari popup via permissions API langsung;
// SW tidak meminta apa pun sendiri (prinsip izin minimum).
void refreshTabs();
