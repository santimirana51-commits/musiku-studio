// src/lib/studio/project-context.tsx

"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { StudioProject as IProject } from "./types";
import { loadProject, saveProject } from "./project-storage";

/**
 * Context that holds the current project and a setter to update it.
 * If no project is loaded yet, `project` will be `null`.
 */
interface ProjectContextValue {
  project: IProject | null;
  setProject: (proj: IProject) => void;
  /** Convenience wrapper that saves the project after setting it. */
  updateProject: (proj: IProject) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

/**
 * Provider that loads the last saved project from storage on mount.
 * It also persists any changes automatically.
 */
export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [project, setProject] = useState<IProject | null>(null);

  // Load on mount (using a hard‑coded default id for simplicity)
  useEffect(() => {
    const load = async () => {
      const defaultId = "default"; // placeholder id
      const loaded = await loadProject(defaultId);
      if (loaded) setProject(loaded);
    };
    load();
  }, []);

  const updateProject = async (proj: IProject) => {
    setProject(proj);
    await saveProject(proj);
  };

  return (
    <ProjectContext.Provider value={{ project, setProject, updateProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

/** Hook to access the current project context */
export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return ctx;
};
