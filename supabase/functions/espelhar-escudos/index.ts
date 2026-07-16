import { createClient } from "@supabase/supabase-js";
import { espelharEscudo } from "../_shared/escudos.ts";

// Backfill: espelha no bucket `escudos` todos os escudos ainda apontando para a FlashScore
// (que responde 403 a hotlinks) e reescreve `matches.bandeira_casa/fora` para a URL própria.
// Idempotente: reexecutar só cuida do que ainda não foi espelhado.

Deno.serve(async (req) => {
  const segredo = req.headers.get("x-cron-secret");
  if (!segredo || segredo !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ ok: false, erro: "não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Coleta as URLs distintas ainda externas (não apontando para o nosso storage).
  const externas = new Set<string>();
  for (const col of ["bandeira_casa", "bandeira_fora"] as const) {
    const { data } = await supabase
      .from("matches")
      .select(col)
      .not(col, "is", null)
      .not(col, "like", "%/storage/v1/object/public/escudos/%");
    for (const row of data ?? []) {
      const v = (row as Record<string, string | null>)[col];
      if (v) externas.add(v);
    }
  }

  // Espelha cada uma e monta o mapa url_antiga -> url_nova.
  const cache = new Map<string, string>();
  const mapa = new Map<string, string>();
  for (const url of externas) {
    const nova = await espelharEscudo(supabase, supabaseUrl, url, cache);
    if (nova && nova !== url) mapa.set(url, nova);
  }

  // Reaponta as matches para as URLs novas.
  let atualizados = 0;
  for (const [antiga, nova] of mapa) {
    for (const col of ["bandeira_casa", "bandeira_fora"] as const) {
      const { count } = await supabase
        .from("matches")
        .update({ [col]: nova }, { count: "exact" })
        .eq(col, antiga);
      atualizados += count ?? 0;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      urls_externas: externas.size,
      espelhadas: mapa.size,
      celulas_atualizadas: atualizados,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
