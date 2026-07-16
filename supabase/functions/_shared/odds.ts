// Extrator puro de odds a partir da resposta de matches/odds da FlashScore.
// Sem I/O — testável com fixture.

export type OddsSnapshot = {
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

type Selecao = {
  value?: string;
  selection?: string | null;
  handicap?: { value?: string } | null;
  bothTeamsToScore?: boolean | null;
};
type Mercado = { bettingType?: string; bettingScope?: string; odds?: Selecao[] };
type Bookmaker = { name?: string; odds?: Mercado[] };

// Escolhe bet365 (senão a 1ª casa) e extrai os 3 mercados FULL_TIME. Retorna null se
// não houver bookmaker válido ou se o 1x2 estiver incompleto.
export function extrairOdds(payload: unknown, agora = new Date()): OddsSnapshot | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const casas = payload as Bookmaker[];
  const bm =
    casas.find((b) => b.name?.toLowerCase() === "bet365") ?? casas[0];
  if (!bm || !Array.isArray(bm.odds)) return null;

  const mercado = (tipo: string): Selecao[] =>
    bm.odds!.find((m) => m.bettingType === tipo && m.bettingScope === "FULL_TIME")
      ?.odds ?? [];

  // 1x2 — ordem [casa, empate, fora]
  const um2 = mercado("HOME_DRAW_AWAY");
  const casa = um2[0]?.value ?? null;
  const empate = um2[1]?.value ?? null;
  const fora = um2[2]?.value ?? null;
  if (casa === null || empate === null || fora === null) return null;

  // Over/Under 2.5
  const ou = mercado("OVER_UNDER").filter((o) => o.handicap?.value === "2.5");
  const over25 = ou.find((o) => o.selection === "OVER")?.value ?? null;
  const under25 = ou.find((o) => o.selection === "UNDER")?.value ?? null;

  // Ambas marcam
  const btts = mercado("BOTH_TEAMS_TO_SCORE");
  const ambas_sim = btts.find((o) => o.bothTeamsToScore === true)?.value ?? null;
  const ambas_nao = btts.find((o) => o.bothTeamsToScore === false)?.value ?? null;

  return {
    casa,
    empate,
    fora,
    over25,
    under25,
    ambas_sim,
    ambas_nao,
    bookmaker: bm.name ?? "?",
    capturado_em: agora.toISOString(),
  };
}
