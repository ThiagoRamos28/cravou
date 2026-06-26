import { createClient } from "@/lib/supabase/server";
import { palpiteAberto } from "@/lib/palpites/corte";

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

const COLS =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora";

export async function listarJogos(filtro?: {
  fase?: string;
  rodada?: string;
  soAbertos?: boolean;
  soEncerrados?: boolean;
  minutosCorte?: number;
  limite?: number;
}): Promise<Match[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("matches").select(COLS).order("inicio_em", { ascending: true });
    if (filtro?.fase) q = q.eq("fase", filtro.fase);
    if (filtro?.rodada) q = q.eq("rodada", filtro.rodada);
    if (filtro?.soEncerrados) q = q.eq("status", "finalizado");
    const { data } = await q;
    let resultado = (data as Match[]) ?? [];
    if (filtro?.soAbertos) {
      const corte = filtro.minutosCorte ?? 10;
      const agora = Date.now();
      resultado = resultado.filter(
        (m) =>
          m.status !== "finalizado" &&
          (m.status === "ao_vivo" ||
            palpiteAberto(m.inicio_em, corte) ||
            new Date(m.inicio_em).getTime() <= agora)
      );
    }
    if (filtro?.limite) resultado = resultado.slice(0, filtro.limite);
    return resultado;
  } catch {
    return [];
  }
}

// Fases existentes (ordenadas pela 1ª data) com suas rodadas distintas.
export async function listarFasesERodadas(): Promise<
  { fase: string; rodadas: string[] }[]
> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select("fase, rodada, inicio_em")
      .order("inicio_em", { ascending: true });
    const rows = (data as { fase: string; rodada: string }[]) ?? [];
    const ordem: string[] = [];
    const mapa = new Map<string, string[]>();
    for (const r of rows) {
      if (!mapa.has(r.fase)) {
        mapa.set(r.fase, []);
        ordem.push(r.fase);
      }
      const rodadas = mapa.get(r.fase)!;
      if (r.rodada && !rodadas.includes(r.rodada)) rodadas.push(r.rodada);
    }
    return ordem.map((fase) => ({
      fase,
      rodadas: [...mapa.get(fase)!].sort(),
    }));
  } catch {
    return [];
  }
}
