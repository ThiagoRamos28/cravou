"use client";

import { FiltroPeriodo, useNavegarFiltro } from "@/components/jogos/filtro-periodo";
import type { Situacao } from "@/lib/jogos/filtros";

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

// "A fazer" em vez de "Abertos": o recorte é `status in ('agendado','ao_vivo')`, ou seja
// tudo que ainda não terminou — inclusive jogo cujo prazo de palpite já fechou e que só
// aguarda resultado. Chamar isso de "Abertos" era impreciso.
const SITUACOES: { valor: Situacao; label: string }[] = [
  { valor: "a_fazer", label: "A fazer" },
  { valor: "encerrados", label: "Encerrados" },
  { valor: "todos", label: "Todos" },
];

export function JogosFiltro({
  situacao,
  ordem,
  de,
  ate,
}: {
  situacao: Situacao;
  ordem: "asc" | "desc";
  de?: string;
  ate?: string;
}) {
  const navegar = useNavegarFiltro();

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar jogos">
        {SITUACOES.map((s) => (
          <button
            key={s.valor}
            type="button"
            onClick={() => navegar({ situacao: s.valor })}
            aria-current={situacao === s.valor ? "true" : undefined}
            className={chip(situacao === s.valor)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <FiltroPeriodo ordem={ordem} de={de} ate={ate} />
    </div>
  );
}
