// Popup: kartu aktif, transport jujur-per-kapabilitas, daftar sumber,
// pustaka lokal, EQ lokal, akun Supabase opsional, cek capture.

import { EQ_BANDS, EQ_PRESETS, clampDb } from "../shared/eq.js";
import { checkTabCapture } from "../shared/capture.js";
import type { ExtensionMessage, SourceState } from "../shared/media-types.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`#${id} hilang`);
  return el;
};

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function send<T>(msg: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage<T>(msg);
}

interface LocalTrack {
  id: string;
  name: string;
  mime: string;
  size: number;
  addedAt: number;
}

let active: SourceState | null = null;
let sources: SourceState[] = [];
let localTracks: LocalTrack[] = [];
let localIndex = -1;
let localPlaying = false;
let eqGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function renderActive(): void {
  const title = $("media-title");
  const artist = $("media-artist");
  if (!active) {
    title.textContent = "Tidak ada sumber";
    artist.textContent = "Pilih sumber di bawah";
    $("status-chip").textContent = "…";
    return;
  }
  title.textContent = active.media.title || "(tanpa judul)";
  artist.textContent = active.media.artist || (active.tabTitle ?? active.id);
  $("active-source").textContent =
    active.kind === "local" ? "Sumber: player lokal" : `Sumber: tab ${active.tabId ?? "?"} • ${active.tabTitle ?? ""}`;
  $("status-chip").textContent = active.statusNote;
  $("media-time").textContent = `${fmt(active.media.position)} / ${fmt(active.media.duration)}`;
  const seek = $("seek") as HTMLInputElement;
  if (Number.isFinite(active.media.duration) && active.media.duration > 0) {
    seek.max = String(Math.floor(active.media.duration));
    seek.value = String(Math.floor(active.media.position));
    seek.disabled = !active.caps.seek;
  } else {
    seek.disabled = true;
  }
  ($("btn-play") as HTMLButtonElement).disabled = !(active.caps.play || active.caps.pause);
  ($("btn-prev") as HTMLButtonElement).disabled = !active.caps.prev;
  ($("btn-next") as HTMLButtonElement).disabled = !active.caps.next;
  ($("btn-mute") as HTMLButtonElement).disabled = !active.caps.mute && active.kind !== "generic-tab" && active.kind !== "musiku-tab";
  $("btn-play").textContent = active.media.playing ? "⏸" : "▶";
}

function renderSources(): void {
  const ul = $("source-list");
  ul.innerHTML = "";
  const all: SourceState[] = [
    {
      id: "local", kind: "local",
      media: { title: localTracks[localIndex]?.name ?? "Player lokal", artist: `${localTracks.length} lagu`, artwork: "", duration: NaN, position: 0, playing: localPlaying },
      caps: { play: true, pause: true, next: localTracks.length > 1, prev: localTracks.length > 1, seek: true, mute: false, eq: true },
      statusNote: "EQ tersedia",
    },
    ...sources.filter((s) => s.id !== "local"),
  ];
  for (const s of all) {
    const li = document.createElement("li");
    if (active && active.id === s.id) li.setAttribute("aria-current", "true");
    const name = document.createElement("span");
    name.className = "grow";
    name.textContent = s.kind === "local" ? `Lokal (${localTracks.length})` : `${s.tabTitle ?? s.id}${s.audible === false ? " (hening)" : ""}`;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = s.statusNote;
    const btn = document.createElement("button");
    btn.className = "mini";
    btn.textContent = "Pilih";
    btn.setAttribute("aria-label", `Pilih sumber ${name.textContent}`);
    btn.addEventListener("click", () => {
      void send({ type: "SELECT", id: s.id }).then(() => refresh());
    });
    li.append(name, tag, btn);
    ul.append(li);
  }
}

function renderTracks(): void {
  const ul = $("track-list");
  ul.innerHTML = "";
  for (let i = 0; i < localTracks.length; i++) {
    const t = localTracks[i];
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "grow";
    name.textContent = `${i === localIndex && localPlaying ? "▶ " : ""}${t.name}`;
    const play = document.createElement("button");
    play.className = "mini";
    play.textContent = "Putar";
    play.setAttribute("aria-label", `Putar ${t.name}`);
    play.addEventListener("click", () => {
      void send({ type: "LOCAL_PLAY", index: i }).then(() => refresh());
    });
    const del = document.createElement("button");
    del.className = "mini";
    del.textContent = "Hapus";
    del.setAttribute("aria-label", `Hapus ${t.name}`);
    del.addEventListener("click", () => {
      if (!confirm(`Hapus "${t.name}" dari ekstensi?`)) return;
      void send({ type: "LOCAL_DELETE", id: t.id }).then(() => refresh());
    });
    li.append(name, play, del);
    ul.append(li);
  }
  if (localTracks.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Belum ada file. Impor audio di atas.";
    ul.append(li);
  }
}

