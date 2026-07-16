"use server";

import { listarRanking, type RankingPeriodo, type RankingRow } from "@/lib/ranking";

const PERIODOS: RankingPeriodo[] = ["geral", "temporada_1", "temporada_2"];

export async function buscarRanking(
  competicaoId: string,
  periodo: string
): Promise<RankingRow[]> {
  const p: RankingPeriodo = (PERIODOS as string[]).includes(periodo)
    ? (periodo as RankingPeriodo)
    : "geral";
  return listarRanking(competicaoId, p);
}
