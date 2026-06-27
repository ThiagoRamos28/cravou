import { traduzirPais } from "@/lib/i18n/paises";
import type { PalpiteResumido } from "@/lib/feed";

type Badge = "aguardando" | "exato" | "resultado" | "erro";

function calcBadge(p: PalpiteResumido): Badge {
  if (p.status !== "finalizado" || p.placar_casa === null || p.placar_fora === null)
    return "aguardando";
  if (p.palpite_casa === p.placar_casa && p.palpite_fora === p.placar_fora)
    return "exato";
  const resultadoPalpite = Math.sign(p.palpite_casa - p.palpite_fora);
  const resultadoReal = Math.sign(p.placar_casa - p.placar_fora);
  return resultadoPalpite === resultadoReal ? "resultado" : "erro";
}

const BADGE_STYLES: Record<Badge, string> = {
  aguardando: "bg-muted text-muted-foreground",
  exato: "bg-accent/15 text-accent",
  resultado: "bg-primary/15 text-primary",
  erro: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const BADGE_LABELS: Record<Badge, string> = {
  aguardando: "Aguardando",
  exato: "Exato",
  resultado: "Resultado",
  erro: "Erro",
};

type PalpiteCardCompactoProps = { palpite: PalpiteResumido };

export function PalpiteCardCompacto({ palpite: p }: PalpiteCardCompactoProps) {
  const badge = calcBadge(p);
  const casaNome = traduzirPais(p.time_casa);
  const foraNome = traduzirPais(p.time_fora);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex min-w-0 items-center gap-1">
          {p.bandeira_casa && (
            <img src={p.bandeira_casa} alt="" width={14} height={10} className="shrink-0" />
          )}
          <span className="truncate font-medium">{casaNome}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">×</span>
        <div className="flex min-w-0 items-center justify-end gap-1">
          <span className="truncate font-medium">{foraNome}</span>
          {p.bandeira_fora && (
            <img src={p.bandeira_fora} alt="" width={14} height={10} className="shrink-0" />
          )}
        </div>
      </div>

      <div className="text-center text-sm font-bold tabular-nums">
        {p.palpite_casa} × {p.palpite_fora}
      </div>

      <div className="flex items-center justify-between gap-1">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[badge]}`}
        >
          {BADGE_LABELS[badge]}
        </span>
        {badge !== "aguardando" && p.pontos !== null && (
          <span className="text-xs font-semibold text-muted-foreground">
            +{p.pontos}
          </span>
        )}
      </div>
    </div>
  );
}
