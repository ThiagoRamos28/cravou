"use client";

import { rotuloMes, type MesRanking, type RankingPeriodo } from "@/lib/ranking-shared";

export function MesSelector({
  meses,
  periodo,
  onChange,
  anoCorrente,
}: {
  meses: MesRanking[];
  periodo: string;
  onChange: (p: RankingPeriodo) => void;
  anoCorrente: number;
}) {
  if (meses.length === 0) return null;

  return (
    <div className="mb-6 flex items-center gap-2">
      <label htmlFor="mes-selector" className="shrink-0 text-sm text-muted-foreground">
        Ver ranking de:
      </label>
      <select
        id="mes-selector"
        value={periodo}
        onChange={(e) => onChange(e.target.value as RankingPeriodo)}
        className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="geral">Ranking Geral</option>
        {meses.map((m) => (
          <option key={m.mes} value={m.mes}>
            {rotuloMes(m.mes, anoCorrente)}
          </option>
        ))}
      </select>
    </div>
  );
}
