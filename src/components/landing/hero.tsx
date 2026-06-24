"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const reduce = useReducedMotion();
  const variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : item;

  return (
    <section className="relative overflow-hidden">
      {/* fundo decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.15]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32"
      >
        <motion.span
          variants={variants}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          Copa do Mundo 2026 · bolão da galera
        </motion.span>

        <motion.h1
          variants={variants}
          className="max-w-4xl text-balance font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl"
        >
          Deu o jogo?{" "}
          <span className="text-primary">Você</span>{" "}
          <span className="text-accent">cravou!</span>
        </motion.h1>

        <motion.p
          variants={variants}
          className="max-w-prose text-pretty text-lg text-muted-foreground sm:text-xl"
        >
          Registre seus palpites para cada partida, acerte os placares e veja
          quem manda no ranking até a final.
        </motion.p>

        <motion.div
          variants={variants}
          className="mt-2 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link href="/entrar" className={buttonVariants("cta", "lg")}>
            Começar a palpitar
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/ranking" className={buttonVariants("outline", "lg")}>
            <Target className="h-5 w-5" aria-hidden="true" />
            Ver o ranking
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
