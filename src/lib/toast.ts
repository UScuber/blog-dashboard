import { useState, useEffect } from "react";

export type ToastType = "error" | "success" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  removing?: boolean;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners: Set<Listener> = new Set();

function notify() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

export function showToast(
  message: string,
  type: ToastType = "info",
  duration = 5000,
) {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  notify();

  setTimeout(() => {
    toasts = toasts.map((t) => (t.id === id ? { ...t, removing: true } : t));
    notify();
    setTimeout(() => {
      removeToast(id);
    }, 300);
  }, duration);
}

export function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [state, setState] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    toasts: state,
    dismiss: (id: number) => {
      toasts = toasts.map((t) => (t.id === id ? { ...t, removing: true } : t));
      notify();
      setTimeout(() => removeToast(id), 300);
    },
  };
}
