"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { pushRecentSearch } from "@/lib/storage";

export function SearchForm({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        pushRecentSearch(query);
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card p-2 pl-4 focus-within:border-fuchsia-500/50"
    >
      <SearchIcon className="size-5 shrink-0 text-zinc-400" aria-hidden />
      <label htmlFor="pencarian" className="sr-only">Cari lagu, artis, atau channel</label>
      <input
        id="pencarian"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari lagu, artis, atau channel…"
        className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        maxLength={100}
        autoComplete="off"
      />
      <button type="submit" className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-sm font-semibold text-white">
        Cari
      </button>
    </form>
  );
}
