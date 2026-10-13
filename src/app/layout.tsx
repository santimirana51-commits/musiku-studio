
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PlayerProvider } from "@/components/player-context";
import { ToastProvider } from "@/components/toast";
import { AppShell } from "@/components/app-shell";
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
              <AppShell>{children}</AppShell>
            </PlayerProvider>
          </ToastProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
