import { createClient } from "@/lib/supabase/server";
import { limitesDeData } from "@/lib/jogos/filtros";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { Match } from "@/lib/matches";
import type { ItemHistorico, PalpitePontuado } from "@/lib/historico";

const COLS_HISTORICO =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora, odds";

type PalpiteEmbed = {
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  pontos_max: number | null;
};

type Filtro = {
  competicaoId: string;
  userId: string;
  de?: string;
  ate?: string;
};

// Parte de `matches` DE PROPÓSITO. Ordenar e paginar por coluna do PAI funciona; a tentação
// de partir de `predictions` e ordenar por `matches.inicio_em` com a opção `referencedTable`
// falha em silêncio — o doc do PostgREST diz que ela ordena o array embutido, não as linhas
// do pai, então as páginas sairiam em ordem arbitrária sem erro nenhum.
//
// O `!inner` descarta jogo sem palpite do usuário. Como `predictions.match_id → matches.id`
// é um-para-muitos, o embed vem como ARRAY de um elemento (a RLS predictions_select_own já
// restringiria ao próprio usuário; o filtro explícito é defesa em profundidade).
function queryBase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: Filtro,
  colunas: string
) {
  let q = supabase
    .from("matches")
    .select(
      `${colunas}, predictions!inner(palpite_casa, palpite_fora, pontos, pontos_max)`,
      { count: "exact" }
    )
    .eq("competicao_id", f.competicaoId)
    .eq("status", "finalizado")
    .eq("predictions.user_id", f.userId);

  const { gte, lt } = limitesDeData(f.de, f.ate);
  if (gte) q = q.gte("inicio_em", gte);
  if (lt) q = q.lt("inicio_em", lt);
  return q;
}

// Falha aberta: vazio em erro, como o resto da camada de dados do projeto.
export async function listarHistorico(
  f: Filtro & { ordem?: "asc" | "desc"; offset?: number; limite?: number }
): Promise<{ itens: ItemHistorico[]; total: number }> {
  try {
    const offset = f.offset ?? 0;
    const limite = f.limite ?? JOGOS_POR_PAGINA;
    const supabase = await createClient();
    const { data, count } = await queryBase(supabase, f, COLS_HISTORICO)
      .order("inicio_em", { ascending: (f.ordem ?? "desc") === "asc" })
      .range(offset, offset + limite - 1);

    const linhas = (data as unknown as (Match & { predictions: PalpiteEmbed[] })[]) ?? [];
    const itens = linhas.map((linha) => {
      const { predictions, ...match } = linha;
      const p = predictions[0];
      return {
        match: match as Match,
        palpiteCasa: p.palpite_casa,
        palpiteFora: p.palpite_fora,
        pontos: p.pontos ?? 0,
        pontosMax: p.pontos_max ?? 10,
      };
    });
    return { itens, total: count ?? 0 };
  } catch {
    return { itens: [], total: 0 };
  }
}

// O resumo NÃO pode sair da página exibida — seriam "os pontos daquela página". Roda sobre
// todo o conjunto filtrado, numa projeção estreita (sem odds, sem bandeiras).
export async function linhasParaResumo(f: Filtro): Promise<PalpitePontuado[]> {
  try {
    const supabase = await createClient();
    const { data } = await queryBase(supabase, f, "placar_casa, placar_fora");
    type Estreita = {
      placar_casa: number | null;
      placar_fora: number | null;
      predictions: PalpiteEmbed[];
    };
    return ((data as unknown as Estreita[]) ?? []).map((l) => ({
      palpiteCasa: l.predictions[0].palpite_casa,
      palpiteFora: l.predictions[0].palpite_fora,
      placarCasa: l.placar_casa,
      placarFora: l.placar_fora,
      pontos: l.predictions[0].pontos ?? 0,
      pontosMax: l.predictions[0].pontos_max ?? 10,
    }));
  } catch {
    return [];
  }
}
