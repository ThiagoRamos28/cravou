import { createClient } from "@/lib/supabase/server";

export type Prediction = {
  id: string;
  match_id: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
};

// Mapa por match_id dos palpites do usuário logado. Falha aberta: {} em erro.
export async function listarMeusPalpites(): Promise<Record<string, Prediction>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data } = await supabase
      .from("predictions")
      .select("id, match_id, palpite_casa, palpite_fora, pontos")
      .eq("user_id", user.id);

    const mapa: Record<string, Prediction> = {};
    for (const p of (data as Prediction[]) ?? []) mapa[p.match_id] = p;
    return mapa;
  } catch {
    return {};
  }
}

// Lê minutos_corte da app_config; default 10 em qualquer falha.
export async function getMinutosCorte(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("valor")
      .eq("chave", "minutos_corte")
      .single();
    return (data as { valor: number } | null)?.valor ?? 10;
  } catch {
    return 10;
  }
}
