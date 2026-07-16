import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessao } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { listarCompeticoes } from "@/lib/competicoes";
import { alternarParticipacao } from "./actions";

export default async function CompeticoesPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const supabase = await createClient();
  const [competicoes, { data: participacoes }] = await Promise.all([
    listarCompeticoes(),
    supabase
      .from("profiles_competicoes")
      .select("competicao_id, ativo")
      .eq("user_id", sessao.userId),
  ]);
  const ativoPor = new Map(
    ((participacoes as { competicao_id: string; ativo: boolean }[] | null) ?? []).map(
      (p) => [p.competicao_id, p.ativo]
    )
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight">
          Minhas competições
        </h1>
        <p className="mb-8 text-muted-foreground">
          Ative sua participação para palpitar e aparecer no ranking de cada
          competição.
        </p>
        <ul className="flex flex-col gap-3">
          {competicoes.map((c) => {
            const participando = ativoPor.get(c.id) ?? false;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-5"
              >
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-tight">
                    {c.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.ativa ? "Ativa" : "Encerrada"}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await alternarParticipacao(c.id, !participando);
                  }}
                >
                  <button
                    type="submit"
                    className={`cursor-pointer rounded-lg px-4 py-2 font-display text-sm font-semibold uppercase tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      participando
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {participando ? "Participando" : "Ativar"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