function renderEq(): void {
  const presets = $("eq-presets");
  presets.innerHTML = "";
  for (const p of EQ_PRESETS) {
    const b = document.createElement("button");
    b.className = "mini";
    b.textContent = p.label;
    b.setAttribute("aria-pressed", JSON.stringify(eqGains.every((g, i) => g === p.gains[i])));
    b.addEventListener("click", () => {
      eqGains = [...p.gains];
      void send({ type: "LOCAL_EQ", gains: eqGains });
      renderEq();
    });
    presets.append(b);
  }
  const box = $("eq-sliders");
  box.innerHTML = "";
  EQ_BANDS.forEach((f, i) => {
    const lab = document.createElement("label");
    const val = document.createElement("span");
    val.textContent = `${eqGains[i] > 0 ? "+" : ""}${eqGains[i]} dB`;
    const inp = document.createElement("input");
    inp.type = "range";
    inp.min = "-12";
    inp.max = "12";
    inp.step = "0.5";
    inp.value = String(eqGains[i]);
    inp.setAttribute("aria-label", `EQ ${f} Hz`);
    // EQ hanya untuk audio lokal: nonaktifkan bila sumber aktif bukan lokal.
    inp.disabled = !active || active.id !== "local";
    inp.addEventListener("change", () => {
      eqGains[i] = clampDb(Number(inp.value));
      void send({ type: "LOCAL_EQ", gains: eqGains });
      renderEq();
    });
    const cap = document.createElement("span");
    cap.textContent = f >= 1000 ? `${f / 1000}k` : `${f}`;
    lab.append(val, inp, cap);
    box.append(lab);
  });
}

async function refresh(): Promise<void> {
  try {
    const res = await send<{ sources: SourceState[]; active: SourceState | null }>({ type: "GET_STATE" });
    sources = res.sources ?? [];
    active = res.active ?? null;
    const local = sources.find((s) => s.id === "local");
    if (local) {
      // State lokal lengkap diambil via LOCAL_LIST.
      const lr = await send<{ ok: boolean; local?: { tracks: LocalTrack[]; index: number; playing: boolean; gains: number[] } }>({ type: "LOCAL_LIST" }).catch(() => null);
      if (lr?.local) {
        localTracks = lr.local.tracks;
        localIndex = lr.local.index;
        localPlaying = lr.local.playing;
        eqGains = lr.local.gains;
        // Sinkronkan kartu aktif bila sumber lokal.
        if (active && active.id === "local") {
          const t = localTracks[localIndex];
          active = { ...active, media: { ...active.media, title: t?.name ?? "Player lokal", playing: localPlaying } };
        }
      }
    } else {
      const lr = await send<{ ok: boolean; local?: { tracks: LocalTrack[]; index: number; playing: boolean; gains: number[] } }>({ type: "LOCAL_LIST" }).catch(() => null);
      if (lr?.local) {
        localTracks = lr.local.tracks;
        localIndex = lr.local.index;
        localPlaying = lr.local.playing;
        eqGains = lr.local.gains;
      }
    }
  } catch {
    active = null;
  }
  renderActive();
  renderSources();
  renderTracks();
  renderEq();
  void renderAuth();
}

async function commandPlayPause(): Promise<void> {
  if (!active) return;
  const cmd = active.media.playing ? "pause" : "play";
  const res = await send<{ ok: boolean; note?: string }>({ type: "COMMAND", id: active.id, command: { cmd } });
  $("cmd-note").textContent = res.ok ? "" : `Perintah ${cmd} tak didukung sumber ini (${res.note ?? "?"}).`;
  await refresh();
}

