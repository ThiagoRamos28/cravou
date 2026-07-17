import { describe, it, expect } from "vitest";
import { calcularForma } from "@/lib/matches";

type J = {
  time_casa: string;
  time_fora: string;
  placar_casa: number | null;
  placar_fora: number | null;
  inicio_em: string;
};

// Helper: jogo em ordem cronológica crescente por índice
function jogo(p: Partial<J> & Pick<J, "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em">): J {
  return p;
}

describe("calcularForma", () => {
  it("pega só os 5 mais recentes, ordenados mais antigo → mais recente", () => {
    // 6 jogos do Botafogo, datas crescentes
    const jogos: J[] = Array.from({ length: 6 }, (_, i) =>
      jogo({
        time_casa: "Botafogo",
        time_fora: `Adv${i}`,
        placar_casa: 1,
        placar_fora: 0,
        inicio_em: `2026-07-0${i + 1}T22:00:00.000Z`,
      }),
    );
    const forma = calcularForma(jogos, "Botafogo");
    expect(forma).toHaveLength(5);
    // mais antigo primeiro (2026-07-02) e mais recente por último (2026-07-06)
    expect(forma[0].inicioEm).toBe("2026-07-02T22:00:00.000Z");
    expect(forma[4].inicioEm).toBe("2026-07-06T22:00:00.000Z");
    expect(forma[0].adversario).toBe("Adv1");
  });

  it("retorna menos de 5 quando o time tem poucos jogos", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Santos", time_fora: "Inter", placar_casa: 0, placar_fora: 0, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Grêmio", time_fora: "Santos", placar_casa: 2, placar_fora: 1, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Santos")).toHaveLength(2);
  });

  it("calcula V/E/D corretamente como mandante", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Time", time_fora: "X", placar_casa: 2, placar_fora: 1, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Y", placar_casa: 1, placar_fora: 1, inicio_em: "2026-07-02T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Z", placar_casa: 0, placar_fora: 3, inicio_em: "2026-07-03T22:00:00.000Z" }),
    ];
    const forma = calcularForma(jogos, "Time");
    expect(forma.map((f) => f.resultado)).toEqual(["V", "E", "D"]);
    expect(forma[0]).toMatchObject({ mando: "casa", adversario: "X", golsPro: 2, golsContra: 1 });
  });

  it("calcula V/E/D corretamente como visitante (placar espelhado)", () => {
    const jogos: J[] = [
      jogo({ time_casa: "X", time_fora: "Time", placar_casa: 0, placar_fora: 2, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Y", time_fora: "Time", placar_casa: 3, placar_fora: 0, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    const forma = calcularForma(jogos, "Time");
    expect(forma.map((f) => f.resultado)).toEqual(["V", "D"]);
    expect(forma[0]).toMatchObject({ mando: "fora", adversario: "X", golsPro: 2, golsContra: 0 });
  });

  it("ignora jogos com placar nulo", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Time", time_fora: "X", placar_casa: null, placar_fora: null, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Y", placar_casa: 1, placar_fora: 0, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Time")).toHaveLength(1);
  });

  it("ignora jogos onde o time não participa", () => {
    const jogos: J[] = [
      jogo({ time_casa: "A", time_fora: "B", placar_casa: 1, placar_fora: 0, inicio_em: "2026-07-01T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Time")).toHaveLength(0);
  });
});
