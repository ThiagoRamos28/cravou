"use client";

import { useRouter } from "next/navigation";
import { COOKIE_COMPETICAO, type Competicao } from "@/lib/competicoes-shared";

export function CompeticaoSelector({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const router = useRouter();

  if (competicoes.length <= 1) return null;

  function aoTrocar(e: React.ChangeEvent<HTMLSelectElement>) {
    const comp = competicoes.find((c) => c.id === e.target.value);
    if (!comp) return;
    // Cookie de 1 ano, escopo raiz. Lido no servidor para renderizar a competição certa.
    document.cookie = `${COOKIE_COMPETICAO}=${comp.slug}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Competição</span>
      <select
        value={selecionadaId}
        onChange={aoTrocar}
        aria-label="Selecionar competição"
        className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {competicoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
