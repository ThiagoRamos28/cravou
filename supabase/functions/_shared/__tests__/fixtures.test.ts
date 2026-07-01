import { describe, it, expect } from "vitest";
import {
  tsToIso,
  fixtureToRow,
  resultToRow,
  decisaoFromStatus,
  placar90Min,
  rodadaFromTournamentName,
  type FsMatchDetails,
} from "../fixtures";

const home = { team_id: "h", name: "Brasil", small_image_path: "https://x/br.png" };
const away = { team_id: "a", name: "Sérvia", small_image_path: null };

describe("tsToIso", () => {
  it("converte unix seconds para ISO UTC", () => {
    expect(tsToIso(1782327600)).toBe(new Date(1782327600 * 1000).toISOString());
  });
});

describe("fixtureToRow", () => {
  it("mapeia um jogo futuro como agendado com fase/rodada", () => {
    const row = fixtureToRow(
      { match_id: "m1", timestamp: 1782327600, home_team: home, away_team: away },
      "grupos",
      "1"
    );
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
      decisao: "normal",
      placar_penaltis_casa: null,
      placar_penaltis_fora: null,
      fase: "grupos",
      rodada: "1",
    });
  });

  it("usa defaults quando fase/rodada não são passados", () => {
    const row = fixtureToRow({ match_id: "m1", timestamp: 1, home_team: home, away_team: away });
    expect(row.fase).toBe("grupos");
    expect(row.rodada).toBe("");
  });
});

describe("resultToRow", () => {
  it("mapeia um resultado como finalizado com placar e fase/rodada", () => {
    const row = resultToRow(
      { match_id: "m2", timestamp: 1782266400, home_team: home, away_team: away, scores: { home: 2, away: 0 } },
      "oitavas",
      ""
    );
    expect(row.status).toBe("finalizado");
    expect(row.placar_casa).toBe(2);
    expect(row.placar_fora).toBe(0);
    expect(row.fase).toBe("oitavas");
  });
});

describe("decisaoFromStatus", () => {
  it("retorna 'normal' quando não houve prorrogação nem pênaltis", () => {
    expect(
      decisaoFromStatus({ is_finished_after_extra_time: false, is_finished_after_penalties: false })
    ).toBe("normal");
  });

  it("retorna 'prorrogacao' quando terminou na prorrogação sem pênaltis", () => {
    expect(
      decisaoFromStatus({ is_finished_after_extra_time: true, is_finished_after_penalties: false })
    ).toBe("prorrogacao");
  });

  it("retorna 'penaltis' quando foi decidido nos pênaltis", () => {
    expect(
      decisaoFromStatus({ is_finished_after_extra_time: false, is_finished_after_penalties: true })
    ).toBe("penaltis");
  });
});

describe("placar90Min", () => {
  it("soma 1º e 2º tempo e ignora prorrogação/pênaltis (jogo normal)", () => {
    const details: FsMatchDetails = {
      match_id: "m1",
      scores: {
        home: 2,
        away: 0,
        home_1st_half: 1,
        away_1st_half: 0,
        home_2nd_half: 1,
        away_2nd_half: 0,
        home_extra_time: 0,
        away_extra_time: 0,
        home_penalties: null,
        away_penalties: null,
      },
      match_status: { is_finished_after_extra_time: false, is_finished_after_penalties: false },
    };
    expect(placar90Min(details)).toEqual({
      placar_casa: 2,
      placar_fora: 0,
      decisao: "normal",
      placar_penaltis_casa: null,
      placar_penaltis_fora: null,
    });
  });

  it("ignora gols da prorrogação e devolve o placar de pênaltis quando decidido nos pênaltis", () => {
    const details: FsMatchDetails = {
      match_id: "S0MygXWj",
      scores: {
        home: 1,
        away: 1,
        home_1st_half: 0,
        away_1st_half: 0,
        home_2nd_half: 1,
        away_2nd_half: 1,
        home_extra_time: 0,
        away_extra_time: 0,
        home_penalties: 2,
        away_penalties: 3,
      },
      match_status: { is_finished_after_extra_time: false, is_finished_after_penalties: true },
    };
    expect(placar90Min(details)).toEqual({
      placar_casa: 1,
      placar_fora: 1,
      decisao: "penaltis",
      placar_penaltis_casa: 2,
      placar_penaltis_fora: 3,
    });
  });

  it("soma gols da prorrogação seriam descartados mesmo se existirem", () => {
    const details: FsMatchDetails = {
      match_id: "m2",
      scores: {
        home: 2,
        away: 1,
        home_1st_half: 1,
        away_1st_half: 1,
        home_2nd_half: 0,
        away_2nd_half: 0,
        home_extra_time: 1,
        away_extra_time: 0,
        home_penalties: null,
        away_penalties: null,
      },
      match_status: { is_finished_after_extra_time: true, is_finished_after_penalties: false },
    };
    expect(placar90Min(details)).toEqual({
      placar_casa: 1,
      placar_fora: 1,
      decisao: "prorrogacao",
      placar_penaltis_casa: null,
      placar_penaltis_fora: null,
    });
  });
});

describe("rodadaFromTournamentName", () => {
  it("mapeia rótulos conhecidos de mata-mata para pt-BR", () => {
    expect(rodadaFromTournamentName("World Championship - Play Offs - 1/16-finals")).toBe(
      "dezesseis-avos"
    );
    expect(rodadaFromTournamentName("World Championship - Play Offs - 1/8-finals")).toBe("oitavas");
    expect(rodadaFromTournamentName("World Championship - Play Offs - 1/4-finals")).toBe("quartas");
    expect(rodadaFromTournamentName("World Championship - Play Offs - 1/2-finals")).toBe("semifinal");
    expect(rodadaFromTournamentName("World Championship - Play Offs - Final")).toBe("final");
    expect(rodadaFromTournamentName("World Championship - Play Offs - 3rd Place")).toBe(
      "terceiro-lugar"
    );
  });

  it("faz slugify do texto quando não reconhece o rótulo", () => {
    expect(rodadaFromTournamentName("Something - Weird Round!")).toBe("weird-round");
  });
});
