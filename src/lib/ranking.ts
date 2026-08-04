import { createClient } from "@/lib/supabase/server";
import type { MesRanking, RankingPeriodo, RankingRow } from "@/lib/ranking-shared";

// Os tipos e as funções puras moraram aqui até a 0026; foram para o módulo shared para
// serem importáveis por componentes client. Re-exportados para não quebrar imports.
export * from "@/lib/ranking-shared";

// Ranking de uma competição, já ordenado. Falha aberta: [] em erro.
export async function listarRanking(
  competicaoId: string,
  periodo: RankingPeriodo = "geral"
): Promise<RankingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking", {
      p_competicao_id: competicaoId,
      p_periodo: periodo,
    });
    return (data as RankingRow[]) ?? [];
  } catch {
    return [];
  }
}

// Meses de uma competição, com jogos/palpites e se já fecharam. Falha aberta: [] em erro.
export async function listarMesesRanking(competicaoId: string): Promise<MesRanking[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking_meses", {
      p_competicao_id: competicaoId,
    });
    return (data as MesRanking[]) ?? [];
  } catch {
    return [];
  }
}
