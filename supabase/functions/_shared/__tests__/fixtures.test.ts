import { describe, it, expect } from "vitest";
import { tsToIso, fixtureToRow, resultToRow } from "../fixtures";

const home = { team_id: "h", name: "Brasil", small_image_path: "https://x/br.png" };
const away = { team_id: "a", name: "Sérvia", small_image_path: null };

describe("tsToIso", () => {
  it("converte unix seconds para ISO UTC", () => {
    expect(tsToIso(1782327600)).toBe(new Date(1782327600 * 1000).toISOString());
  });
});

describe("fixtureToRow", () => {
  it("mapeia um jogo futuro como agendado sem placar", () => {
    const row = fixtureToRow({ match_id: "m1", timestamp: 1782327600, home_team: home, away_team: away });
    expect(row).toEqual({
      api_fixture_id: "m1",
      time_casa: "Brasil",
      time_fora: "Sérvia",
      bandeira_casa: "https://x/br.png",
      bandeira_fora: null,
      inicio_em: new Date(1782327600 * 1000).toISOString(),
      status: "agendado",
      placar_casa: null,
      placar_fora: null,
    });
  });
});

describe("resultToRow", () => {
  it("mapeia um resultado como finalizado com placar", () => {
    const row = resultToRow({
      match_id: "m2",
      timestamp: 1782266400,
      home_team: home,
      away_team: away,
      scores: { home: 2, away: 0 },
    });
    expect(row.status).toBe("finalizado");
    expect(row.placar_casa).toBe(2);
    expect(row.placar_fora).toBe(0);
    expect(row.api_fixture_id).toBe("m2");
  });
});
