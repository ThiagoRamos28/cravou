import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";
import { PalpiteForm } from "@/components/jogos/palpite-form";

function Time({ nome, bandeira }: { nome: string; bandeira: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {bandeira ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bandeira}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover"
        />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full bg-muted" aria-hidden="true" />
      )}
      <span className="truncate font-medium">{nome}</span>
    </div>
  );
}

const STATUS_LABEL: Record<Match["status"], string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  finalizado: "Encerrado",
};

export function MatchCard({
  match,
  palpite,
  minutosCorte = 10,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte?: number;
}) {
  const finalizado = match.status === "finalizado";
  const hora = new Date(match.inicio_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hora}</span>
        <span className={match.status === "ao_vivo" ? "font-semibold text-accent" : ""}>
          {STATUS_LABEL[match.status]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 overflow-hidden">
        <Time nome={match.time_casa} bandeira={match.bandeira_casa} />
        <div className="shrink-0 font-display text-xl font-bold tabular-nums">
          {finalizado ? (
            <span>
              <span>{match.placar_casa}</span>
              <span className="mx-1 text-muted-foreground">×</span>
              <span>{match.placar_fora}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">×</span>
          )}
        </div>
        <Time nome={match.time_fora} bandeira={match.bandeira_fora} />
      </div>
      <PalpiteForm match={match} palpite={palpite} minutosCorte={minutosCorte} />
    </article>
  );
}
