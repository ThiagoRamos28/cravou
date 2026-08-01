import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CtaSection } from "@/components/landing/cta-section";
import { ProximosJogos } from "@/components/landing/proximos-jogos";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, type Match } from "@/lib/matches";

export default async function Home() {
  const sessao = await getSessao();
  const logado = sessao !== null;

  let proximosJogos: Match[] = [];
  if (logado) {
    // A Task 5 acrescenta competição + opt-in + apenasFuturos aqui.
    const r = await listarJogos({ situacao: "a_fazer", limite: 6 });
    proximosJogos = r.jogos;
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
