"use client";
import { useState } from "react";

export function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white">Batal</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">Hapus</button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: string; action: () => void } | null>(null);
  return {
    modal: (
      <ConfirmModal
        open={!!state}
        title={state?.title ?? ""}
        message={state?.message ?? ""}
        onCancel={() => setState(null)}
        onConfirm={() => {
          state?.action();
          setState(null);
        }}
      />
    ),
    confirm: (title: string, message: string, action: () => void) => setState({ title, message, action }),
  };
}
