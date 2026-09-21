import { describe, it, expect } from "vitest";
import {
  pontosPalpite,
  matrizPlacares,
  probResultado,
  probOver25,
  lambdasDasOdds,
  lambdasDaForma,
  sugerirPlacares,
  type RegraPontos,
  type JogoH2H,
} from "../palpite-modelo";

const REGRA: RegraPontos = { exato: 15, saldo: 7, resultado: 4, gols: 1 };

function soma(m: number[][]): number {
  return m.flat().reduce((a, b) => a + b, 0);
}

describe("pontosPalpite (espelha public.pontos_palpite)", () => {
  it("placar exato", () => expect(pontosPalpite(2, 1, 2, 1, REGRA)).toBe(15));
  it("saldo certo em vitória", () => expect(pontosPalpite(3, 2, 2, 1, REGRA)).toBe(7));
  it("empate com placar diferente vale só resultado", () =>
    expect(pontosPalpite(1, 1, 0, 0, REGRA)).toBe(4));
  it("resultado certo, saldo errado", () => expect(pontosPalpite(3, 0, 2, 1, REGRA)).toBe(4));
  it("errou resultado mas acertou gols de um time", () =>
    expect(pontosPalpite(2, 3, 2, 1, REGRA)).toBe(1));
  it("errou tudo", () => expect(pontosPalpite(0, 2, 3, 1, REGRA)).toBe(0));
});

describe("matrizPlacares", () => {
  it("é uma distribuição (soma 1)", () => {
    expect(soma(matrizPlacares(1.5, 1.1))).toBeCloseTo(1, 6);
  });

  it("time com λ maior tem mais chance de vencer", () => {
    const r = probResultado(matrizPlacares(2.0, 0.7));
    expect(r.casa).toBeGreaterThan(r.fora);
    expect(r.casa + r.empate + r.fora).toBeCloseTo(1, 6);
  });

  it("Dixon-Coles (ρ<0) aumenta 0x0 e 1x1 em relação a Poisson puro", () => {
    const puro = matrizPlacares(1.3, 1.1, 0);
    const dc = matrizPlacares(1.3, 1.1, -0.1);
    expect(dc[0][0]).toBeGreaterThan(puro[0][0]);
    expect(dc[1][1]).toBeGreaterThan(puro[1][1]);
  });
});

describe("lambdasDasOdds", () => {
  // Gera odds "justas" (sem margem) a partir de λ conhecidos e verifica que o solver os recupera.
  function oddsDe(lc: number, lf: number) {
    const m = matrizPlacares(lc, lf);
    const r = probResultado(m);
    const over = probOver25(m);
    return {
      casa: (1 / r.casa).toFixed(3),
      empate: (1 / r.empate).toFixed(3),
      fora: (1 / r.fora).toFixed(3),
      over25: (1 / over).toFixed(3),
      under25: (1 / (1 - over)).toFixed(3),
    };
  }

  it("recupera λ de um favorito em casa", () => {
    const l = lambdasDasOdds(oddsDe(1.9, 0.8))!;
    expect(l.casa).toBeCloseTo(1.9, 1);
    expect(l.fora).toBeCloseTo(0.8, 1);
  });

  it("recupera λ de um jogo equilibrado", () => {
    const l = lambdasDasOdds(oddsDe(1.2, 1.15))!;
    expect(l.casa).toBeCloseTo(1.2, 1);
    expect(l.fora).toBeCloseTo(1.15, 1);
  });

  it("remove a margem da casa de apostas (odds com juice dão o mesmo λ)", () => {
    const justas = oddsDe(1.6, 1.0);
    const comMargem = Object.fromEntries(
      Object.entries(justas).map(([k, v]) => [k, (Number(v) / 1.06).toFixed(3)])
    ) as typeof justas;
    const l = lambdasDasOdds(comMargem)!;
    expect(l.casa).toBeCloseTo(1.6, 1);
    expect(l.fora).toBeCloseTo(1.0, 1);
  });

  it("funciona só com 1x2 (sem over/under)", () => {
    const o = oddsDe(1.7, 0.9);
    const l = lambdasDasOdds({ casa: o.casa, empate: o.empate, fora: o.fora });
    expect(l).not.toBeNull();
    expect(l!.casa).toBeGreaterThan(l!.fora);
  });

  it("retorna null sem odds válidas", () => {
    expect(lambdasDasOdds(null)).toBeNull();
    expect(lambdasDasOdds({ casa: null, empate: "3.0", fora: "2.0" })).toBeNull();
  });
});

