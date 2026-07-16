import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RankingContent } from "@/components/ranking/ranking-content";
import { getSessao } from "@/lib/auth/profile";
import { listarRanking } from "@/lib/ranking";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

export default async function RankingPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);

  const linhas = atual ? await listarRanking(atual.id, "geral") : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Ranking
        </h1>
        {atual ? (
          <RankingContent linhasIniciais={linhas} meuId={sessao.userId} competicao={atual} />
        ) : (
          <p className="text-muted-foreground">Nenhuma competição disponível.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
