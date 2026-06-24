"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Atraso em segundos para encadear entradas. */
  delay?: number;
  /** Direção do deslize na entrada. */
  from?: "up" | "down" | "none";
}

export function Reveal({
  children,
  className,
  delay = 0,
  from = "up",
}: RevealProps) {
  const reduce = useReducedMotion();

  const offset = from === "none" || reduce ? 0 : from === "down" ? -24 : 24;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const }}
    >
      {children}
    </motion.div>
  );
}
