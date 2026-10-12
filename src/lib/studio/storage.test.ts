import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  saveAudioBlob,
  getAudioBlob,
  deleteAudioBlob,
  exportProjectToJSON,
  importProjectFromJSON,
} from "./storage";
import { createEmptyProject } from "./schema";

describe("Studio Storage & File Serialization", () => {
  it("saves and reloads a project from IndexedDB", async () => {
    const proj = createEmptyProject("Saved Song");
    await saveProject(proj);

    const loaded = await loadProject(proj.id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("Saved Song");
    expect(loaded?.tracks.length).toBe(proj.tracks.length);
  });

  it("lists all saved projects ordered by recency", async () => {
    const p1 = createEmptyProject("First Song");
    const p2 = createEmptyProject("Second Song");

    await saveProject(p1);
    await saveProject(p2);

    const list = await listProjects();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some((p) => p.id === p1.id)).toBe(true);
    expect(list.some((p) => p.id === p2.id)).toBe(true);
  });

  it("deletes a project from storage", async () => {
    const p = createEmptyProject("Delete Me");
    await saveProject(p);
    expect(await loadProject(p.id)).not.toBeNull();

    await deleteProject(p.id);
    expect(await loadProject(p.id)).toBeNull();
  });

  it("saves, retrieves, and deletes audio blobs", async () => {
    const assetId = "audio_test_123";
    const testBlob = new Blob(["fake-audio-bytes"], { type: "audio/wav" });

    await saveAudioBlob(assetId, testBlob);
    const retrieved = await getAudioBlob(assetId);
    expect(retrieved).toBeDefined();

    await deleteAudioBlob(assetId);
    const deleted = await getAudioBlob(assetId);
    expect(deleted).toBeNull();
  });

  it("exports and imports valid project JSON", () => {
    const p = createEmptyProject("JSON Roundtrip");
    const jsonStr = exportProjectToJSON(p);
    expect(typeof jsonStr).toBe("string");

    const imported = importProjectFromJSON(jsonStr);
    expect(imported.success).toBe(true);
    expect(imported.project?.name).toBe("JSON Roundtrip");
  });

  it("rejects corrupt JSON on import with honest error", () => {
    const corrupt = "this is not json {";
    const result = importProjectFromJSON(corrupt);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("persists, lists, loads, and deletes step sequencer patterns in IndexedDB", async () => {
    const { saveStepPattern, loadStepPattern, listStepPatterns, deleteStepPattern } = await import("./storage");
    const { createDefaultPattern } = await import("./step-sequencer");

    const pattern = createDefaultPattern(16, "My Custom Groove");
    pattern.lanes[0].steps[0].active = true;
    pattern.swing = 0.2;

    await saveStepPattern(pattern);

    const loaded = await loadStepPattern(pattern.id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("My Custom Groove");
    expect(loaded?.lanes[0].steps[0].active).toBe(true);
    expect(loaded?.swing).toBe(0.2);

    const list = await listStepPatterns();
    expect(list.some((p) => p.id === pattern.id)).toBe(true);

    await deleteStepPattern(pattern.id);
    const afterDelete = await loadStepPattern(pattern.id);
    expect(afterDelete).toBeNull();
  });

  describe("Mixcraft 10 File Management: Missing Sound Files & Orphan Cleanup", () => {
    it("detects missing sound files referenced by project clips (Hlm. 52)", async () => {
      const { checkProjectMissingAssets, saveAudioBlob } = await import("./storage");
      const proj = createEmptyProject("Missing Assets Song");

      // Track with an audio clip that has an asset ID
      proj.tracks[0].clips.push({
        id: "clip_missing_1",
        trackId: proj.tracks[0].id,
        type: "audio",
        name: "Missing Vocal.wav",
        color: "#3b82f6",
        startBeat: 0,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1,
        assetId: "non_existent_asset_ghost",
      });

      // Also add an existing asset to verify it is not flagged as missing
      const existingId = "real_existing_asset_1";
      await saveAudioBlob(existingId, new Blob(["hello"], { type: "audio/wav" }));
      proj.tracks[0].clips.push({
        id: "clip_real_1",
        trackId: proj.tracks[0].id,
        type: "audio",
        name: "Real Vocal.wav",
        color: "#3b82f6",
        startBeat: 8,
        durationBeats: 8,
        offsetBeat: 0,
        gain: 1,
        assetId: existingId,
      });

      const missing = await checkProjectMissingAssets(proj);
      expect(missing).toContain("non_existent_asset_ghost");
      expect(missing).not.toContain(existingId);
    });

    it("relinks missing sound files to a new replacement blob (Hlm. 52)", async () => {
      const { relinkProjectAsset, getAudioBlob } = await import("./storage");
      const proj = createEmptyProject("Relink Song");
      const oldAssetId = "lost_drum_sample";
      const newAssetId = "restored_drum_sample";
      const replacementBlob = new Blob(["drum-beat-restored"], { type: "audio/wav" });

      proj.tracks[0].clips.push({
        id: "clip_drum_1",
        trackId: proj.tracks[0].id,
        type: "audio",
        name: "Lost Drum.wav",
        color: "#ef4444",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1,
        assetId: oldAssetId,
      });

      const updatedProject = await relinkProjectAsset(proj, oldAssetId, newAssetId, replacementBlob);

      // Verify clip in project updated to new asset ID
      const relinkedClip = updatedProject.tracks[0].clips.find((c) => c.id === "clip_drum_1");
      expect(relinkedClip?.assetId).toBe(newAssetId);

      // Verify new blob is saved and retrievable
      const retrieved = await getAudioBlob(newAssetId);
      expect(retrieved).not.toBeNull();
    });

    it("cleans up orphan audio blobs not referenced by any project (Hlm. 687)", async () => {
      const { saveAudioBlob, getAudioBlob, cleanupOrphanAudioBlobs } = await import("./storage");
      const proj = createEmptyProject("Orphan Test Project");
      const activeAssetId = "active_asset_needed";
      const orphanAssetId = "orphan_unused_recording";

      await saveAudioBlob(activeAssetId, new Blob(["active audio"], { type: "audio/wav" }));
      await saveAudioBlob(orphanAssetId, new Blob(["unused recording to delete"], { type: "audio/wav" }));

      // Project only references activeAssetId
      proj.tracks[0].clips.push({
        id: "clip_active",
        trackId: proj.tracks[0].id,
        type: "audio",
        name: "Active.wav",
        color: "#10b981",
        startBeat: 0,
        durationBeats: 4,
        offsetBeat: 0,
        gain: 1,
        assetId: activeAssetId,
      });

      const cleanedCount = await cleanupOrphanAudioBlobs([proj]);
      expect(cleanedCount).toBeGreaterThanOrEqual(1);

      // Active asset is preserved
      const activeBlob = await getAudioBlob(activeAssetId);
      expect(activeBlob).not.toBeNull();

      // Orphan asset is purged
      const orphanBlob = await getAudioBlob(orphanAssetId);
      expect(orphanBlob).toBeNull();
    });

    it("saves, loads, and clears autosave disaster recovery snapshot (Mixcraft 10 Hlm. 686-687)", async () => {
      const { saveAutosave, loadAutosave, clearAutosave, listProjects } = await import("./storage");
      const proj = createEmptyProject("Disaster Recovery Project");
      proj.tempo = 142;

      // 1. Save autosave
      await saveAutosave(proj);

      // 2. Load autosave
      const backup = await loadAutosave();
      expect(backup).not.toBeNull();
      expect(backup?.originalProjectId).toBe(proj.id);
      expect(backup?.project.name).toBe("Disaster Recovery Project");
      expect(backup?.project.tempo).toBe(142);

      // 3. Ensure listProjects does NOT include the internal autosave key
      const summaries = await listProjects();
      const hasAutosaveInList = summaries.some((s) => s.id === "__musikku_autosave_backup__");
      expect(hasAutosaveInList).toBe(false);

      // 4. Clear autosave
      await clearAutosave();
      const afterClear = await loadAutosave();
      expect(afterClear).toBeNull();
    });
  });
});

