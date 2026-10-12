
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PlayerProvider } from "@/components/player-context";
import { ToastProvider } from "@/components/toast";
import { Sidebar, MobileNav } from "@/components/nav";
import { PlayerBar } from "@/components/player-bar";
import { AuthHeader } from "@/components/auth-header";
import { PwaRegister } from "@/components/pwa-register";
import { ProjectProvider } from "@/lib/studio/project-context";

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "MusikKu — Platform Musik & Karaoke Multi-Platform",
  description:
    "MusikKu — ekosistem pemutaran musik lokal, cloud, karaoke, dan YouTube dengan backend bersama.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-charcoal font-sans antialiased">
        <ProjectProvider>
          <ToastProvider>
            <PlayerProvider>
              <div className="flex min-h-screen">
                <Sidebar />
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
            </PlayerProvider>
          </ToastProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
