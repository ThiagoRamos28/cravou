import type { Match } from "@/lib/matches";

export type ItemHistorico = {
  match: Match;
  palpiteCasa: number;
  palpiteFora: number;
  pontos: number;
  pontosMax: number;
};

export function resumoHistorico(
  itens: ItemHistorico[]
): { totalPontos: number; cravadas: number; aproveitamento: number } {
  const totalPontos = itens.reduce((s, i) => s + i.pontos, 0);
  const cravadas = itens.filter(
    (i) => i.palpiteCasa === i.match.placar_casa && i.palpiteFora === i.match.placar_fora
  ).length;
  const maxPossivel = itens.reduce((s, i) => s + (i.pontosMax ?? 10), 0);
  const aproveitamento =
    maxPossivel === 0 ? 0 : Math.round((totalPontos / maxPossivel) * 100) / 100;
  return { totalPontos, cravadas, aproveitamento };
}
