/**
 * Minimal decoupled toast bus. Anything (hooks, axios interceptors, mutation
 * callbacks) can call `toast.success(...)`; the <Toaster/> subscribes and renders.
 */
export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let counter = 0;

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (m: string) => emit("success", m),
  error: (m: string) => emit("error", m),
  info: (m: string) => emit("info", m),
};
