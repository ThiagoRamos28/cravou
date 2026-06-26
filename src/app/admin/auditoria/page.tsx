import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/admin";
import { listarJogos } from "@/lib/matches";
import { listarPalpitesJogo } from "@/lib/auditoria/palpites";
import { listarLog } from "@/lib/auditoria/log";
import { AuditoriaPalpites } from "@/components/admin/auditoria-palpites";
import { AuditoriaLog } from "@/components/admin/auditoria-log";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ jogo?: string }>;
}) {
  await requireAdmin();
  const { jogo } = await searchParams;

  const [jogosFinalizados, palpites, entradas] = await Promise.all([
    listarJogos({ soEncerrados: true }),
    jogo ? listarPalpitesJogo(jogo) : Promise.resolve([]),
    listarLog(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <p className="mb-1 text-sm text-muted-foreground">
            <a href="/admin" className="hover:underline">
              Admin
            </a>
            {" / "}
            <span>Auditoria</span>
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Auditoria
          </h1>
        </div>

        <section className="mb-10">
          <h2 className="font-display mb-4 text-xl font-bold uppercase tracking-tight">
            Palpites por Jogo
          </h2>
          <form method="GET" className="mb-4 flex flex-wrap gap-2">
            <select
              name="jogo"
              defaultValue={jogo ?? ""}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um jogo...</option>
              {jogosFinalizados.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.time_casa} × {j.time_fora}
                  {j.placar_casa != null
                    ? ` — ${j.placar_casa}×${j.placar_fora}`
                    : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Ver
            </button>
          </form>
          <AuditoriaPalpites palpites={palpites} />
        </section>

        <hr className="mb-10 border-border" />

        <section>
          <h2 className="font-display mb-4 text-xl font-bold uppercase tracking-tight">
            Log de Ações
          </h2>
          <AuditoriaLog entradas={entradas} />
        </section>
      </main>
    </div>
  );
}
