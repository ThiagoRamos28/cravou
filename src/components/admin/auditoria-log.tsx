import type { EntradaLog } from "@/lib/auditoria/log";

const BADGE_COR: Record<string, string> = {
  salvar_placar:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sync_placar_auto:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  disparar_sync: "bg-muted text-muted-foreground",
  alterar_config:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const BADGE_LABEL: Record<string, string> = {
  salvar_placar: "Placar manual",
  sync_placar_auto: "Sync auto",
  disparar_sync: "Sync manual",
  alterar_config: "Config",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditoriaLog({ entradas }: { entradas: EntradaLog[] }) {
  if (entradas.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Nenhuma ação registrada ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {entradas.map((e) => (
        <li
          key={e.id}
          className="rounded-xl border border-border bg-card p-3 text-sm"
        >
          <div className="flex flex-wrap items-start gap-2">
            <time className="shrink-0 tabular-nums text-muted-foreground">
              {formatarData(e.criado_em)}
            </time>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                BADGE_COR[e.acao] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {BADGE_LABEL[e.acao] ?? e.acao}
            </span>
            <span className="flex-1">{e.descricao}</span>
          </div>
          {(e.dados_anteriores || e.dados_novos) && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">detalhes</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(
                  { antes: e.dados_anteriores, depois: e.dados_novos },
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
