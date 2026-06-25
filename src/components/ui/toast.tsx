"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastVariant = "success" | "error";

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toasts: Toast[];
  toast: (opts: { message: string; variant: ToastVariant }) => void;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, variant }: { message: string; variant: ToastVariant }) => {
      const id = ++counter.current;
      setToasts((prev) => {
        const next = [...prev, { id, message, variant }];
        // Máximo de 3 toasts; descarta o mais antigo se ultrapassar.
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de ToastProvider");
  return { toast: ctx.toast };
}
