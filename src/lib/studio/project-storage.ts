// src/lib/studio/project-storage.ts

/**
 * Persistence layer for MusikKu Studio projects.
 * Provides simple JSON serialization to localStorage (for quick dev) and a stub
 * Supabase integration that can be replaced with the real client later.
 */
import type { StudioProject } from "./types";
export type IProject = StudioProject;

/**
 * Key used for localStorage persistence.
 */
const LOCAL_STORAGE_KEY = "musikku-studio-project";

/**
 * Save a project to the chosen backend.
 *
 * - If a Supabase client is configured (detected via `process.env.NEXT_PUBLIC_SUPABASE_URL`
 *   and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`), the project is up‑serted into the
 *   `projects` table whose schema matches `IProject`.
 * - Otherwise the project is stored in `localStorage` as a fallback for development.
 */
export async function saveProject(project: IProject): Promise<void> {
  // Attempt Supabase persistence if env vars are present.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    // Lazy‑load the client to avoid pulling it into bundles that don’t need it.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("projects").upsert(project);
    if (error) {
      console.error("Supabase project save error:", error);
      // Fallback to localStorage on error.
    } else {
      return;
    }
  }

  // Fallback: store the whole project JSON in localStorage.
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
  } catch (e) {
    console.error("LocalStorage save failed", e);
    throw e;
  }
}

/**
 * Load a project.
 * - Tries Supabase first (by `id`).
 * - Falls back to localStorage if Supabase is unavailable or the project cannot be
 *   fetched.
 */
export async function loadProject(id: string): Promise<IProject | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) {
      return data as unknown as StudioProject;
    }
    console.warn("Supabase load failed, falling back to localStorage", error);
  }

  // Fallback: read from localStorage (ignores id – returns whatever is stored).
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IProject) : null;
  } catch (e) {
    console.error("LocalStorage load failed", e);
    return null;
  }
}

/**
 * Delete a project – currently only supports the localStorage fallback.
 * Extend with Supabase `delete` when required.
 */
export function deleteProject(): void {
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}
