"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Odds } from "@/lib/matches";

function Cotacao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/60 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      <span className="font-display text-sm font-bold tabular-nums">{valor}</span>
    </div>
  );
}

export function OddsJogo({ odds }: { odds: Odds }) {
  const [aberto, setAberto] = useState(false);
  const temOverUnder = odds.over25 != null || odds.under25 != null;
  const temAmbas = odds.ambas_sim != null || odds.ambas_nao != null;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        ver odds
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {odds.casa != null && <Cotacao rotulo="Casa" valor={odds.casa} />}
            {odds.empate != null && <Cotacao rotulo="Empate" valor={odds.empate} />}
            {odds.fora != null && <Cotacao rotulo="Fora" valor={odds.fora} />}
          </div>

          {(temOverUnder || temAmbas) && (
            <div className="flex flex-wrap justify-center gap-2">
              {odds.over25 != null && <Cotacao rotulo="Over 2.5" valor={odds.over25} />}
              {odds.under25 != null && <Cotacao rotulo="Under 2.5" valor={odds.under25} />}
              {odds.ambas_sim != null && (
                <Cotacao rotulo="Ambas marcam" valor={odds.ambas_sim} />
              )}
              {odds.ambas_nao != null && (
                <Cotacao rotulo="Ambas não" valor={odds.ambas_nao} />
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Odds {odds.bookmaker} · meramente informativo
          </p>
        </div>
      )}
    </div>
  );
}
