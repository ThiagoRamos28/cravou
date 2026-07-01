import { createClient } from "@supabase/supabase-js";
import {
  fixtureToRow,
  resultToRow,
  placar90Min,
  rodadaFromTournamentName,
  type MatchRow,
  type FsMatchDetails,
} from "../_shared/fixtures.ts";

const BLOCOS_GRUPOS = [
  { rodada: "1", ate: "2026-06-18T00:00:00.000Z" },
  { rodada: "2", ate: "2026-06-24T00:00:00.000Z" },
  { rodada: "3", ate: "2026-07-01T00:00:00.000Z" },
];

function rodadaGrupos(tsSeconds: number): string {
  const t = tsSeconds * 1000;
  for (const b of BLOCOS_GRUPOS) {
    if (t < new Date(b.ate).getTime()) return b.rodada;
  }
  return "";
}

async function withRetry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      if (i < tentativas - 1) {
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
      }
    }
  }
  throw ultimoErro;
}

const HOST = Deno.env.get("RAPIDAPI_HOST") ?? "flashscore4.p.rapidapi.com";
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY")!;

async function fsFetch(path: string): Promise<unknown> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(`https://${HOST}${path}`, {
        headers: {
          "x-rapidapi-host": HOST,
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`FlashScore ${path} ${resp.status}`);
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  });
}

type TournamentStage = { tournament_stage_id: string; name: string };
type TournamentIds = {
  tournament_template_id: string;
  season_id: string;
  tournament_stages: TournamentStage[];
};

async function descobrirStages(): Promise<TournamentIds> {
  const url = Deno.env.get("FS_TOURNAMENT_URL");
  if (!url) {
    throw new Error("FS_TOURNAMENT_URL não configurado (secret ausente na Edge Function)");
  }
  const data = await fsFetch(
    `/api/flashscore/v2/tournaments/ids?tournament_url=${encodeURIComponent(url)}`
  );
  return data as TournamentIds;
}

async function fsGetLista(
  path: "fixtures" | "results",
  template: string,
  season: string,
  stage: string
): Promise<unknown[]> {
  const data = await fsFetch(
    `/api/flashscore/v2/tournaments/${path}` +
      `?tournament_template_id=${template}&season_id=${season}&tournament_stage_id=${stage}`
  );
  return Array.isArray(data) ? data : [];
}

async function fsGetDetails(matchId: string): Promise<FsMatchDetails> {
  const data = await fsFetch(`/api/flashscore/v2/matches/details?match_id=${matchId}`);
  return data as FsMatchDetails;
}

