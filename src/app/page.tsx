import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CtaSection } from "@/components/landing/cta-section";
import { getSessao } from "@/lib/auth/profile";

export default async function Home() {
  const sessao = await getSessao();
  const logado = sessao !== null;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <CtaSection logado={logado} />
      </main>
      <SiteFooter />
    </div>
  );
}