describe("lambdasDaForma", () => {
  function jogo(id: string, casa: string, gc: number, fora: string, gf: number): JogoH2H {
    return {
      match_id: id,
      status: "FINISHED",
      timestamp: 1_700_000_000,
      home_team: { name: casa },
      away_team: { name: fora },
      scores: { home: String(gc), away: String(gf) },
    };
  }

  it("ataque do mandante × defesa do visitante (com fator casa)", () => {
    // Time A marca 2 e sofre 1 por jogo; time B marca 1 e sofre 2 por jogo.
    const ultA = [jogo("a1", "A", 2, "X", 1), jogo("a2", "Y", 1, "A", 2)];
    const ultB = [jogo("b1", "B", 1, "Z", 2), jogo("b2", "W", 2, "B", 1)];
    const l = lambdasDaForma(ultA, ultB, "alvo", "A", "B")!;
    // λcasa = média(2 marcados por A, 2 sofridos por B) × 1,1 = 2,2
    expect(l.casa).toBeCloseTo(2.2, 5);
    // λfora = média(1 marcado por B, 1 sofrido por A) × 0,9 = 0,9
    expect(l.fora).toBeCloseTo(0.9, 5);
  });

  it("ignora o próprio jogo e jogos não finalizados", () => {
    const ultA = [
      jogo("alvo", "A", 9, "B", 9),
      { ...jogo("a2", "A", 9, "X", 9), status: "SCHEDULED" },
      jogo("a3", "A", 1, "X", 1),
    ];
    const ultB = [jogo("b1", "B", 1, "Z", 1)];
    const l = lambdasDaForma(ultA, ultB, "alvo", "A", "B")!;
    expect(l.casa).toBeCloseTo(1.1, 5);
    expect(l.fora).toBeCloseTo(0.9, 5);
  });

  it("retorna null sem jogos suficientes", () => {
    expect(lambdasDaForma([], [], "alvo", "A", "B")).toBeNull();
  });
});

describe("sugerirPlacares", () => {
  it("devolve 3 placares distintos, o 1º com a maior pontuação esperada", () => {
    const m = matrizPlacares(1.8, 0.9);
    const s = sugerirPlacares(m, REGRA);
    expect(s).toHaveLength(3);
    const chaves = new Set(s.map((x) => `${x.casa}x${x.fora}`));
    expect(chaves.size).toBe(3);
    for (let c = 0; c <= 5; c++) {
      for (let f = 0; f <= 5; f++) {
        const ep = m.reduce(
          (acc, linha, rc) =>
            acc + linha.reduce((a, p, rf) => a + p * pontosPalpite(c, f, rc, rf, REGRA), 0),
          0
        );
        expect(s[0].pontosEsperados).toBeGreaterThanOrEqual(ep - 1e-9);
      }
    }
  });

  it("a 3ª opção cobre um resultado diferente da 1ª", () => {
    const s = sugerirPlacares(matrizPlacares(1.8, 0.9), REGRA);
    const sinal = (x: { casa: number; fora: number }) => Math.sign(x.casa - x.fora);
    expect(sinal(s[2])).not.toBe(sinal(s[0]));
  });

  it("probabilidades e pontos são coerentes (0..1 e ≥ 0)", () => {
    for (const x of sugerirPlacares(matrizPlacares(1.1, 1.1), REGRA)) {
      expect(x.prob).toBeGreaterThan(0);
      expect(x.prob).toBeLessThan(1);
      expect(x.pontosEsperados).toBeGreaterThan(0);
    }
  });
});
