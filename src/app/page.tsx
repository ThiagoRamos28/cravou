import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CtaSection } from "@/components/landing/cta-section";
import { ProximosJogos } from "@/components/landing/proximos-jogos";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, type Match } from "@/lib/matches";
import { getMinutosCorte } from "@/lib/predictions";

export default async function Home() {
  const sessao = await getSessao();
  const logado = sessao !== null;

  let proximosJogos: Match[] = [];
  if (logado) {
    const mc = await getMinutosCorte();
    proximosJogos = await listarJogos({ soAbertos: true, minutosCorte: mc, limite: 6 });
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
