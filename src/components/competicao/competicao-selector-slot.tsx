"use client";

import { usePathname } from "next/navigation";
import { CompeticaoSelector } from "@/components/competicao/competicao-selector";
import type { Competicao } from "@/lib/competicoes-shared";

// Em /ranking a escolha de competição é feita pelas abas da própria página;
// manter o seletor do header ali seriam dois controles para a mesma coisa.
export function CompeticaoSelectorSlot({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const pathname = usePathname();
  if (pathname === "/ranking") return null;
  return <CompeticaoSelector competicoes={competicoes} selecionadaId={selecionadaId} />;
}
