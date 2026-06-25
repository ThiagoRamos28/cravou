import { createClient } from "@/lib/supabase/server";

export type RankingRow = {
  user_id: string;
  apelido: string | null;
  avatar_url: string | null;
  pontos: number;
  cravadas: number;
  palpites_pontuados: number;
};

// Ranking de todos os usuários, já ordenado (pontos desc, cravadas desc).
// Lê da função SECURITY DEFINER public.ranking(). Falha aberta: [] em erro.
export async function listarRanking(): Promise<RankingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking");
    return (data as RankingRow[]) ?? [];
  } catch {
    return [];
  }
}
