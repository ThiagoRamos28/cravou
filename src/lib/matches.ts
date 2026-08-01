import { createClient } from "@/lib/supabase/server";
import { limitesDeData, statusPorSituacao, type Situacao } from "@/lib/jogos/filtros";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";

export type Odds = {
  casa: string | null;
  empate: string | null;
  fora: string | null;
  over25: string | null;
  under25: string | null;
  ambas_sim: string | null;
  ambas_nao: string | null;
  bookmaker: string;
  capturado_em: string;
};

export type Match = {
  id: string;
  fase: string;
  rodada: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  inicio_em: string;
  status: "agendado" | "ao_vivo" | "finalizado" | "adiado" | "cancelado";
  placar_casa: number | null;
  placar_fora: number | null;
  odds: Odds | null;
};

export type ResultadoForma = "V" | "E" | "D";

export type FormaJogo = {
  resultado: ResultadoForma;
  golsPro: number;
  golsContra: number;
  adversario: string;
  mando: "casa" | "fora";
  inicioEm: string;
};

export function calcularForma(
  jogosFinalizados: Pick<
    Match,
    "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em"
  >[],
  time: string,
): FormaJogo[] {
  return jogosFinalizados
    .filter(
      (j) =>
        (j.time_casa === time || j.time_fora === time) &&
        j.placar_casa != null &&
        j.placar_fora != null,
    )
    .sort((a, b) => a.inicio_em.localeCompare(b.inicio_em)) // mais antigo → mais recente
    .slice(-5)
    .map((j) => {
      const mando: "casa" | "fora" = j.time_casa === time ? "casa" : "fora";
      const golsPro = (mando === "casa" ? j.placar_casa : j.placar_fora) as number;
      const golsContra = (mando === "casa" ? j.placar_fora : j.placar_casa) as number;
      const adversario = mando === "casa" ? j.time_fora : j.time_casa;
      const resultado: ResultadoForma =
        golsPro > golsContra ? "V" : golsPro === golsContra ? "E" : "D";
      return { resultado, golsPro, golsContra, adversario, mando, inicioEm: j.inicio_em };
    });
}

const COLS =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora, odds";

// Toda opção aqui vira cláusula PostgREST — NENHUMA filtragem em memória. Um `.filter()` sobre
// o resultado depois do `.range()` cortaria a página errada: o banco devolveria 20 linhas e o
// filtro removeria algumas, entregando menos que o pedido e um `total` inconsistente.
export async function listarJogos(filtro?: {
  competicaoId?: string;
  fase?: string;
  rodada?: string;
  situacao?: Situacao;
  de?: string;
  ate?: string;
  ordem?: "asc" | "desc";
  offset?: number;
  limite?: number;
  apenasFuturos?: boolean;
  // Jogo adiado ou cancelado some da listagem: adiado não aconteceu e cancelado nunca vai
  // acontecer, então nenhum dos dois é palpitável nem faz sentido no histórico. O /admin
  // opta por vê-los para poder corrigir à mão.
  incluirNaoJogaveis?: boolean;
}): Promise<{ jogos: Match[]; total: number }> {
  try {
    const situacao = filtro?.situacao ?? "a_fazer";
    const offset = filtro?.offset ?? 0;
    const limite = filtro?.limite ?? JOGOS_POR_PAGINA;
    const ascendente = (filtro?.ordem ?? "asc") === "asc";

    const supabase = await createClient();
    let q = supabase
      .from("matches")
      .select(COLS, { count: "exact" })
      .order("inicio_em", { ascending: ascendente });

    if (filtro?.competicaoId) q = q.eq("competicao_id", filtro.competicaoId);
    if (filtro?.fase) q = q.eq("fase", filtro.fase);
    if (filtro?.rodada) q = q.eq("rodada", filtro.rodada);

    const status = statusPorSituacao(situacao, filtro?.incluirNaoJogaveis ?? false);
    if (status) {
      q = status.length === 1 ? q.eq("status", status[0]) : q.in("status", status);
    }

    const { gte, lt } = limitesDeData(filtro?.de, filtro?.ate);
    if (gte) q = q.gte("inicio_em", gte);
    if (lt) q = q.lt("inicio_em", lt);

    if (filtro?.apenasFuturos) q = q.gt("inicio_em", new Date().toISOString());

    q = q.range(offset, offset + limite - 1);

    const { data, count } = await q;
    return { jogos: (data as Match[]) ?? [], total: count ?? 0 };
  } catch {
    return { jogos: [], total: 0 };
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

// Forma recente (últimos 5 jogos por equipe) de todos os times da competição.
// Deriva de matches finalizados já sincronizados — sem chamadas externas.
export async function listarFormaCompeticao(
  competicaoId: string,
): Promise<Map<string, FormaJogo[]>> {
  const mapa = new Map<string, FormaJogo[]>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select("time_casa, time_fora, placar_casa, placar_fora, inicio_em")
      .eq("competicao_id", competicaoId)
      .eq("status", "finalizado")
      .order("inicio_em", { ascending: true });
    const jogos =
      (data as Pick<
        Match,
        "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em"
      >[]) ?? [];
    const times = new Set<string>();
    for (const j of jogos) {
      times.add(j.time_casa);
      times.add(j.time_fora);
    }
    for (const time of times) {
      mapa.set(time, calcularForma(jogos, time));
    }
    return mapa;
  } catch {
    return mapa;
  }
}
