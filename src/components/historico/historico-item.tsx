import { Trophy } from "lucide-react";
import type { ItemHistorico } from "@/lib/historico";

export function HistoricoItem({ item }: { item: ItemHistorico }) {
  const { match: m, palpiteCasa, palpiteFora, pontos } = item;
  const cravou = palpiteCasa === m.placar_casa && palpiteFora === m.placar_fora;
  const data = new Date(m.inicio_em).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{data}</div>
        <div className="truncate font-medium">
          {m.time_casa} {m.placar_casa}×{m.placar_fora} {m.time_fora}
        </div>
        <div className="text-xs text-muted-foreground">
          Seu palpite: {palpiteCasa}×{palpiteFora}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {cravou ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Cravou! +{pontos}
          </span>
        ) : (
          <span className={`text-sm font-semibold ${pontos > 0 ? "text-primary" : "text-muted-foreground"}`}>
            +{pontos} pts
          </span>
        )}
      </div>
    </article>
  );
}
