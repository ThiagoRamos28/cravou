import { traduzirPais } from "@/lib/i18n/paises";
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";
import { PalpiteForm } from "@/components/jogos/palpite-form";

function Time({
  nome,
  bandeira,
  lado,
}: {
  nome: string;
  bandeira: string | null;
  lado: "casa" | "fora";
}) {
  const flag = bandeira ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bandeira}
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 shrink-0 rounded-full bg-muted object-cover"
    />
  ) : (
    <span className="h-5 w-5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
  );

  if (lado === "casa") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{nome}</span>
        {flag}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {flag}
      <span className="truncate text-sm font-medium">{nome}</span>
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
    timeZone: "America/Sao_Paulo",
  });

  return (
    <article
      className={`rounded-2xl border bg-card p-3 ${
        palpite ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span>{hora}</span>
        <span aria-hidden="true">·</span>
        <span className={match.status === "ao_vivo" ? "font-semibold text-accent" : ""}>
          {STATUS_LABEL[match.status]}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2 overflow-hidden">
        <Time
          nome={traduzirPais(match.time_casa)}
          bandeira={match.bandeira_casa}
          lado="casa"
        />
        <div className="shrink-0 font-display text-lg font-bold tabular-nums">
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
        <Time
          nome={traduzirPais(match.time_fora)}
          bandeira={match.bandeira_fora}
          lado="fora"
        />
      </div>
      <PalpiteForm match={match} palpite={palpite} minutosCorte={minutosCorte} />
    </article>
  );
}
