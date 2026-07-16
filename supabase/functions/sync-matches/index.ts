import { createClient } from "@supabase/supabase-js";
import {
  fixtureToRow,
  resultToRow,
  placar90Min,
  resgateDeDetalhes,
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

// Erro de rate limit (HTTP 429). Não deve ser "retriado" num loop rápido — a quota já
// estourou; insistir só piora. Aborta a run inteira imediatamente.
class RateLimitError extends Error {
  constructor(public readonly path: string) {
    super(`FlashScore ${path} 429 (rate limit)`);
    this.name = "RateLimitError";
  }
}

async function withRetry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      // 429 não é transitório aqui: aborta sem gastar as demais tentativas.
      if (e instanceof RateLimitError) throw e;
      ultimoErro = e;
      if (i < tentativas - 1) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
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
      if (resp.status === 429) throw new RateLimitError(path);
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

// Competição ativa a sincronizar. `fs_tournament_url` vem da linha (fallback: secret legado).
type Competicao = {
  id: string;
  slug: string;
  fs_tournament_url: string | null;
  formato: "fases" | "pontos-corridos";
};

// IDs/stages do torneio não mudam durante a temporada. Cacheia em sync_cache para não bater em
// /tournaments/ids toda run (endpoint que estava tomando 429 e derrubando a sync inteira).
// A chave é prefixada por competição para não colidir entre torneios.
const CACHE_STAGES_KEY = "tournament_stages";
const CACHE_STAGES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// /tournaments/ids retorna ~19 stages, mas só interessam os da Copa 2026: grupos ("Main")
// e mata-mata ("Play Offs"). Os demais (First/Second/Third stage, Promotion, etc.) são de
// outras competições — ingeri-los polui `matches` e desperdiça chamadas à API.
const STAGES_RELEVANTES = new Set(["Main", "Play Offs"]);

// Refresh periódico: mesmo sem jogo na janela, roda a sync a cada 12h para ingerir jogos
// recém-cadastrados na API (ex.: fixtures da próxima fase do mata-mata em dias de folga).
const REFRESH_KEY = "ultimo_refresh";
const REFRESH_INTERVALO_MS = 12 * 60 * 60 * 1000; // 12h

async function descobrirStages(
  supabase: ReturnType<typeof createClient>,
  comp: Competicao
): Promise<TournamentIds> {
  const chaveCache = `${comp.id}:${CACHE_STAGES_KEY}`;
  const { data: cache } = await supabase
    .from("sync_cache")
    .select("valor, atualizado_em")
    .eq("chave", chaveCache)
    .maybeSingle();

  if (cache) {
    const idade = Date.now() - new Date(cache.atualizado_em as string).getTime();
    if (idade < CACHE_STAGES_TTL_MS) {
      return cache.valor as TournamentIds;
    }
  }

  // URL da competição; fallback para o secret legado (compat com a Copa pré-multi-competição).
  const url = comp.fs_tournament_url ?? Deno.env.get("FS_TOURNAMENT_URL");
  if (!url) {
    throw new Error(
      `fs_tournament_url ausente para competição ${comp.slug} (e secret FS_TOURNAMENT_URL não configurado)`
    );
  }
  const data = (await fsFetch(
    `/api/flashscore/v2/tournaments/ids?tournament_url=${encodeURIComponent(url)}`
  )) as TournamentIds;

  await supabase
    .from("sync_cache")
    .upsert(
      { chave: chaveCache, valor: data, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" }
    );

  return data;
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

type SyncResumo = { total: number; upserted: number; pulados_manual: number };

// Sincroniza uma competição: ingere fixtures/results, resolve placar de 90min nas transições
// para "finalizado" e resgata jogos "no limbo". Lança RateLimitError (429) ou Error em falha —
// quem chama decide como responder. Todo upsert carrega `competicao_id`.
async function syncCompeticao(
  supabase: ReturnType<typeof createClient>,
  comp: Competicao,
  agora: number
): Promise<SyncResumo> {
  const ids = await descobrirStages(supabase, comp);
  const porId = new Map<string, MatchRow>();

  // Copa (fases): só grupos ("Main") e mata-mata ("Play Offs"). Pontos-corridos: um único
  // stream de rodadas — não filtra por nome de stage.
  const stages =
    comp.formato === "fases"
      ? ids.tournament_stages.filter((s) => STAGES_RELEVANTES.has(s.name))
      : ids.tournament_stages;

  for (const stage of stages) {
    const fase =
      comp.formato === "fases"
        ? stage.name === "Main"
          ? "grupos"
          : "mata-mata"
        : "pontos-corridos";
    const [fixtures, results] = await Promise.all([
      fsGetLista("fixtures", ids.tournament_template_id, ids.season_id, stage.tournament_stage_id),
      fsGetLista("results", ids.tournament_template_id, ids.season_id, stage.tournament_stage_id),
    ]);
    for (const f of fixtures) {
      const ff = f as { match_id: string; timestamp: number };
      // rodada só é derivada por data na fase de grupos da Copa; nos demais formatos vem
      // depois (mata-mata via detalhes) ou fica vazia (pontos-corridos).
      const rodada = fase === "grupos" ? rodadaGrupos(ff.timestamp) : "";
      porId.set(ff.match_id, { ...fixtureToRow(f as never, fase, rodada), competicao_id: comp.id });
    }
    for (const r of results) {
      const rr = r as { match_id: string; timestamp: number };
      const rodada = fase === "grupos" ? rodadaGrupos(rr.timestamp) : "";
      porId.set(rr.match_id, { ...resultToRow(r as never, fase, rodada), competicao_id: comp.id });
    }
  }
  const rows = [...porId.values()];

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

  // Processa em lotes pequenos (evita estourar rate limit da RapidAPI quando
  // muitos jogos viram "finalizado" de uma vez, ex.: 1ª sincronização do mata-mata)
  const TAMANHO_LOTE = 5;
  for (let i = 0; i < transicoes.length; i += TAMANHO_LOTE) {
    const lote = transicoes.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map(async (r) => {
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
    if (i + TAMANHO_LOTE < transicoes.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (paraUpsert.length > 0) {
    const comTimestamp = paraUpsert.map((r) => ({ ...r, atualizado_em: new Date().toISOString() }));

    const { error } = await supabase
      .from("matches")
      .upsert(comTimestamp, { onConflict: "api_fixture_id" });

    if (error) {
      console.error(JSON.stringify({ evento: "sync_upsert_erro", mensagem: error.message }));
      throw new Error(error.message);
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

  // ── Resgate ativo de jogos "no limbo" ────────────────────────────────────────────────
  // A lista `results` do torneio atrasa horas para incluir um jogo recém-encerrado. Nesse
  // intervalo o jogo já saiu de `fixtures` mas ainda não entrou em `results` — fica invisível
  // para o fluxo normal e o placar nunca atualiza sozinho. Aqui pegamos os `agendado` cujo
  // horário já passou e que NÃO vieram em nenhuma das listas, e consultamos `matches/details`
  // diretamente (fonte que já tem o resultado na hora). Escopo: só desta competição.
  const idsNasListas = new Set(rows.map((r) => r.api_fixture_id));
  const RESGATE_APOS_MS = 100 * 60 * 1000; // ~100min após o início: 90min + intervalo + folga
  const limiteResgate = new Date(agora - RESGATE_APOS_MS).toISOString();

  const { data: candidatos } = await supabase
    .from("matches")
    .select("id, api_fixture_id, placar_casa, placar_fora, time_casa, time_fora, fase")
    .eq("competicao_id", comp.id)
    .eq("status", "agendado")
    .eq("placar_manual", false)
    .lt("inicio_em", limiteResgate)
    .order("inicio_em", { ascending: true });

  const paraResgatar = (candidatos ?? []).filter(
    (c) => !idsNasListas.has(c.api_fixture_id as string)
  );

  const LOTE_RESGATE = 5;
  for (let i = 0; i < paraResgatar.length; i += LOTE_RESGATE) {
    const lote = paraResgatar.slice(i, i + LOTE_RESGATE);
    await Promise.all(
      lote.map(async (c) => {
        try {
          const detalhes = await fsGetDetails(c.api_fixture_id as string);
          const resgate = resgateDeDetalhes(detalhes);
          if (!resgate) return; // ainda não terminou

          const rodada =
            c.fase === "mata-mata" && detalhes.tournament?.name
              ? rodadaFromTournamentName(detalhes.tournament.name)
              : undefined;

          const { error: upErr } = await supabase
            .from("matches")
            .update({
              status: "finalizado",
              placar_casa: resgate.placar_casa,
              placar_fora: resgate.placar_fora,
              decisao: resgate.decisao,
              placar_penaltis_casa: resgate.placar_penaltis_casa,
              placar_penaltis_fora: resgate.placar_penaltis_fora,
              ...(rodada !== undefined ? { rodada } : {}),
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", c.id as string);
          if (upErr) {
            console.error(
              JSON.stringify({ evento: "resgate_upsert_erro", api_fixture_id: c.api_fixture_id, mensagem: upErr.message })
            );
            return;
          }

          await supabase.from("audit_log").insert({
            user_id: null,
            acao: "sync_placar_resgate",
            tabela: "matches",
            registro_id: c.id,
            dados_anteriores: { placar_casa: c.placar_casa, placar_fora: c.placar_fora },
            dados_novos: {
              placar_casa: resgate.placar_casa,
              placar_fora: resgate.placar_fora,
              time_casa: c.time_casa,
              time_fora: c.time_fora,
            },
          });
        } catch (e) {
          console.error(
            JSON.stringify({
              evento: "resgate_details_erro",
              api_fixture_id: c.api_fixture_id,
              mensagem: e instanceof Error ? e.message : String(e),
            })
          );
        }
      })
    );
    if (i + LOTE_RESGATE < paraResgatar.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return {
    total: rows.length,
    upserted: paraUpsert.length,
    pulados_manual: rows.length - paraUpsert.length,
  };
}

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

  // Janela de jogo: só faz sentido bater na API quando há jogo relevante — algum começando
  // em breve, em andamento, ou já vencido mas ainda sem placar (`agendado` que já passou).
  // Fora disso, pula a run (economiza a maior parte das ~96 runs/dia e poupa a quota da API).
  const agora = Date.now();
  const JANELA_ANTES_MS = 2 * 60 * 60 * 1000; // 2h antes do início
  const JANELA_DEPOIS_MS = 4 * 60 * 60 * 1000; // até 4h depois (cobre prorrogação/atrasos)
  const inicioMin = new Date(agora - JANELA_DEPOIS_MS).toISOString();
  const inicioMax = new Date(agora + JANELA_ANTES_MS).toISOString();

  const { data: naJanela } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "agendado")
    .gte("inicio_em", inicioMin)
    .lte("inicio_em", inicioMax)
    .limit(1);

  const { data: vencidos } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "agendado")
    .lt("inicio_em", inicioMin)
    .limit(1);

  const temJogo = (naJanela?.length ?? 0) > 0;
  // `vencidos` (agendados que já começaram há mais de 4h e continuam sem placar) força a run
  // mesmo fora da janela, para recuperar jogos que a API demorou a mover para "results".
  const temPendente = (vencidos?.length ?? 0) > 0;

  // Refresh periódico: força a run se o último refresh completo foi há mais de 12h, para
  // ingerir jogos novos mesmo em dias sem partida na janela.
  const { data: refreshCache } = await supabase
    .from("sync_cache")
    .select("atualizado_em")
    .eq("chave", REFRESH_KEY)
    .maybeSingle();
  const deveRefrescar =
    !refreshCache ||
    agora - new Date(refreshCache.atualizado_em as string).getTime() > REFRESH_INTERVALO_MS;

  if (!temJogo && !temPendente && !deveRefrescar) {
    return new Response(JSON.stringify({ ok: true, pulado: "sem jogo na janela" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Itera as competições ativas em sequência (preserva o rate-limit atual — nada de
  // paralelismo entre torneios). Um 429 aborta a run inteira (quota é global na RapidAPI).
  const { data: competicoes, error: compErro } = await supabase
    .from("competicoes")
    .select("id, slug, fs_tournament_url, formato")
    .eq("ativa", true)
    .order("ordem");

  if (compErro) {
    console.error(JSON.stringify({ evento: "sync_competicoes_erro", mensagem: compErro.message }));
    return new Response(JSON.stringify({ ok: false, erro: compErro.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resumos: Record<string, SyncResumo> = {};
  for (const comp of (competicoes ?? []) as Competicao[]) {
    try {
      resumos[comp.slug] = await syncCompeticao(supabase, comp, agora);
    } catch (e) {
      // Rate limit: não é falha de código nem transitória. A quota é compartilhada entre
      // torneios, então aborta a run inteira; a próxima janela tenta de novo.
      if (e instanceof RateLimitError) {
        console.warn(JSON.stringify({ evento: "rate_limit", path: e.path, competicao: comp.slug }));
        return new Response(
          JSON.stringify({ ok: false, motivo: "429", path: e.path, competicao: comp.slug }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      const erro = {
        mensagem: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      };
      console.error(JSON.stringify({ evento: "sync_erro", competicao: comp.slug, ...erro }));
      return new Response(JSON.stringify({ ok: false, competicao: comp.slug, erro: erro.mensagem }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Marca o refresh completo (só no caminho de sucesso — 429/erro não chegam aqui).
  await supabase
    .from("sync_cache")
    .upsert(
      { chave: REFRESH_KEY, valor: {}, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" }
    );

  return new Response(JSON.stringify({ ok: true, competicoes: resumos }), {
    headers: { "Content-Type": "application/json" },
  });
});
