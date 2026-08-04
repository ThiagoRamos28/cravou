"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { RankingPeriodo } from "@/lib/ranking-shared";

const OPCOES: { valor: RankingPeriodo; label: string }[] = [
  { valor: "geral", label: "Ranking Geral" },
  { valor: "temporada_1", label: "Temporada 1" },
  { valor: "temporada_2", label: "Temporada 2" },
];

export function SeasonSelector({
  periodo,
  onChange,
}: {
  periodo: string;
  onChange: (p: RankingPeriodo) => void;
}) {
  const [popoverAberto, setPopoverAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverAberto) return;

    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [popoverAberto]);

  return (
    <div className="mb-6 flex items-center gap-2">
      <label htmlFor="season-selector" className="shrink-0 text-sm text-muted-foreground">
        Ver ranking de:
      </label>
      <select
        id="season-selector"
        value={periodo}
        onChange={(e) => onChange(e.target.value as RankingPeriodo)}
        className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {OPCOES.map((op) => (
          <option key={op.valor} value={op.valor}>
            {op.label}
          </option>
        ))}
      </select>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-label="Pontuação das temporadas"
          onClick={() => setPopoverAberto((a) => !a)}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
        {popoverAberto && (
          <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-2xl border border-border bg-card p-4 text-sm shadow-lg">
            <p className="mb-2 font-semibold">Temporada 1 — Grupos (até 03/07):</p>
            <p className="mb-3 text-muted-foreground">
              Placar exato 10 pts · Vencedor e saldo 7 pts · Resultado (V/E/D) 5 pts · Gols
              de um time 2 pts
            </p>
            <p className="mb-2 font-semibold">
              Temporada 2 — Mata-mata (a partir de 04/07):
            </p>
            <p className="text-muted-foreground">
              Placar exato 15 pts · Vencedor e saldo 7 pts · Resultado (V/E/D) 4 pts · Gols
              de um time 1 pt
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
