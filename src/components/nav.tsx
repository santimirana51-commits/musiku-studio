"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cloud,
  Disc3,
  HardDrive,
  Heart,
  History,
  Home,
  ListMusic,
  Mic2,
  Music,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncEngine } from "@/lib/sync/use-sync";

const NAV = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/studio", label: "Studio DAW", icon: Music },
  { href: "/search", label: "Pencarian", icon: Search },
  { href: "/library?tab=devices", label: "Pustaka Lokal", icon: HardDrive, match: "/library" },
  { href: "/library?tab=cloud", label: "Pustaka Cloud", icon: Cloud, match: "/library" },
  { href: "/playlists", label: "Playlist", icon: ListMusic },
  { href: "/karaoke", label: "Karaoke", icon: Mic2 },
  { href: "/ai-lyrics", label: "AI Lyrics", icon: Sparkles },
  { href: "/equalizer", label: "Equalizer", icon: Sliders },
  { href: "/favorites", label: "Favorit", icon: Heart },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const { status: syncStatus, queueCount } = useSyncEngine();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/5 bg-charcoal/80 p-4 md:flex" aria-label="Navigasi utama">
      <Link href="/" className="mb-4 flex items-center gap-2 px-2">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500">
          <Disc3 className="size-5 text-white" aria-hidden />
        </span>
        <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-xl font-extrabold text-transparent">
          MusikKu
        </span>
      </Link>

      {/* Indikator Status Sync Engine (§I & §G) */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              syncStatus === "syncing"
                ? "animate-pulse bg-violet-400"
                : syncStatus === "error"
                ? "bg-red-400"
                : syncStatus === "paused"
                ? "bg-amber-400"
                : "bg-emerald-400"
            )}
          />
          <span className="capitalize">
            {syncStatus === "syncing"
              ? "Sinkronisasi..."
              : syncStatus === "paused"
              ? "Dijeda"
              : syncStatus === "error"
              ? "Gagal sync"
              : "Tersinkron"}
          </span>
        </div>
        {queueCount > 0 && (
          <span className="rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[10px] font-bold text-violet-300">
            {queueCount}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1" aria-label="Menu navigasi">
        {NAV.map((n) => {
          const active = n.match ? path === n.match : path === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-gradient-to-r from-violet-600/30 to-pink-600/20 font-medium text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <n.icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}

        <Link
          href="/admin"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
            path === "/admin" ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-white"
          )}
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Admin
        </Link>
      </nav>

      <p className="mt-auto px-2 pt-4 text-[11px] leading-relaxed text-zinc-600">
        Konten video diputar dari YouTube melalui player resmi. MusikKu bukan situs resmi YouTube.
      </p>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const mobileItems = [
    { href: "/", label: "Beranda", icon: Home },
    { href: "/search", label: "Cari", icon: Search },
    { href: "/karaoke", label: "Karaoke", icon: Mic2 },
    { href: "/ai-lyrics", label: "AI", icon: Sparkles },
    { href: "/equalizer", label: "EQ", icon: Sliders },
    { href: "/library", label: "Pustaka", icon: HardDrive },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-charcoal/95 backdrop-blur md:hidden" aria-label="Navigasi seluler">
      <div className="grid grid-cols-6">
        {mobileItems.map((n) => {
          const active = path === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px]",
                active ? "text-fuchsia-300 font-semibold" : "text-zinc-500"
              )}
            >
              <n.icon className="size-4.5" aria-hidden />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
