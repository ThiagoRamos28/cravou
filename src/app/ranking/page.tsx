import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RankingContent } from "@/components/ranking/ranking-content";
import { getSessao } from "@/lib/auth/profile";
import {
  listarRanking,
  listarMesesRanking,
  mesCorrenteBRT,
  mesesVisiveis,
  type RankingPeriodo,
} from "@/lib/ranking";
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

  // O ano vem do mês em Brasília: em 31/12 às 22h BRT o servidor em UTC já virou o ano.
  const mesCorrente = mesCorrenteBRT(new Date());
  const anoCorrente = Number(mesCorrente.slice(0, 4));

  const meses =
    atual?.formato === "pontos-corridos"
      ? mesesVisiveis(await listarMesesRanking(atual.id), mesCorrente)
      : [];

  // Pontos corridos abre no mês corrente; se ele não tem jogo, cai no acumulado.
  const periodoInicial: RankingPeriodo = meses.some((m) => m.mes === mesCorrente)
    ? (mesCorrente as RankingPeriodo)
    : "geral";

  const linhas = atual ? await listarRanking(atual.id, periodoInicial) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Ranking
        </h1>
        {atual ? (
          <RankingContent
            key={atual.id}
            linhasIniciais={linhas}
            meuId={sessao.userId}
            competicao={atual}
            competicoes={visiveis}
            meses={meses}
            periodoInicial={periodoInicial}
            anoCorrente={anoCorrente}
          />
        ) : (
          <p className="text-muted-foreground">Nenhuma competição disponível.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
