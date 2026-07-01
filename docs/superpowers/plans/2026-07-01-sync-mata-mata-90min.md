# Sincronização de mata-mata e placar de 90 minutos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o `sync-matches` descobrir dinamicamente todos os stages do torneio (corrigindo o bug de só sincronizar 1 de 4 grupos e nenhum mata-mata) e gravar sempre o placar dos 90 minutos (ignorando prorrogação), eliminando a necessidade de correção manual do placar em jogos que vão à prorrogação/pênaltis.

**Architecture:** `_shared/fixtures.ts` ganha funções puras para calcular o placar de 90min e a decisão (normal/prorrogação/pênaltis) a partir do payload de `matches/details`, e para mapear o nome da fase de mata-mata (`tournament.name`) num rótulo pt-BR de rodada. `sync-matches/index.ts` passa a: (1) descobrir stages via `tournaments/ids`, (2) iterar fixtures/results de cada stage, (3) para qualquer jogo que transiciona para `finalizado` pela primeira vez, buscar `matches/details` e sobrescrever placar/decisão/fase/rodada antes do upsert.

**Tech Stack:** Deno (Supabase Edge Functions), TypeScript, Vitest.

## Global Constraints

- Pontuação sempre considera o placar dos 90 minutos, desconsiderando prorrogação (regra de negócio documentada em `CLAUDE.md`).
- Segredos (API keys) só em Edge Functions, nunca no client (`CLAUDE.md`).
- TDD: teste primeiro, ver falhar, implementar, ver passar, commit por unidade (`CLAUDE.md`).
- Mensagens de commit terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Tipos e cálculo do placar de 90 minutos em `_shared/fixtures.ts`

**Files:**
- Modify: `supabase/functions/_shared/fixtures.ts`
- Test: `supabase/functions/_shared/__tests__/fixtures.test.ts`

**Interfaces:**
- Produces: `type Decisao = "normal" | "prorrogacao" | "penaltis"`; `type FsMatchStatus = { is_finished_after_extra_time: boolean; is_finished_after_penalties: boolean }`; `type FsDetailsScores = { home: number; away: number; home_1st_half: number; away_1st_half: number; home_2nd_half: number; away_2nd_half: number; home_extra_time: number; away_extra_time: number; home_penalties: number | null; away_penalties: number | null }`; `type FsMatchDetails = { match_id: string; scores: FsDetailsScores; match_status: FsMatchStatus; tournament?: { name: string } }`; `function decisaoFromStatus(status: FsMatchStatus): Decisao`; `function placar90Min(details: FsMatchDetails): { placar_casa: number; placar_fora: number; decisao: Decisao; placar_penaltis_casa: number | null; placar_penaltis_fora: number | null }`; `function rodadaFromTournamentName(name: string): string`
- `MatchRow` ganha os campos `decisao: "normal" | "prorrogacao" | "penaltis"` e `placar_penaltis_casa: number | null`, `placar_penaltis_fora: number | null`.
- `fixtureToRow` e `resultToRow` passam a incluir `decisao: "normal"`, `placar_penaltis_casa: null`, `placar_penaltis_fora: null` por padrão (serão sobrescritos depois quando aplicável).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `supabase/functions/_shared/__tests__/fixtures.test.ts`:

```typescript
import {
  decisaoFromStatus,
  placar90Min,
  rodadaFromTournamentName,
  type FsMatchDetails,
} from "../fixtures";

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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- fixtures.test.ts`
Expected: FAIL — `decisaoFromStatus`, `placar90Min`, `rodadaFromTournamentName` não existem ainda.

- [ ] **Step 3: Implementar em `supabase/functions/_shared/fixtures.ts`**

Adicionar ao arquivo (mantendo o conteúdo existente):

```typescript
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
```

Também atualizar `MatchRow`, `fixtureToRow` e `resultToRow` no mesmo arquivo:

```typescript
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
```

```typescript
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
```

Isso vai quebrar os testes existentes de `fixtureToRow`/`resultToRow` que usam `toEqual` (Step 1 do arquivo já existente) — atualizar os dois `toEqual` em `fixtures.test.ts` (linhas ~20-32 e a asserção de `resultToRow`) para incluir os três novos campos:

```typescript
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
```

