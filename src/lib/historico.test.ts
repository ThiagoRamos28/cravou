import { describe, it, expect } from "vitest";
import { resumoHistorico, type ItemHistorico } from "@/lib/historico";
import type { Match } from "@/lib/matches";

const m = (id: string): Match => ({
  id, fase: "grupos", rodada: "1", time_casa: "A", time_fora: "B",
  bandeira_casa: null, bandeira_fora: null, inicio_em: "2026-06-12T18:00:00.000Z",
  status: "finalizado", placar_casa: 2, placar_fora: 1,
});

const itens: ItemHistorico[] = [
  { match: m("1"), palpiteCasa: 2, palpiteFora: 1, pontos: 10 },
  { match: m("2"), palpiteCasa: 1, palpiteFora: 0, pontos: 5 },
  { match: m("3"), palpiteCasa: 0, palpiteFora: 0, pontos: 0 },
];

describe("resumoHistorico", () => {
  it("soma pontos, conta cravadas e calcula aproveitamento", () => {
    const r = resumoHistorico(itens, 10);
    expect(r.totalPontos).toBe(15);
    expect(r.cravadas).toBe(1);
    expect(r.aproveitamento).toBe(0.5); // 15 / (3*10)
  });

  it("aproveitamento 0 quando não há itens", () => {
    expect(resumoHistorico([], 10)).toEqual({ totalPontos: 0, cravadas: 0, aproveitamento: 0 });
  });
});
