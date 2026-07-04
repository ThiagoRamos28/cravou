import { createClient } from "@/lib/supabase/server";

export type RankingRow = {
  user_id: string;
  apelido: string | null;
  avatar_url: string | null;
  pontos: number;
  cravadas: number;
  acertos_saldo: number;
  acertos_resultado: number;
  acertos_gols: number;
  erros: number;
  palpites_pontuados: number;
  total_palpites: number;
  pontos_max_total: number;
};

export type RankingPeriodo = "geral" | "temporada_1" | "temporada_2";

// Ranking de todos os usuários, já ordenado (pontos desc, cravadas desc).
// Lê da função SECURITY DEFINER public.ranking(). Falha aberta: [] em erro.
export async function listarRanking(
  periodo: RankingPeriodo = "geral"
): Promise<RankingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking", { p_periodo: periodo });
    return (data as RankingRow[]) ?? [];
  } catch {
    return [];
  }
}
