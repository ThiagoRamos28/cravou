"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function UserMenu({
  apelido,
  avatarUrl,
}: {
  apelido: string;
  avatarUrl: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={apelido}
        className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full bg-muted"
        />
        <span className="hidden text-sm font-medium sm:inline">{apelido}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? {} : { opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-xl border border-border bg-card shadow-md"
          >
            <div className="p-1">
              <Link
                href="/perfil"
                role="menuitem"
                onClick={() => setAberto(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Editar perfil
              </Link>
              <div className="my-1 border-t border-border" />
              <form action="/auth/sair" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
