import Link from "next/link";
import { avatarPadrao } from "@/lib/avatars";
import { traduzirPais } from "@/lib/i18n/paises";
import type { PalpiteAmigo } from "@/lib/feed";

type Badge = "aguardando" | "exato" | "resultado" | "erro";

function calcBadge(p: PalpiteAmigo): Badge {
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

function tempoRelativo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(isoStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

type PalpiteAmigoCardProps = { palpite: PalpiteAmigo };

export function PalpiteAmigoCard({ palpite: p }: PalpiteAmigoCardProps) {
  const badge = calcBadge(p);
  const avatarUrl = p.autor.avatar_url ?? avatarPadrao(p.autor.id);

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/perfil/${p.autor.id}`}
          className="flex items-center gap-2 hover:underline"
        >
          <img
            src={avatarUrl}
            alt={p.autor.apelido}
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="text-sm font-semibold">{p.autor.apelido}</span>
        </Link>
        <time
          dateTime={p.feito_em}
          className="text-xs text-muted-foreground"
        >
          {tempoRelativo(p.feito_em)}
        </time>
      </div>

      <div className="rounded-xl border border-border bg-muted px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1">
            {p.bandeira_casa && (
              <img src={p.bandeira_casa} alt="" width={14} height={10} />
            )}
            <span>{traduzirPais(p.time_casa)}</span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <span>{traduzirPais(p.time_fora)}</span>
            {p.bandeira_fora && (
              <img src={p.bandeira_fora} alt="" width={14} height={10} />
            )}
          </div>
        </div>

        <div className="text-center text-lg font-bold tabular-nums">
          {p.palpite_casa} × {p.palpite_fora}
        </div>

        {p.status === "finalizado" && p.placar_casa !== null && (
          <div className="mt-1 text-center text-xs text-muted-foreground">
            Resultado: {p.placar_casa} × {p.placar_fora}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[badge]}`}
        >
          {BADGE_LABELS[badge]}
        </span>
        {badge !== "aguardando" && p.pontos !== null && (
          <span className="text-xs font-semibold text-muted-foreground">
            +{p.pontos} pts
          </span>
        )}
      </div>
    </article>
  );
}
