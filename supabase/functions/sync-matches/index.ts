import { createClient } from "@supabase/supabase-js";
import { fixtureToRow, resultToRow, type MatchRow } from "../_shared/fixtures.ts";

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

async function fsGet(path: string): Promise<unknown[]> {
  const host = Deno.env.get("RAPIDAPI_HOST") ?? "flashscore4.p.rapidapi.com";
  const template = Deno.env.get("FS_TEMPLATE_ID")!;
  const season = Deno.env.get("FS_SEASON_ID")!;
  const stage = Deno.env.get("FS_STAGE_ID")!;
  const url =
    `https://${host}/api/flashscore/v2/tournaments/${path}` +
    `?tournament_template_id=${template}&season_id=${season}&tournament_stage_id=${stage}`;

  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(url, {
        headers: {
          "x-rapidapi-host": host,
          "x-rapidapi-key": Deno.env.get("RAPIDAPI_KEY")!,
        },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`FlashScore ${path} ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } finally {
      clearTimeout(timer);
    }
  });
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

  const paraUpsert = rows
    .filter((r) => !idsManuais.has(r.api_fixture_id))
    .map((r) => ({ ...r, atualizado_em: new Date().toISOString() }));

  if (paraUpsert.length > 0) {
    const { error } = await supabase
      .from("matches")
      .upsert(paraUpsert, { onConflict: "api_fixture_id" });
    if (error) {
      console.error(JSON.stringify({ evento: "sync_upsert_erro", mensagem: error.message }));
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
