import { createClient } from "@/lib/supabase/server";

export type Match = {
  id: string;
  fase: string;
  rodada: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  inicio_em: string;
  status: "agendado" | "ao_vivo" | "finalizado";
  placar_casa: number | null;
  placar_fora: number | null;
};

export async function listarJogos(): Promise<Match[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select(
        "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora"
      )
      .order("inicio_em", { ascending: true });
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}
