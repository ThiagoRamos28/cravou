import type { Match } from "@/lib/matches";

export type ItemHistorico = {
  match: Match;
  palpiteCasa: number;
  palpiteFora: number;
  pontos: number;
};

export function resumoHistorico(
  itens: ItemHistorico[],
  ptsMaximo: number
): { totalPontos: number; cravadas: number; aproveitamento: number } {
  const totalPontos = itens.reduce((s, i) => s + i.pontos, 0);
  const cravadas = itens.filter((i) => i.pontos === ptsMaximo).length;
  const maxPossivel = itens.length * ptsMaximo;
  const aproveitamento =
    maxPossivel === 0 ? 0 : Math.round((totalPontos / maxPossivel) * 100) / 100;
  return { totalPontos, cravadas, aproveitamento };
}
