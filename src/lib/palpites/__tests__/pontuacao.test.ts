import { describe, it, expect } from "vitest";
import { pontuar } from "@/lib/palpites/pontuacao";

describe("pontuar (modelo pega-a-maior, 5 níveis)", () => {
  it("placar exato (vitória) → 10", () => {
    expect(pontuar(2, 1, 2, 1)).toBe(10);
  });

  it("empate exato → 10", () => {
    expect(pontuar(1, 1, 1, 1)).toBe(10);
  });

  it("saldo + vencedor (vitória, diferença exata, placar diferente) → 7", () => {
    expect(pontuar(2, 0, 3, 1)).toBe(7); // casa vence por 2
    expect(pontuar(1, 3, 0, 2)).toBe(7); // fora vence por 2
  });

  it("resultado V/E/D certo mas diferença errada → 5", () => {
    expect(pontuar(1, 0, 3, 1)).toBe(5); // casa vence, mas saldo 1 ≠ 2
  });

  it("empate não-exato NÃO pega o nível saldo → 5", () => {
    expect(pontuar(1, 1, 2, 2)).toBe(5);
  });

  it("errou o resultado mas acertou os gols de um time → 2", () => {
    expect(pontuar(2, 1, 2, 3)).toBe(2); // errou (previu casa, deu fora), acertou gols da casa
    expect(pontuar(0, 1, 3, 1)).toBe(2); // errou resultado, acertou gols do fora
  });

  it("errou tudo → 0", () => {
    expect(pontuar(0, 0, 3, 1)).toBe(0);
  });

  it("usa valores de pontos configuráveis", () => {
    const cfg = { ptsExato: 25, ptsSaldo: 18, ptsResultado: 12, ptsGols: 5 };
    expect(pontuar(2, 1, 2, 1, cfg)).toBe(25);
    expect(pontuar(2, 0, 3, 1, cfg)).toBe(18);
    expect(pontuar(1, 0, 3, 1, cfg)).toBe(12);
    expect(pontuar(2, 1, 2, 3, cfg)).toBe(5);
    expect(pontuar(0, 0, 3, 1, cfg)).toBe(0);
  });
});
