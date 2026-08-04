"use server";

import { listarRanking } from "@/lib/ranking";
import { normalizarPeriodo, type RankingRow } from "@/lib/ranking-shared";

export async function buscarRanking(
  competicaoId: string,
  periodo: string
): Promise<RankingRow[]> {
  return listarRanking(competicaoId, normalizarPeriodo(periodo));
}
