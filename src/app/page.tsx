import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CtaSection } from "@/components/landing/cta-section";
import { ProximosJogos } from "@/components/landing/proximos-jogos";
import { cookies } from "next/headers";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, type Match } from "@/lib/matches";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

export default async function Home() {
  const sessao = await getSessao();
  const logado = sessao !== null;

  let proximosJogos: Match[] = [];
  if (logado) {
    const [todas, optIns, cookieStore] = await Promise.all([
      listarCompeticoes(),
      meusOptIns(),
      cookies(),
    ]);
    const visiveis = competicoesVisiveis(todas, optIns);
    const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
    const participando = atual ? optIns.includes(atual.slug) : false;

    // `apenasFuturos` é o que conserta a queixa dos "jogos antigos": a ordem é crescente e o
    // limite corta os 6 PRIMEIROS, então sem esse filtro os jogos com horário já vencido
    // entravam na frente — e com 6 ou mais atrasados a seção não mostrava jogo futuro algum.
    // `competicaoId` + opt-in impedem mostrar jogo de competição que o usuário não acompanha.
    if (atual && participando) {
      const { jogos } = await listarJogos({
        competicaoId: atual.id,
        situacao: "a_fazer",
        apenasFuturos: true,
        ordem: "asc",
        limite: 6,
      });
      proximosJogos = jogos;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero logado={logado} />
        <ProximosJogos jogos={proximosJogos} logado={logado} />
        <Features />
        <CtaSection logado={logado} />
      </main>
      <SiteFooter />
    </div>
  );
}
