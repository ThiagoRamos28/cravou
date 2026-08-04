import type { Match } from "@/lib/matches";

export type ItemHistorico = {
  match: Match;
  palpiteCasa: number;
  palpiteFora: number;
  pontos: number;
  pontosMax: number;
};

// Projeção estreita: é tudo que o resumo precisa. Assim ele roda sobre o conjunto filtrado
// INTEIRO sem trazer linhas largas (odds jsonb, bandeiras) do banco — enquanto a lista
// exibida, que é o que custa renderizar, fica paginada.
export type PalpitePontuado = {
  palpiteCasa: number;
  palpiteFora: number;
  placarCasa: number | null;
  placarFora: number | null;
  pontos: number;
  pontosMax: number;
};

export function resumoHistorico(
  linhas: PalpitePontuado[]
): { totalPontos: number; cravadas: number; aproveitamento: number } {
  const totalPontos = linhas.reduce((s, l) => s + l.pontos, 0);
  const cravadas = linhas.filter(
    (l) =>
      l.placarCasa !== null &&
      l.placarFora !== null &&
      l.palpiteCasa === l.placarCasa &&
      l.palpiteFora === l.placarFora
  ).length;
  const maxPossivel = linhas.reduce((s, l) => s + (l.pontosMax ?? 10), 0);
  const aproveitamento =
    maxPossivel === 0 ? 0 : Math.round((totalPontos / maxPossivel) * 100) / 100;
  return { totalPontos, cravadas, aproveitamento };
}

// Converte o item renderizável na projeção do resumo (para quem já tem a lista em mão).
export function paraResumo(itens: ItemHistorico[]): PalpitePontuado[] {
  return itens.map((i) => ({
    palpiteCasa: i.palpiteCasa,
    palpiteFora: i.palpiteFora,
    placarCasa: i.match.placar_casa,
    placarFora: i.match.placar_fora,
    pontos: i.pontos,
    pontosMax: i.pontosMax,
  }));
}