(O teste de `resultToRow` usa asserções pontuais com `expect(row.placar_casa).toBe(2)` etc., não precisa mudar.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- fixtures.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os novos e os existentes atualizados)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/__tests__/fixtures.test.ts
git commit -m "$(cat <<'EOF'
feat: calcular placar de 90min e decisao a partir de matches/details

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration — colunas `decisao`, `placar_penaltis_casa`, `placar_penaltis_fora`

**Files:**
- Create: `supabase/migrations/0014_decisao_partida.sql`

**Interfaces:**
- Consumes: tabela `public.matches` existente (`supabase/migrations/0002_matches.sql`).
- Produces: colunas `matches.decisao text` (`'normal'|'prorrogacao'|'penaltis'`, default `'normal'`), `matches.placar_penaltis_casa int`, `matches.placar_penaltis_fora int`, usadas pelo `sync-matches` (Task 4) e disponíveis para UI futura.

- [ ] **Step 1: Escrever a migration**

```sql
alter table public.matches
  add column decisao text not null default 'normal'
    check (decisao in ('normal', 'prorrogacao', 'penaltis')),
  add column placar_penaltis_casa int,
  add column placar_penaltis_fora int;
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase**

Usar a ferramenta MCP `mcp__supabase-cravou__apply_migration` com `name: "decisao_partida"` e o SQL acima (ou `supabase db push` caso o CLI local esteja configurado). Confirmar que não há erro de aplicação.

- [ ] **Step 3: Verificar a coluna no banco**

Rodar via `mcp__supabase-cravou__execute_sql`:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'matches' and column_name in ('decisao', 'placar_penaltis_casa', 'placar_penaltis_fora');
```

Expected: 3 linhas retornadas, `decisao` com `column_default` `'normal'::text`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_decisao_partida.sql
git commit -m "$(cat <<'EOF'
feat: adiciona decisao e placar de penaltis em matches

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Descoberta dinâmica de stages e placar de 90min em `sync-matches`

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: `fixtureToRow`, `resultToRow`, `placar90Min`, `rodadaFromTournamentName`, `type MatchRow`, `type FsMatchDetails` de `../_shared/fixtures.ts` (Task 1).
- Produces: comportamento do endpoint HTTP da função (mesmo contrato de resposta JSON `{ ok, total, upserted, pulados_manual }`), agora cobrindo todos os stages do torneio e com placar de 90min correto.
- Secrets novos: `FS_TOURNAMENT_URL` (substitui `FS_TEMPLATE_ID`, `FS_SEASON_ID`, `FS_STAGE_ID`, que deixam de ser lidos).

Este arquivo não tem testes automatizados hoje (é uma Edge Function que fala com APIs externas e o Supabase real) — a verificação será manual, invocando a função via HTTP após o deploy, igual ao processo já feito na investigação anterior. Por isso este task não segue TDD com testes automatizados; a verificação está no Step 5.

- [ ] **Step 1: Reescrever `supabase/functions/sync-matches/index.ts`**

```typescript
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
  const url = Deno.env.get("FS_TOURNAMENT_URL")!;
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
```

- [ ] **Step 2: Deploy da função atualizada**

Usar `mcp__supabase-cravou__deploy_edge_function` com `name: "sync-matches"`, `entrypoint_path: "index.ts"`, `verify_jwt: false` (mantém o comportamento atual — a função já se autentica via header `x-cron-secret`, não via JWT do Supabase; confirmar esse valor com `mcp__supabase-cravou__get_edge_function` antes do deploy para não mudar o `verify_jwt` existente), enviando o conteúdo de `supabase/functions/sync-matches/index.ts` e `supabase/functions/sync-matches/deno.json`.

- [ ] **Step 3: Configurar o novo secret `FS_TOURNAMENT_URL`**

No painel do Supabase (Project Settings → Edge Functions → Secrets), adicionar:
```
FS_TOURNAMENT_URL=/football/world/world-cup/
```
Os secrets antigos `FS_TEMPLATE_ID`, `FS_SEASON_ID`, `FS_STAGE_ID` podem ser removidos depois de confirmar que o novo fluxo funciona (Step 4).

- [ ] **Step 4: Rodar manualmente e verificar**

Invocar a função com o `CRON_SECRET` real (pegar no painel do Supabase):
```bash
curl -s -X POST "https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches" \
  -H "x-cron-secret: <CRON_SECRET_REAL>"
```
Expected: resposta `{"ok":true,"total":<N>,"upserted":<N>,"pulados_manual":0}` com `total` maior que antes (agora cobre grupos + mata-mata).

