"use client";

import { useRouter } from "next/navigation";
import { COOKIE_COMPETICAO, type Competicao } from "@/lib/competicoes-shared";

export function CompeticaoTabs({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const router = useRouter();

  if (competicoes.length <= 1) return null;

  const ativas = competicoes.filter((c) => c.ativa);
  // Sem nenhuma ativa visível, todas viram aba: um usuário com opt-in só numa
  // competição encerrada ficaria sem controle nenhum.
  const abas = ativas.length > 0 ? ativas : competicoes;
  const anteriores = competicoes.filter((c) => !abas.includes(c));

  function selecionar(slug: string) {
    // Mesmo formato de cookie do seletor do header — 1 ano, escopo raiz.
    document.cookie = `${COOKIE_COMPETICAO}=${slug}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  // Handler nomeado e referenciado diretamente (não uma arrow inline por item):
  // o slug vem do data-attribute do próprio botão via `e.currentTarget`, então
  // não há closure por item de `.map()` capturando a variável de iteração.
  function aoClicarAba(e: React.MouseEvent<HTMLButtonElement>) {
    const slug = e.currentTarget.dataset.slug;
    if (slug) selecionar(slug);
  }

  function classes(selecionada: boolean) {
    return `cursor-pointer rounded-xl px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      selecionada
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    }`;
  }

  return (
    <div className="mb-6">
      <div role="tablist" aria-label="Competição" className="flex flex-wrap gap-1">
        {abas.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === selecionadaId}
            data-slug={c.slug}
            onClick={aoClicarAba}
            className={classes(c.id === selecionadaId)}
          >
            {c.nome}
          </button>
        ))}
      </div>
      {anteriores.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Temporadas anteriores
          </span>
          {anteriores.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === selecionadaId}
              data-slug={c.slug}
              onClick={aoClicarAba}
              className={`cursor-pointer rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                c.id === selecionadaId
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
