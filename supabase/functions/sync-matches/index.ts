import { createClient } from "@supabase/supabase-js";
import { fixtureToRow, resultToRow, type MatchRow } from "../_shared/fixtures.ts";

// A API não expõe rodada; derivamos a rodada da fase de grupos por blocos de
// data (fim exclusivo). Calculado na própria sync para sobreviver a re-syncs.
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

async function fsGet(path: string): Promise<unknown[]> {
  const host = Deno.env.get("RAPIDAPI_HOST") ?? "flashscore4.p.rapidapi.com";
  const template = Deno.env.get("FS_TEMPLATE_ID")!;
  const season = Deno.env.get("FS_SEASON_ID")!;
  const stage = Deno.env.get("FS_STAGE_ID")!;
  const url =
    `https://${host}/api/flashscore/v2/tournaments/${path}` +
    `?tournament_template_id=${template}&season_id=${season}&tournament_stage_id=${stage}`;
  const resp = await fetch(url, {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": Deno.env.get("RAPIDAPI_KEY")!,
    },
  });
  if (!resp.ok) throw new Error(`FlashScore ${path} ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
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
    const [fixtures, results] = await Promise.all([
      fsGet("fixtures"),
      fsGet("results"),
    ]);
    // results sobrescrevem fixtures para o mesmo match_id (têm placar final)
    const porId = new Map<string, MatchRow>();
    for (const f of fixtures) {
      const ff = f as { match_id: string; timestamp: number };
      porId.set(ff.match_id, fixtureToRow(f as never, "grupos", rodadaGrupos(ff.timestamp)));
    }
    for (const r of results) {
      const rr = r as { match_id: string; timestamp: number };
      porId.set(rr.match_id, resultToRow(r as never, "grupos", rodadaGrupos(rr.timestamp)));
    }
    rows = [...porId.values()];
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: String(e) }), {
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

  const paraUpsert = rows
    .filter((r) => !idsManuais.has(r.api_fixture_id))
    .map((r) => ({ ...r, atualizado_em: new Date().toISOString() }));

  if (paraUpsert.length > 0) {
    const { error } = await supabase
      .from("matches")
      .upsert(paraUpsert, { onConflict: "api_fixture_id" });
    if (error) {
      return new Response(JSON.stringify({ ok: false, erro: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
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