Depois, checar no banco que o jogo Holanda x Marrocos (ou outro jogo de mata-mata já finalizado) foi sincronizado com o placar correto:
```sql
select time_casa, time_fora, placar_casa, placar_fora, decisao, placar_penaltis_casa, placar_penaltis_fora, fase, rodada
from matches
where time_casa ilike '%etherland%' or time_fora ilike '%etherland%';
```
Expected: uma linha com `placar_casa = 1`, `placar_fora = 1`, `decisao = 'penaltis'`, `placar_penaltis_casa = 2`, `placar_penaltis_fora = 3`, `fase = 'mata-mata'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "$(cat <<'EOF'
feat: descobre stages dinamicamente e calcula placar de 90min no sync

Corrige sync que só cobria 1 de 4 stages de grupo e nenhum stage de
mata-mata. Jogos que terminam na prorrogacao/penaltis agora gravam o
placar dos 90 minutos automaticamente, sem precisar de correcao manual.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Atualizar textos de `/regras` e `CLAUDE.md` (correção manual deixa de ser necessária)

**Files:**
- Modify: `src/app/regras/page.tsx`
- Modify: `CLAUDE.md`
- Test: `src/components/**/__tests__` não aplicável (página sem teste dedicado hoje; verificação visual manual no Step 3)

**Interfaces:**
- Nenhuma interface nova — só texto.

- [ ] **Step 1: Atualizar o card em `src/app/regras/page.tsx`**

Trocar o bloco adicionado anteriormente:

```tsx
        <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Jogos com prorrogação</p>
          <p>
            Na fase de mata-mata, a pontuação considera apenas o placar dos{" "}
            <strong>90 minutos</strong> (tempo normal). Gols marcados na
            prorrogação não contam para o palpite.
          </p>
        </div>
```

Manter o texto (a regra continua verdadeira), sem menção a correção manual — já não há necessidade de tocar aqui, o texto atual já está correto. **Nenhuma mudança de código necessária neste arquivo** caso a leitura confirme isso (ver Step 2).

- [ ] **Step 2: Revisar e atualizar `CLAUDE.md`**

Trocar o parágrafo:

```markdown
- **Fase mata-mata (jogos com possível prorrogação):** a pontuação sempre considera o placar dos **90 minutos** (tempo normal), desconsiderando gols da prorrogação. A sincronização automática (FlashScore API) não distingue tempo normal de prorrogação no placar retornado — jogos que forem à prorrogação exigem correção manual do placar (via `placar_manual`) para refletir só o resultado dos 90 minutos.
```

por:

```markdown
- **Fase mata-mata (jogos com possível prorrogação):** a pontuação sempre considera o placar dos **90 minutos** (tempo normal), desconsiderando gols da prorrogação. A sincronização automática (`supabase/functions/sync-matches`) calcula isso sozinha a partir do endpoint `matches/details` da FlashScore API (soma `1st_half + 2nd_half`), gravando também `matches.decisao` (`'normal' | 'prorrogacao' | 'penaltis'`) e o placar de pênaltis quando aplicável — não é mais necessária correção manual nesses casos.
```

- [ ] **Step 3: Verificação visual**

Rodar `npm run dev`, abrir `http://localhost:3000/regras` e conferir que o card "Jogos com prorrogação" renderiza normalmente em light e dark (toggle no header).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: remove necessidade de correcao manual do placar em prorrogacao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Cobertura do spec:** descoberta dinâmica de stages (Task 3), placar 90min via `matches/details` (Tasks 1 e 3), campo `decisao`/pênaltis informativo (Tasks 1, 2, 3), fase/rodada de mata-mata (Tasks 1, 3), fallback quando `matches/details` falha (Task 3, `try/catch` mantém `resultToRow` original), remoção da exigência de correção manual na doc (Task 4). UI de exibição do placar de pênaltis nos cards fica fora de escopo (spec marcou como nice-to-have) — nenhum task cobre isso, conforme decidido.
- **Placeholders:** nenhum "TBD"/"implementar depois" — todo código está completo em cada step.
- **Consistência de tipos:** `MatchRow`/`FsMatchDetails`/`Decisao` definidos na Task 1 são usados com os mesmos nomes em `sync-matches/index.ts` (Task 3): `placar90Min`, `rodadaFromTournamentName`, `decisao`, `placar_penaltis_casa`, `placar_penaltis_fora`.
