import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";

export function CtaSection({ logado = false }: { logado?: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-accent),transparent_55%)] opacity-40"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
              Bora cravar o próximo placar?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              {logado
                ? "Seus palpites te esperam. Veja os próximos jogos e crave o placar."
                : "Crie sua conta em segundos e comece a palpitar nos jogos de hoje."}
            </p>
            <Link
              href={logado ? "/jogos" : "/entrar"}
              className={`${buttonVariants("cta", "lg")} mt-8`}
            >
              {logado ? "Ver os jogos" : "Criar minha conta"}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
