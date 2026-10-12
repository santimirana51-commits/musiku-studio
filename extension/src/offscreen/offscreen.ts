// Offscreen document: host pemutar lokal + pesanan dari service worker.
// Dibuat on-demand (AUDIO_PLAYBACK). Tanpa UI.

import { OffscreenPlayer } from "./player.js";
import { extAddTrack } from "./store.js";
import type { ExtensionMessage } from "../shared/media-types.js";

const player = new OffscreenPlayer();

function snapshot() {
  return { local: player.state() };
}

chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  if (sender.tab !== undefined) return;
  const msg = raw as ExtensionMessage;
  (async () => {
    try {
      switch (msg.type) {
        case "LOCAL_LIST":
          await player.refresh();
          respond({ ok: true, ...snapshot() });
          break;
        case "LOCAL_ADD": {
          await extAddTrack({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: msg.name,
            mime: msg.mime,
            size: msg.buffer.byteLength,
            blob: new Blob([msg.buffer], { type: msg.mime }),
            addedAt: Date.now(),
          });
          await player.refresh();
          respond({ ok: true, ...snapshot() });
          break;
        }
        case "LOCAL_DELETE":
          await player.deleteTrack(msg.id);
          respond({ ok: true, ...snapshot() });
          break;
        case "LOCAL_PLAY":
          await player.playIndex(msg.index);
          respond({ ok: true, ...snapshot() });
          break;
        case "COMMAND":
          // Perintah media generik untuk sumber lokal.
          if (msg.command.cmd === "play") await player.toggle();
          else if (msg.command.cmd === "pause") player.pause();
          else if (msg.command.cmd === "next") await player.next();
          else if (msg.command.cmd === "prev") await player.prev();
          else if (msg.command.cmd === "seek") player.seek(msg.command.value);
          else {
            respond({ ok: false, note: "unsupported" });
            break;
          }
          respond({ ok: true, ...snapshot() });
          break;
        case "LOCAL_EQ":
          player.applyEq(msg.gains);
          respond({ ok: true, ...snapshot() });
          break;
        case "LOCAL_VOLUME":
          player.setVolume(msg.value);
          respond({ ok: true, ...snapshot() });
          break;
        default:
          break;
      }
    } catch (e) {
      respond({ ok: false, note: e instanceof Error ? e.message : "gagal" });
    }
  })();
  return true;
});

export {};
