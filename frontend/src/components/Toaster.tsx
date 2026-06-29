import { useEffect, useState } from "react";
import { subscribe, type ToastItem } from "@/lib/toast";

const KIND_CLS: Record<ToastItem["kind"], string> = {
  success: "border-green/40 text-green",
  error: "border-red/40 text-red",
  info: "border-blue/40 text-blue",
};

const ICON: Record<ToastItem["kind"], string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() =>
    subscribe((t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), 3500);
    }), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-72">
      {items.map((t) => (
        <div
          key={t.id}
          className={`card px-4 py-3 flex items-center gap-3 border ${KIND_CLS[t.kind]} animate-[fadeIn_.15s_ease-out]`}
        >
          <span className="font-extrabold text-sm">{ICON[t.kind]}</span>
          <span className="text-sm text-text">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
