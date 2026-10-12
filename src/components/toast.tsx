"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info" | "warning";
}
const Ctx = createContext<{ toast: (message: string, kind?: Toast["kind"]) => void } | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = seq++;
    setItems((p) => [...p, { id, message, kind }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 md:bottom-28">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`max-w-xs rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur ${
              t.kind === "error"
                ? "border-red-500/40 bg-red-950/90 text-red-100"
                : t.kind === "success"
                  ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
                  : t.kind === "warning"
                    ? "border-amber-500/40 bg-amber-950/90 text-amber-100"
                    : "border-white/10 bg-zinc-900/95 text-zinc-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast di luar provider");
  return v;
}
