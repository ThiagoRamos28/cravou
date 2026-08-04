"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

// Muda um parâmetro e PRESERVA os demais que já estão na URL — inclusive os que este
// componente não conhece (ex.: `situacao`, que só o /jogos usa). `undefined` remove.
// É por isso que o hook lê a URL em vez de receber os filtros por prop: assim o mesmo
// controle serve às duas telas sem nenhuma delas saber dos parâmetros da outra.
export function useNavegarFiltro() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return function navegar(mudanca: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(mudanca)) {
      if (valor) params.set(chave, valor);
      else params.delete(chave);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

const campoData =
  "cursor-pointer rounded-xl border border-border bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function FiltroPeriodo({
  ordem,
  de,
  ate,
}: {
  ordem: "asc" | "desc";
  de?: string;
  ate?: string;
}) {
  const navegar = useNavegarFiltro();
  const temData = Boolean(de || ate);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-de" className="text-xs text-muted-foreground">
          De
        </label>
        <input
          id="filtro-de"
          type="date"
          value={de ?? ""}
          onChange={(e) => navegar({ de: e.target.value || undefined })}
          className={campoData}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-ate" className="text-xs text-muted-foreground">
          Até
        </label>
        <input
          id="filtro-ate"
          type="date"
          value={ate ?? ""}
          onChange={(e) => navegar({ ate: e.target.value || undefined })}
          className={campoData}
        />
      </div>

      <button
        type="button"
        onClick={() => navegar({ ordem: ordem === "asc" ? "desc" : "asc" })}
        aria-label="Inverter ordem"
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
        {ordem === "asc" ? "Mais antigos" : "Mais recentes"}
      </button>

      {temData && (
        <button
          type="button"
          onClick={() => navegar({ de: undefined, ate: undefined })}
          className="cursor-pointer rounded-xl px-3 py-1.5 text-sm text-muted-foreground underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
