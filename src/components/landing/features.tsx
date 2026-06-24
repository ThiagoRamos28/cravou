import { PencilLine, Star, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

interface Feature {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: PencilLine,
    step: "01",
    title: "Palpite",
    description:
      "Cravar o placar de cada jogo da Copa antes do apito inicial. Pode editar até pouco antes da bola rolar.",
  },
  {
    icon: Star,
    step: "02",
    title: "Pontue",
    description:
      "Placar exato vale 10 pontos. Acertou só quem ganhou? Leva 5. A pontuação entra sozinha quando o jogo acaba.",
  },
  {
    icon: Trophy,
    step: "03",
    title: "Suba no ranking",
    description:
      "Acompanhe a classificação em tempo real e dispute o topo com a galera até a grande final.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Como funciona
        </h2>
        <p className="mt-3 text-muted-foreground">
          Três passos pra entrar na brincadeira e não largar até a final.
        </p>
      </Reveal>

      <div className="grid gap-6 sm:grid-cols-3">
        {features.map((feature, i) => (
          <Reveal key={feature.step} delay={i * 0.1}>
            <article className="group h-full rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-display text-3xl font-bold text-muted-foreground/40">
                  {feature.step}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
