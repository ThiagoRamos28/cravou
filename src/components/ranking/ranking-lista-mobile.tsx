"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLUNAS_ICONE } from "@/components/ranking/colunas";
import { avatarPadrao } from "@/lib/avatars";
import type { RankingRow } from "@/lib/ranking";

export function RankingListaMobile({
  linhas,
  meuId,
}: {
  linhas: RankingRow[];
  meuId: string | null;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const reduce = useReducedMotion();

  if (linhas.length === 0) return null;

  function alternar(id: string) {
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card sm:hidden">
      <ul>
        {linhas.map((l, i) => {
          const eu = l.user_id === meuId;
          const aberta = abertas.has(l.user_id);
          const maxPontos = l.palpites_pontuados * 10;
          const aproveitamento =
            maxPontos > 0 ? `${Math.round((l.pontos / maxPontos) * 100)}%` : "—";
          return (
            <li key={l.user_id} className="border-b border-border/60 last:border-0">
              <button
                type="button"
                onClick={() => alternar(l.user_id)}
                aria-expanded={aberta}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 ${
                  eu ? "bg-primary/10 font-semibold" : ""
                }`}
              >
                <span className="w-5 text-center tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.avatar_url ?? avatarPadrao(l.user_id)}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full bg-muted object-cover"
                />
                <span className="min-w-0 flex-1 truncate">
                  {l.apelido ?? "Sem apelido"}
                  {eu && (
                    <span className="ml-2 text-xs font-normal text-primary">você</span>
                  )}
                </span>
                <span className="font-display text-base font-bold tabular-nums">
                  {l.pontos}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    aberta ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
              <AnimatePresence initial={false}>
                {aberta && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pl-11 text-sm text-muted-foreground">
                      {COLUNAS_ICONE.map((col) => (
                        <span
                          key={col.pts}
                          title={col.label}
                          className="inline-flex items-center gap-1 tabular-nums"
                        >
                          {col.icon}
                          {col.valor(l) > 0 ? col.valor(l) : "—"}
                        </span>
                      ))}
                      <span className="w-full text-xs">
                        Aproveitamento: {aproveitamento}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
