export type FsTeam = {
  team_id: string;
  name: string;
  small_image_path: string | null;
};

export type FsFixture = {
  match_id: string;
  timestamp: number;
  home_team: FsTeam;
  away_team: FsTeam;
};

export type FsResult = FsFixture & {
  scores: { home: number | null; away: number | null };
};

export type Decisao = "normal" | "prorrogacao" | "penaltis";

export type FsMatchStatus = {
  is_finished_after_extra_time: boolean;
  is_finished_after_penalties: boolean;
};

export type FsDetailsScores = {
  home: number;
  away: number;
  home_1st_half: number;
  away_1st_half: number;
  home_2nd_half: number;
  away_2nd_half: number;
  home_extra_time: number;
  away_extra_time: number;
  home_penalties: number | null;
  away_penalties: number | null;
};

export type FsMatchDetails = {
  match_id: string;
  scores: FsDetailsScores;
  match_status: FsMatchStatus;
  tournament?: { name: string };
};

export type MatchRow = {
  api_fixture_id: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  inicio_em: string;
  status: "agendado" | "finalizado";
  placar_casa: number | null;
  placar_fora: number | null;
  decisao: Decisao;
  placar_penaltis_casa: number | null;
  placar_penaltis_fora: number | null;
  fase: string;
  rodada: string;
};

export function tsToIso(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

function base(f: FsFixture) {
  return {
    api_fixture_id: f.match_id,
    time_casa: f.home_team.name,
    time_fora: f.away_team.name,
    bandeira_casa: f.home_team.small_image_path,
    bandeira_fora: f.away_team.small_image_path,
    inicio_em: tsToIso(f.timestamp),
  };
}

export function fixtureToRow(f: FsFixture, fase = "grupos", rodada = ""): MatchRow {
  return {
    ...base(f),
    status: "agendado",
    placar_casa: null,
    placar_fora: null,
    decisao: "normal",
    placar_penaltis_casa: null,
    placar_penaltis_fora: null,
    fase,
    rodada,
  };
}

export function resultToRow(r: FsResult, fase = "grupos", rodada = ""): MatchRow {
  return {
    ...base(r),
    status: "finalizado",
    placar_casa: r.scores?.home ?? null,
    placar_fora: r.scores?.away ?? null,
    decisao: "normal",
    placar_penaltis_casa: null,
    placar_penaltis_fora: null,
    fase,
    rodada,
  };
}

export function decisaoFromStatus(status: FsMatchStatus): Decisao {
  if (status.is_finished_after_penalties) return "penaltis";
  if (status.is_finished_after_extra_time) return "prorrogacao";
  return "normal";
}

export function placar90Min(details: FsMatchDetails): {
  placar_casa: number;
  placar_fora: number;
  decisao: Decisao;
  placar_penaltis_casa: number | null;
  placar_penaltis_fora: number | null;
} {
  const decisao = decisaoFromStatus(details.match_status);
  const s = details.scores;
  return {
    placar_casa: s.home_1st_half + s.home_2nd_half,
    placar_fora: s.away_1st_half + s.away_2nd_half,
    decisao,
    placar_penaltis_casa: decisao === "penaltis" ? s.home_penalties : null,
    placar_penaltis_fora: decisao === "penaltis" ? s.away_penalties : null,
  };
}

const RODADAS_CONHECIDAS: Record<string, string> = {
  "1/16-finals": "dezesseis-avos",
  "1/8-finals": "oitavas",
  "1/4-finals": "quartas",
  "1/2-finals": "semifinal",
  "final": "final",
  "3rd place": "terceiro-lugar",
  "third place": "terceiro-lugar",
};

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function rodadaFromTournamentName(name: string): string {
  const partes = name.split(" - ");
  const ultimaParte = partes[partes.length - 1]?.trim() ?? "";
  const chave = ultimaParte.toLowerCase();
  return RODADAS_CONHECIDAS[chave] ?? slugify(ultimaParte);
}