Deno.serve(async (req) => {
  const segredo = req.headers.get("x-cron-secret");
  if (!segredo || segredo !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ ok: false, erro: "não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let rows: MatchRow[];
  try {
    const ids = await descobrirStages();
    const porId = new Map<string, MatchRow>();

    for (const stage of ids.tournament_stages) {
      const fase = stage.name === "Main" ? "grupos" : "mata-mata";
      const [fixtures, results] = await Promise.all([
        fsGetLista("fixtures", ids.tournament_template_id, ids.season_id, stage.tournament_stage_id),
        fsGetLista("results", ids.tournament_template_id, ids.season_id, stage.tournament_stage_id),
      ]);
      for (const f of fixtures) {
        const ff = f as { match_id: string; timestamp: number };
        const rodada = fase === "grupos" ? rodadaGrupos(ff.timestamp) : "";
        porId.set(ff.match_id, fixtureToRow(f as never, fase, rodada));
      }
      for (const r of results) {
        const rr = r as { match_id: string; timestamp: number };
        const rodada = fase === "grupos" ? rodadaGrupos(rr.timestamp) : "";
        porId.set(rr.match_id, resultToRow(r as never, fase, rodada));
      }
    }
    rows = [...porId.values()];
  } catch (e) {
    const erro = {
      mensagem: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
    console.error(JSON.stringify({ evento: "sync_erro", ...erro }));
    return new Response(JSON.stringify({ ok: false, erro: erro.mensagem }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: manuais } = await supabase
    .from("matches")
    .select("api_fixture_id")
    .eq("placar_manual", true);
  const idsManuais = new Set((manuais ?? []).map((m) => m.api_fixture_id));

  const paraUpsert = rows.filter((r) => !idsManuais.has(r.api_fixture_id));

  const apiIds = paraUpsert.map((r) => r.api_fixture_id);
  const { data: existentes } = await supabase
    .from("matches")
    .select("id, api_fixture_id, placar_casa, placar_fora, status, time_casa, time_fora")
    .in("api_fixture_id", apiIds.length > 0 ? apiIds : ["__nenhum__"]);

  const mapaExistentes = new Map(
    (existentes ?? []).map((m) => [
      m.api_fixture_id as string,
      {
        id: m.id as string,
        placar_casa: m.placar_casa as number | null,
        placar_fora: m.placar_fora as number | null,
        status: m.status as string,
        time_casa: m.time_casa as string,
        time_fora: m.time_fora as string,
      },
    ])
  );

  // Para jogos que viram "finalizado" pela 1ª vez, busca o detalhe (placar 90min real)
  const transicoes = paraUpsert.filter((r) => {
    if (r.status !== "finalizado") return false;
    const ex = mapaExistentes.get(r.api_fixture_id);
    return !ex || ex.status !== "finalizado";
  });

  await Promise.all(
    transicoes.map(async (r) => {
      try {
        const detalhes = await fsGetDetails(r.api_fixture_id);
        const calculado = placar90Min(detalhes);
        r.placar_casa = calculado.placar_casa;
        r.placar_fora = calculado.placar_fora;
        r.decisao = calculado.decisao;
        r.placar_penaltis_casa = calculado.placar_penaltis_casa;
        r.placar_penaltis_fora = calculado.placar_penaltis_fora;
        if (r.fase === "mata-mata" && detalhes.tournament?.name) {
          r.rodada = rodadaFromTournamentName(detalhes.tournament.name);
        }
      } catch (e) {
        console.error(
          JSON.stringify({
            evento: "match_details_erro",
            api_fixture_id: r.api_fixture_id,
            mensagem: e instanceof Error ? e.message : String(e),
          })
        );
      }
    })
  );

  if (paraUpsert.length > 0) {
    const comTimestamp = paraUpsert.map((r) => ({ ...r, atualizado_em: new Date().toISOString() }));

    const { error } = await supabase
      .from("matches")
      .upsert(comTimestamp, { onConflict: "api_fixture_id" });

    if (error) {
      console.error(JSON.stringify({ evento: "sync_upsert_erro", mensagem: error.message }));
      return new Response(JSON.stringify({ ok: false, erro: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mudancas = comTimestamp
      .filter((r) => {
        const ex = mapaExistentes.get(r.api_fixture_id);
        if (!ex) return false;
        return (
          r.placar_casa != null &&
          r.placar_fora != null &&
          (ex.placar_casa !== r.placar_casa || ex.placar_fora !== r.placar_fora)
        );
      })
      .map((r) => {
        const ex = mapaExistentes.get(r.api_fixture_id)!;
        return {
          match_id: ex.id,
          time_casa: r.time_casa ?? ex.time_casa,
          time_fora: r.time_fora ?? ex.time_fora,
          anterior_casa: ex.placar_casa,
          anterior_fora: ex.placar_fora,
          novo_casa: r.placar_casa,
          novo_fora: r.placar_fora,
        };
      });

    if (mudancas.length > 0) {
      const { error: auditError } = await supabase.from("audit_log").insert(
        mudancas.map((m) => ({
          user_id: null,
          acao: "sync_placar_auto",
          tabela: "matches",
          registro_id: m.match_id,
          dados_anteriores: {
            placar_casa: m.anterior_casa,
            placar_fora: m.anterior_fora,
          },
          dados_novos: {
            placar_casa: m.novo_casa,
            placar_fora: m.novo_fora,
            time_casa: m.time_casa,
            time_fora: m.time_fora,
          },
        }))
      );
      if (auditError) {
        console.error(JSON.stringify({ evento: "audit_log_erro", mensagem: auditError.message }));
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      total: rows.length,
      upserted: paraUpsert.length,
      pulados_manual: rows.length - paraUpsert.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
