import { describe, it, expect } from "vitest";
import { resumoHistorico, type PalpitePontuado } from "@/lib/historico";

function linha(p: Partial<PalpitePontuado> = {}): PalpitePontuado {
  return {
    palpiteCasa: 1,
    palpiteFora: 0,
    placarCasa: 1,
    placarFora: 0,
    pontos: 15,
    pontosMax: 15,
    ...p,
  };
}

describe("resumoHistorico", () => {
  it("conjunto vazio não divide por zero", () => {
    expect(resumoHistorico([])).toEqual({
      totalPontos: 0,
      cravadas: 0,
      aproveitamento: 0,
    });
  });

  it("soma pontos e conta cravadas", () => {
    const r = resumoHistorico([
      linha(),
      linha({ palpiteCasa: 2, palpiteFora: 2, placarCasa: 1, placarFora: 0, pontos: 0 }),
    ]);
    expect(r.totalPontos).toBe(15);
    expect(r.cravadas).toBe(1);
  });

  it("aproveitamento é pontos sobre o máximo possível", () => {
    const r = resumoHistorico([linha({ pontos: 4, pontosMax: 15 }), linha({ pontos: 15 })]);
    // 19 de 30
    expect(r.aproveitamento).toBeCloseTo(0.63, 2);
  });

  it("não conta cravada quando o jogo não tem placar", () => {
    const r = resumoHistorico([
      linha({ placarCasa: null, placarFora: null, pontos: 0, pontosMax: 15 }),
    ]);
    expect(r.cravadas).toBe(0);
  });
});
