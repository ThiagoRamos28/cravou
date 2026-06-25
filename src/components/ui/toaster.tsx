"use client";

import { useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { ToastContext } from "@/components/ui/toast";

export function Toaster() {
  const ctx = useContext(ToastContext);
  const reduce = useReducedMotion();

  if (!ctx) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-80"
    >
      <AnimatePresence>
        {ctx.toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
          >
            {t.variant === "success" ? (
              <CheckCircle
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
            )}
            <span className="text-sm text-foreground">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
