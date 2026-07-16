import { describe, it, expect } from "vitest";
import { extrairOdds } from "../odds";

// Fixture mínimo no formato da FlashScore: lista de bookmakers.
function bookmaker(name: string) {
  return {
    name,
    image: "x",
    odds: [
      {
        bettingType: "HOME_DRAW_AWAY",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "2.32", eventParticipantId: "home" },
          { value: "3.10", eventParticipantId: null },
          { value: "3.00", eventParticipantId: "away" },
        ],
      },
      {
        bettingType: "OVER_UNDER",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "9.9", selection: "OVER", handicap: { value: "0.5" } },
          { value: "1.95", selection: "OVER", handicap: { value: "2.5" } },
          { value: "1.85", selection: "UNDER", handicap: { value: "2.5" } },
        ],
      },
      {
        bettingType: "BOTH_TEAMS_TO_SCORE",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "1.80", bothTeamsToScore: true },
          { value: "1.95", bothTeamsToScore: false },
        ],
      },
    ],
  };
}

const agora = new Date("2026-07-16T18:00:00.000Z");

describe("extrairOdds", () => {
  it("extrai 1x2, over/under 2.5 e ambas marcam do bet365", () => {
    const snap = extrairOdds([bookmaker("outra"), bookmaker("bet365")], agora);
    expect(snap).toEqual({
      casa: "2.32",
      empate: "3.10",
      fora: "3.00",
      over25: "1.95",
      under25: "1.85",
      ambas_sim: "1.80",
      ambas_nao: "1.95",
      bookmaker: "bet365",
      capturado_em: "2026-07-16T18:00:00.000Z",
    });
  });

  it("usa a 1ª casa quando não há bet365", () => {
    const snap = extrairOdds([bookmaker("betano")], agora);
    expect(snap?.bookmaker).toBe("betano");
    expect(snap?.casa).toBe("2.32");
  });

  it("retorna null sem bookmakers", () => {
    expect(extrairOdds([], agora)).toBeNull();
    expect(extrairOdds(null, agora)).toBeNull();
  });

  it("retorna null quando falta o 1x2", () => {
    const semUm2 = { name: "bet365", odds: [] };
    expect(extrairOdds([semUm2], agora)).toBeNull();
  });

  it("mantém objeto válido com over/under e ambas ausentes (campos null)", () => {
    const soUm2 = {
      name: "bet365",
      odds: [
        {
          bettingType: "HOME_DRAW_AWAY",
          bettingScope: "FULL_TIME",
          odds: [{ value: "2.0" }, { value: "3.0" }, { value: "4.0" }],
        },
      ],
    };
    const snap = extrairOdds([soUm2], agora);
    expect(snap?.over25).toBeNull();
    expect(snap?.under25).toBeNull();
    expect(snap?.ambas_sim).toBeNull();
    expect(snap?.ambas_nao).toBeNull();
    expect(snap?.casa).toBe("2.0");
  });
});
