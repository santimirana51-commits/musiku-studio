"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/nav";
import { PlayerBar } from "@/components/player-bar";
import { AuthHeader } from "@/components/auth-header";
import { PwaRegister } from "@/components/pwa-register";

interface LayoutContextValue {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useAppLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    return {
      isSidebarCollapsed: false,
      toggleSidebar: () => {},
      setSidebarCollapsed: () => {},
      isFullscreen: false,
      toggleFullscreen: () => {},
    };
  }
  return context;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <LayoutContext.Provider
      value={{
        isSidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        isFullscreen,
        toggleFullscreen,
      }}
    >
      {isStudio ? (
        // Mode Studio DAW: Fullscreen & Full-bleed, 100% lebar & 100% tinggi layar
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
          {!isSidebarCollapsed && (
            <Sidebar collapsed={false} onToggleCollapse={toggleSidebar} />
          )}
          <main className="min-w-0 flex-1 h-full overflow-hidden flex flex-col p-0 m-0">
            {children}
          </main>
          <PwaRegister />
        </div>
      ) : (
        // Mode Web App Standar (Beranda, Pencarian, Pustaka, Karaoke, dll.)
        <>
          <div className="flex min-h-screen">
            <Sidebar collapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
            <main className="min-w-0 flex-1 pb-36 md:pb-28">
              <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
                <header className="mb-4 flex items-center justify-end">
                  <AuthHeader />
                </header>
                {children}
              </div>
            </main>
          </div>
          <PlayerBar />
          <MobileNav />
          <PwaRegister />
        </>
      )}
    </LayoutContext.Provider>
  );
}
