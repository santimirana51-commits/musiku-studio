import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { extAddTrack, extListTracks, extDeleteTrack } from "./store.js";

describe("extension IDB store", () => {
  it("simpan, daftar, hapus; pulih antar sesi open", async () => {
    await extAddTrack({
      id: "a1", name: "lagu.mp3", mime: "audio/mpeg", size: 3,
      blob: new Blob(["abc"], { type: "audio/mpeg" }), addedAt: 1,
    });
    let all = await extListTracks();
    expect(all.map((t) => t.id)).toContain("a1");
    expect(all.find((t) => t.id === "a1")?.name).toBe("lagu.mp3");
    await extDeleteTrack("a1");
    all = await extListTracks();
    expect(all.map((t) => t.id)).not.toContain("a1");
  });
});
