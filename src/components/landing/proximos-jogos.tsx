import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { traduzirPais } from "@/lib/i18n/paises";
import type { Match } from "@/lib/matches";

export function ProximosJogos({
  jogos,
  logado,
}: {
  jogos: Match[];
  logado: boolean;
}) {
  if (jogos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <h2 className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-tight">
        Jogos abertos para palpite
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jogos.map((j) => {
          const hora = new Date(j.inicio_em).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
          return (
            <article
              key={j.id}
              className="rounded-xl border border-border bg-card p-4 text-center"
            >
              <p className="mb-2 text-xs text-muted-foreground">{hora}</p>
              <p className="font-medium">
                {traduzirPais(j.time_casa)}{" "}
                <span className="text-muted-foreground">×</span>{" "}
                {traduzirPais(j.time_fora)}
              </p>
            </article>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <Link
          href={logado ? "/jogos" : "/entrar"}
          className={buttonVariants("primary", "lg")}
        >
          {logado ? "Ver todos os jogos" : "Entrar para palpitar"}
        </Link>
      </div>
    </section>
  );
}