function wire(): void {
  $("btn-play").addEventListener("click", () => void commandPlayPause());
  $("btn-prev").addEventListener("click", async () => {
    if (!active) return;
    const res = await send<{ ok: boolean; note?: string }>({ type: "COMMAND", id: active.id, command: { cmd: "prev" } });
    if (!res.ok) $("cmd-note").textContent = ` previous tak didukung (${res.note ?? "?"}).`;
    await refresh();
  });
  $("btn-next").addEventListener("click", async () => {
    if (!active) return;
    const res = await send<{ ok: boolean; note?: string }>({ type: "COMMAND", id: active.id, command: { cmd: "next" } });
    if (!res.ok) $("cmd-note").textContent = `Next tak didukung (${res.note ?? "?"}).`;
    await refresh();
  });
  ($("seek") as HTMLInputElement).addEventListener("change", async (e) => {
    if (!active) return;
    const v = Number((e.target as HTMLInputElement).value);
    const res = await send<{ ok: boolean; note?: string }>({ type: "COMMAND", id: active.id, command: { cmd: "seek", value: v } });
    if (!res.ok) $("cmd-note").textContent = `Seek tak didukung (${res.note ?? "?"}).`;
    await refresh();
  });
  $("btn-mute").addEventListener("click", async () => {
    if (!active?.tabId && active?.tabId !== 0) return;
    const muted = !(active.muted ?? false);
    await send({ type: "COMMAND", id: active.id, command: { cmd: "mute", value: muted } });
    await refresh();
  });
  $("file-input").addEventListener("change", async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const buf = await f.arrayBuffer();
      await send({ type: "LOCAL_ADD", name: f.name, mime: f.type || "audio/mpeg", buffer: buf });
    }
    (e.target as HTMLInputElement).value = "";
    await refresh();
  });
  $("btn-capture").addEventListener("click", async () => {
    const tabId = active?.tabId;
    if (tabId === undefined) {
      $("capture-note").textContent = "Pilih tab dulu.";
      return;
    }
    const env =
      typeof chrome !== "undefined" && chrome.tabCapture?.getMediaStreamId
        ? { tabCapture: { getMediaStreamId: (o: { targetTabId: number }) => chrome.tabCapture.getMediaStreamId(o) } }
        : {};
    const r = await checkTabCapture(env, tabId);
    $("capture-note").textContent =
      r.reason + " EQ tab tetap nonaktif — kompatibilitas nyata belum diuji.";
  });
}

async function renderAuth(): Promise<void> {
  const box = $("auth-box");
  const st = await send<{ loggedIn: boolean; url: string | null }>({ type: "AUTH_STATUS" }).catch(() => ({ loggedIn: false, url: null }));
  box.innerHTML = "";
  if (st.loggedIn) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `Masuk sebagai sesi ${st.url ?? ""}.`;
    const counts = document.createElement("p");
    counts.className = "muted";
    counts.textContent = "Memuat hitungan…";
    const out = document.createElement("button");
    out.textContent = "Keluar";
    out.addEventListener("click", () => {
      void send({ type: "AUTH_LOGOUT" }).then(() => refresh());
    });
    box.append(p, counts, out);
    const cr = await send<{ ok: boolean; counts?: { playlists: number | null; favorites: number | null } | null; note?: string }>({ type: "AUTH_COUNTS" }).catch(() => ({ ok: false as const }));
    if (cr.ok && cr.counts) {
      const pl = cr.counts.playlists ?? "?";
      const fv = cr.counts.favorites ?? "?";
      counts.textContent = `Playlist: ${pl} • Favorit: ${fv} (baca-saja dari Supabase).`;
    } else {
      counts.textContent = "Hitungan tak tersedia.";
    }
  } else {
    const mk = (id: string, ph: string, type = "text") => {
      const i = document.createElement("input");
      i.id = id;
      i.placeholder = ph;
      i.type = type;
      i.setAttribute("aria-label", ph);
      return i;
    };
    const url = mk("auth-url", "Supabase URL (https://…)") as HTMLInputElement;
    const anon = mk("auth-anon", "Anon key (publik, bukan service-role)") as HTMLInputElement;
    const email = mk("auth-email", "Email", "email") as HTMLInputElement;
    const pw = mk("auth-pw", "Kata sandi", "password") as HTMLInputElement;
    const note = document.createElement("p");
    note.className = "muted small";
    const go = document.createElement("button");
    go.textContent = "Masuk";
    go.addEventListener("click", async () => {
      const res = await send<{ ok: boolean; note?: string }>({
        type: "AUTH_LOGIN", url: url.value, anon: anon.value, email: email.value, password: pw.value,
      }).catch(() => ({ ok: false, note: "SW tak merespons" }));
      note.textContent = res.ok ? "Masuk berhasil." : `Gagal: ${res.note ?? "?"}`;
      await refresh();
    });
    box.append(url, anon, email, pw, go, note);
  }
}

wire();
void refresh();
setInterval(() => void refresh(), 2000);
