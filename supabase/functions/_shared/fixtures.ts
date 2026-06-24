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

export function fixtureToRow(f: FsFixture): MatchRow {
  return { ...base(f), status: "agendado", placar_casa: null, placar_fora: null };
}

export function resultToRow(r: FsResult): MatchRow {
  return {
    ...base(r),
    status: "finalizado",
    placar_casa: r.scores?.home ?? null,
    placar_fora: r.scores?.away ?? null,
  };
}
