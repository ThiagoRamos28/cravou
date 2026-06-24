# Cravou! — Fase 2: Ingestão de Jogos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer os jogos da Copa 2026 (e seus placares) da API do FlashScore (via RapidAPI) para o banco automaticamente via cron, exibi-los numa página `/jogos`, com fallback manual de placar pelo admin.

**Architecture:** Uma Edge Function `sync-matches` (Deno) busca os endpoints `fixtures` (próximos) e `results` (encerrados) do FlashScore, mapeia para linhas da tabela `matches` e faz upsert via service role, pulando jogos que o admin corrigiu manualmente (`placar_manual`). `pg_cron` chama a função em intervalo, autenticada por header `x-cron-secret`. A app Next.js lê `matches` numa página `/jogos`, e um painel `/admin` (gating `is_admin`) corrige placar e dispara a sync.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS + Edge Functions + pg_cron + pg_net), Deno (Edge Function), FlashScore API via RapidAPI, Vitest.

## Global Constraints

- Nome exibido: **Cravou!** (com ponto de exclamação). UI em Português do Brasil.
- ⚠️ Next.js 16: convenção `proxy` (não middleware). `cookies()` é assíncrono.
- Segredos nunca no client. `RAPIDAPI_KEY`, `CRON_SECRET` e o service role vivem só na Edge Function / secrets do Supabase (ou env server na Vercel). Ao browser, só `NEXT_PUBLIC_*`.
- **Fonte: FlashScore via RapidAPI** — host `flashscore4.p.rapidapi.com`, base `https://flashscore4.p.rapidapi.com/api/flashscore/v2`, headers `x-rapidapi-key` + `x-rapidapi-host`.
- **Identificadores da Copa 2026** (descobertos via `GET /tournaments/ids?tournament_url=%2Ffootball%2Fworld%2Fworld-cup%2F`): `tournament_template_id=lvUBR5F8`, `season_id=185`, `tournament_stage_id=SbLsX4y7`. Ficam como secrets da função (ajustáveis sem redeploy).
- `match_id` do FlashScore é **string** → coluna `api_fixture_id` é **TEXT**.
- Status interno: `agendado` | `ao_vivo` | `finalizado`. Nesta fonte: `fixtures`→`agendado`, `results`→`finalizado` (ao_vivo fica para refino futuro).
- A API não fornece fase/rodada nesses endpoints → colunas `fase`/`rodada` ficam com default (`grupos`/``), refináveis depois pelo admin.
- Pontuação dos palpites é da Fase 4 — **não** calcular pontos aqui.
- Reusar o design system (`Button`/`buttonVariants`, tokens, `lucide-react`); dark E light.
- Commits: um por task; mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### Formato real observado da API (referência)

`GET /tournaments/fixtures?tournament_template_id=lvUBR5F8&season_id=185&tournament_stage_id=SbLsX4y7` → **array** de:
```json
{ "match_id": "jRyHEZGP", "timestamp": 1782327600,
  "home_team": { "team_id": "fqe7WYTr", "name": "Bosnia & Herzegovina", "small_image_path": "https://.../x.png" },
  "away_team": { "team_id": "zqzHL77i", "name": "Qatar", "small_image_path": "https://.../y.png" } }
```
`GET /tournaments/results?...` → **array** igual, porém com `"scores": { "home": 1, "away": 0 }`.

---

### Task 1: Migração — tabela `matches` + RLS

**Files:**
- Create: `supabase/migrations/0002_matches.sql`

**Interfaces:**
- Consumes: tabela `profiles` (coluna `is_admin`) da Fase 1.
- Produces: tabela `public.matches` com `api_fixture_id text unique`; RLS (leitura para autenticados; escrita só admins — o service role ignora RLS).

- [ ] **Step 1: Escrever a migração**

Create `supabase/migrations/0002_matches.sql`:

```sql
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id text unique,
  fase text not null default 'grupos',
  rodada text not null default '',
  time_casa text not null,
  time_fora text not null,
  bandeira_casa text,
  bandeira_fora text,
  inicio_em timestamptz not null,
  status text not null default 'agendado'
    check (status in ('agendado','ao_vivo','finalizado')),
  placar_casa int,
  placar_fora int,
  placar_manual boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create index if not exists matches_inicio_em_idx on public.matches (inicio_em);

alter table public.matches enable row level security;

create policy "matches_select_authenticated"
  on public.matches for select
  to authenticated
  using (true);

create policy "matches_insert_admin"
  on public.matches for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ));

create policy "matches_update_admin"
  on public.matches for update
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ));
```

- [ ] **Step 2: Aplicar e verificar** (controlador aplica via API/MCP do Supabase; sem ação local de banco)

```sql
select count(*) tabela from information_schema.tables
  where table_schema='public' and table_name='matches';
select count(*) policies from pg_policies
  where schemaname='public' and tablename='matches';
```
Expected: `tabela=1`, `policies=3`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_matches.sql
git commit -m "feat: migracao matches (api_fixture_id text) com RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Módulo de mapeamento de jogos (puro) + testes

**Files:**
- Create: `supabase/functions/_shared/fixtures.ts`
- Create: `supabase/functions/_shared/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: nada (TypeScript puro, sem imports de Deno — testável pelo Vitest).
- Produces:
  - `type FsTeam = { team_id: string; name: string; small_image_path: string | null }`
  - `type FsFixture = { match_id: string; timestamp: number; home_team: FsTeam; away_team: FsTeam }`
  - `type FsResult = FsFixture & { scores: { home: number | null; away: number | null } }`
  - `type MatchRow = { api_fixture_id: string; time_casa: string; time_fora: string; bandeira_casa: string | null; bandeira_fora: string | null; inicio_em: string; status: "agendado"|"finalizado"; placar_casa: number | null; placar_fora: number | null }`
  - `tsToIso(ts: number): string`
  - `fixtureToRow(f: FsFixture): MatchRow`
  - `resultToRow(r: FsResult): MatchRow`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `supabase/functions/_shared/__tests__/fixtures.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- fixtures`
Expected: FAIL — `../fixtures` não existe.

- [ ] **Step 3: Implementar o módulo**

Create `supabase/functions/_shared/fixtures.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- fixtures`
Expected: PASS (3 blocos).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/__tests__/fixtures.test.ts
git commit -m "feat: mapeamento puro de jogos do FlashScore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Edge Function `sync-matches`

**Files:**
- Create: `supabase/functions/sync-matches/index.ts`
- Create: `supabase/functions/sync-matches/deno.json`

**Interfaces:**
- Consumes: `fixtureToRow`, `resultToRow`, `MatchRow` de `../_shared/fixtures.ts`; secrets `RAPIDAPI_KEY`, `RAPIDAPI_HOST`, `FS_TEMPLATE_ID`, `FS_SEASON_ID`, `FS_STAGE_ID`, `CRON_SECRET`; env auto `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: endpoint HTTP que, autenticado por `x-cron-secret`, busca fixtures+results, faz upsert em `matches` (pulando `placar_manual`), e retorna `{ ok, total, upserted, pulados_manual }`.

- [ ] **Step 1: Config do Deno**

Create `supabase/functions/sync-matches/deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Implementar a função**

Create `supabase/functions/sync-matches/index.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { fixtureToRow, resultToRow, type MatchRow } from "../_shared/fixtures.ts";

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
    for (const f of fixtures) porId.set((f as { match_id: string }).match_id, fixtureToRow(f as never));
    for (const r of results) porId.set((r as { match_id: string }).match_id, resultToRow(r as never));
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
```

- [ ] **Step 3: Conferir os testes do módulo compartilhado**

Run: `npm test -- fixtures`
Expected: PASS (a função usa `fixtureToRow`/`resultToRow`, já cobertos; o handler é verificado na Task 4 contra a API e o banco reais).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-matches/
git commit -m "feat: edge function sync-matches (FlashScore -> matches)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deploy da função + secrets + sync inicial (checkpoint)

**Files:** nenhum arquivo de código (deploy + secrets via Supabase CLI/MCP, com o controlador).

**Interfaces:**
- Consumes: função (Task 3) + tabela (Task 1). Chave RapidAPI já fornecida; identificadores do torneio já validados (a API retornou jogos reais de 2026).
- Produces: função publicada, secrets configurados, `matches` populada.

- [ ] **Step 1: Definir secrets**

```bash
supabase secrets set \
  RAPIDAPI_KEY=<chave-rapidapi> \
  RAPIDAPI_HOST=flashscore4.p.rapidapi.com \
  FS_TEMPLATE_ID=lvUBR5F8 \
  FS_SEASON_ID=185 \
  FS_STAGE_ID=SbLsX4y7 \
  CRON_SECRET=<segredo-gerado> \
  --project-ref xyfuxtlnjapsptqufgah
```

- [ ] **Step 2: Deploy (sem verificação de JWT — a auth é o `x-cron-secret`)**

```bash
supabase functions deploy sync-matches --no-verify-jwt --project-ref xyfuxtlnjapsptqufgah
```

- [ ] **Step 3: Invocar e verificar**

```bash
curl -s -X POST "https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches" \
  -H "x-cron-secret: <segredo-gerado>"
```
Expected: `{ ok: true, total: N, upserted: N, pulados_manual: 0 }`, N > 0.
No banco: `select count(*), min(inicio_em), max(inicio_em) from public.matches;` → contagem > 0, datas em 2026.

- [ ] **Step 4: Sem commit** (infra). Registrar no ledger que a função está publicada (sem expor o segredo).

---

### Task 5: Agendamento com pg_cron

**Files:**
- Create: `supabase/migrations/0003_cron_sync_matches.sql`

**Interfaces:**
- Consumes: função publicada (Task 4) + `CRON_SECRET`.
- Produces: job `pg_cron` que chama `sync-matches` a cada 15 minutos via `pg_net`.

- [ ] **Step 1: Migração de cron** (substituir `<SEGREDO>` pelo `CRON_SECRET` ao aplicar)

Create `supabase/migrations/0003_cron_sync_matches.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sync-matches')
  where exists (select 1 from cron.job where jobname = 'sync-matches');

select cron.schedule(
  'sync-matches',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<SEGREDO>'
    )
  );
  $$
);
```

- [ ] **Step 2: Aplicar** (controlador, via API/MCP) e verificar:

```sql
select jobname, schedule, active from cron.job where jobname = 'sync-matches';
```
Expected: 1 linha, `schedule='*/15 * * * *'`, `active=true`.

- [ ] **Step 3: Confirmar execução** (após até 15 min, ou via invocação manual da Task 4): `select max(atualizado_em) from public.matches;` recente.

- [ ] **Step 4: Commit** (trocar o segredo real por `'<CRON_SECRET>'` no arquivo versionado — NÃO commitar o segredo real):

```bash
git add supabase/migrations/0003_cron_sync_matches.sql
git commit -m "feat: pg_cron agenda sync-matches a cada 15min

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Página `/jogos` (somente leitura)

**Files:**
- Create: `src/lib/matches.ts`
- Create: `src/components/jogos/match-card.tsx`
- Create: `src/components/jogos/__tests__/match-card.test.tsx`
- Create: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `createClient` server; `getSessao` (Fase 1); design system.
- Produces:
  - `type Match = { id: string; fase: string; rodada: string; time_casa: string; time_fora: string; bandeira_casa: string | null; bandeira_fora: string | null; inicio_em: string; status: "agendado"|"ao_vivo"|"finalizado"; placar_casa: number | null; placar_fora: number | null }`
  - `listarJogos(): Promise<Match[]>` (ordenado por `inicio_em`)
  - `<MatchCard match={Match} />`

- [ ] **Step 1: Escrever o teste do MatchCard (falhando)**

Create `src/components/jogos/__tests__/match-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "@/components/jogos/match-card";
import type { Match } from "@/lib/matches";

const base: Match = {
  id: "1",
  fase: "grupos",
  rodada: "1",
  time_casa: "Brasil",
  time_fora: "Sérvia",
  bandeira_casa: null,
  bandeira_fora: null,
  inicio_em: "2026-06-20T19:00:00+00:00",
  status: "agendado",
  placar_casa: null,
  placar_fora: null,
};

describe("MatchCard", () => {
  it("mostra os dois times", () => {
    render(<MatchCard match={base} />);
    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText("Sérvia")).toBeInTheDocument();
  });

  it("mostra o placar quando finalizado", () => {
    render(
      <MatchCard match={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 0 }} />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- match-card`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar o tipo + leitura**

Create `src/lib/matches.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type Match = {
  id: string;
  fase: string;
  rodada: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  inicio_em: string;
  status: "agendado" | "ao_vivo" | "finalizado";
  placar_casa: number | null;
  placar_fora: number | null;
};

export async function listarJogos(): Promise<Match[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select(
        "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora"
      )
      .order("inicio_em", { ascending: true });
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Implementar o MatchCard**

Create `src/components/jogos/match-card.tsx`:

```tsx
import type { Match } from "@/lib/matches";

function Time({ nome, bandeira }: { nome: string; bandeira: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {bandeira ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bandeira} alt="" width={24} height={24} className="h-6 w-6 rounded-full bg-muted object-cover" />
      ) : (
        <span className="h-6 w-6 rounded-full bg-muted" aria-hidden="true" />
      )}
      <span className="font-medium">{nome}</span>
    </div>
  );
}

const STATUS_LABEL: Record<Match["status"], string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  finalizado: "Encerrado",
};

export function MatchCard({ match }: { match: Match }) {
  const finalizado = match.status === "finalizado";
  const hora = new Date(match.inicio_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hora}</span>
        <span className={match.status === "ao_vivo" ? "font-semibold text-accent" : ""}>
          {STATUS_LABEL[match.status]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Time nome={match.time_casa} bandeira={match.bandeira_casa} />
        <div className="font-display text-xl font-bold tabular-nums">
          {finalizado ? (
            <span>
              <span>{match.placar_casa}</span>
              <span className="mx-1 text-muted-foreground">×</span>
              <span>{match.placar_fora}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">×</span>
          )}
        </div>
        <Time nome={match.time_fora} bandeira={match.bandeira_fora} />
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Implementar a página `/jogos`**

Create `src/app/jogos/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";

export default async function JogosPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const jogos = await listarJogos();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Jogos da Copa
        </h1>
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            Os jogos aparecem aqui assim que forem sincronizados.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {jogos.map((j) => (
              <MatchCard key={j.id} match={j} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 6: Rodar testes e build**

Run: `npm test -- match-card && npm run build`
Expected: testes PASS; build compila com a rota `/jogos`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: pagina /jogos somente leitura com lista de partidas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Admin — correção manual de placar + disparar sync

**Files:**
- Create: `src/lib/auth/admin.ts`
- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/match-admin-row.tsx`
- Create: `src/lib/auth/__tests__/admin.test.ts`

**Interfaces:**
- Consumes: `getPerfil`/`Profile` (Fase 1); `listarJogos`/`Match` (Task 6); `createClient` server; `Button`; env server `SYNC_FUNCTION_URL`, `CRON_SECRET` (na Vercel).
- Produces:
  - `requireAdmin(): Promise<Profile>` (redireciona se não-admin)
  - server actions `salvarPlacar(_prev, formData): Promise<{ erro?: string; ok?: string }>` (update em `matches`, seta `placar_manual=true`) e `dispararSync(): Promise<{ erro?: string; ok?: string }>` (chama a Edge Function com `x-cron-secret`)
  - `<MatchAdminRow match={Match} />`

- [ ] **Step 1: Escrever o teste de `requireAdmin` (falhando)**

Create `src/lib/auth/__tests__/admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const getPerfilMock = vi.fn();
vi.mock("@/lib/auth/profile", () => ({ getPerfil: getPerfilMock }));

describe("requireAdmin", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getPerfilMock.mockReset();
  });

  it("redireciona para / se não for admin", async () => {
    getPerfilMock.mockResolvedValue({ id: "u1", apelido: "Zé", avatar_url: null, is_admin: false });
    const { requireAdmin } = await import("@/lib/auth/admin");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("retorna o perfil se for admin", async () => {
    const admin = { id: "u1", apelido: "Chefe", avatar_url: null, is_admin: true };
    getPerfilMock.mockResolvedValue(admin);
    const { requireAdmin } = await import("@/lib/auth/admin");
    await expect(requireAdmin()).resolves.toEqual(admin);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- admin`
Expected: FAIL — `@/lib/auth/admin` não existe.

- [ ] **Step 3: Implementar `requireAdmin`**

Create `src/lib/auth/admin.ts`:

```ts
import { redirect } from "next/navigation";
import { getPerfil, type Profile } from "@/lib/auth/profile";

export async function requireAdmin(): Promise<Profile> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");
  if (!perfil.is_admin) redirect("/");
  return perfil;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- admin`
Expected: PASS (2 testes).

- [ ] **Step 5: Implementar as server actions**

Create `src/app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

export async function salvarPlacar(
  _prev: { erro?: string; ok?: string },
  formData: FormData
): Promise<{ erro?: string; ok?: string }> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const casa = Number(formData.get("placar_casa"));
  const fora = Number(formData.get("placar_fora"));
  if (!id || Number.isNaN(casa) || Number.isNaN(fora) || casa < 0 || fora < 0) {
    return { erro: "Informe um placar válido (números ≥ 0)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("matches")
    .update({
      placar_casa: casa,
      placar_fora: fora,
      status: "finalizado",
      placar_manual: true,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { erro: "Não foi possível salvar o placar." };
  revalidatePath("/admin");
  revalidatePath("/jogos");
  return { ok: "Placar salvo." };
}

export async function dispararSync(): Promise<{ erro?: string; ok?: string }> {
  await requireAdmin();
  const url = process.env.SYNC_FUNCTION_URL;
  const segredo = process.env.CRON_SECRET;
  if (!url || !segredo) return { erro: "Sync não configurada." };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": segredo },
  });
  if (!resp.ok) return { erro: `Falha na sync (${resp.status}).` };
  revalidatePath("/jogos");
  return { ok: "Sincronização disparada." };
}
```

- [ ] **Step 6: Implementar a linha de admin (form de placar)**

Create `src/components/admin/match-admin-row.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { salvarPlacar } from "@/app/admin/actions";
import type { Match } from "@/lib/matches";

export function MatchAdminRow({ match }: { match: Match }) {
  const [estado, formAction] = useActionState(salvarPlacar, {} as { erro?: string; ok?: string });

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
    >
      <input type="hidden" name="id" value={match.id} />
      <span className="min-w-40 flex-1 font-medium">
        {match.time_casa} <span className="text-muted-foreground">x</span> {match.time_fora}
      </span>
      <label className="sr-only" htmlFor={`casa-${match.id}`}>
        Placar {match.time_casa}
      </label>
      <input
        id={`casa-${match.id}`}
        name="placar_casa"
        type="number"
        min={0}
        defaultValue={match.placar_casa ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <label className="sr-only" htmlFor={`fora-${match.id}`}>
        Placar {match.time_fora}
      </label>
      <input
        id={`fora-${match.id}`}
        name="placar_fora"
        type="number"
        min={0}
        defaultValue={match.placar_fora ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <Button type="submit" variant="outline" size="sm">
        Salvar
      </Button>
      {estado?.erro && <span className="text-red-600 dark:text-red-400">{estado.erro}</span>}
      {estado?.ok && <span className="text-primary">{estado.ok}</span>}
    </form>
  );
}
```

- [ ] **Step 7: Implementar a página `/admin`**

Create `src/app/admin/page.tsx`:

```tsx
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/admin";
import { listarJogos } from "@/lib/matches";
import { MatchAdminRow } from "@/components/admin/match-admin-row";
import { dispararSync } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  await requireAdmin();
  const jogos = await listarJogos();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Admin</h1>
          <form action={dispararSync}>
            <Button type="submit" variant="primary" size="sm">
              Sincronizar agora
            </Button>
          </form>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Corrigir um placar manualmente marca o jogo como definitivo e a sincronização
          automática deixa de sobrescrevê-lo.
        </p>
        <div className="flex flex-col gap-2">
          {jogos.map((j) => (
            <MatchAdminRow key={j.id} match={j} />
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Rodar testes, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: testes PASS; lint limpo; build compila com `/admin` e `/jogos`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: admin com correcao manual de placar e disparo de sync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Configuração de ambiente (para o admin disparar sync)

Na **Vercel** (Settings → Environment Variables), Production/Preview/Development:
- `SYNC_FUNCTION_URL` = `https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches`
- `CRON_SECRET` = (o mesmo segredo da Task 4)

Definir um **admin**: `update public.profiles set is_admin = true where id = '<uuid do usuário>';`

---

## Self-Review

**Spec coverage (Fase 2):**
- `matches` + RLS → Task 1.
- Ingestão automática (FlashScore → banco) → Tasks 2 (mapeamento), 3 (função: fixtures+results), 4 (deploy), 5 (cron).
- Respeitar correção manual → Task 3 (pula `placar_manual`) + Task 7 (admin marca manual).
- Jogos na UI → Task 6 (`/jogos`).
- Fallback manual no admin → Task 7 (`/admin`).

**Placeholder scan:** sem TBD/TODO; código completo em cada passo. Valores deixados ao usuário: secrets (chave RapidAPI, `CRON_SECRET`) — marcados como checkpoint na Task 4. Identificadores do torneio já descobertos e fixados nas Global Constraints.

**Type consistency:** `MatchRow` (mapeamento, sem fase/rodada — defaults do banco) e `Match` (app) batem com as colunas. `fixtureToRow`/`resultToRow`/`tsToIso` consistentes. `api_fixture_id` é `text` na tabela e `string` no mapeamento. Server actions no formato `(_prev, formData) => Promise<{erro?,ok?}>`. `requireAdmin(): Promise<Profile>`.

**Notas de risco:**
- A API foi validada ao vivo (retornou jogos reais de 2026 — Brasil, Inglaterra, Canadá...). 
- `tournament_stage_id=SbLsX4y7` ("Main") cobre o período atual; fases de mata-mata podem usar outro stage — se faltarem jogos depois, adicionar o(s) stage(s) extra(s) e iterar fixtures/results por stage.
- `fase`/`rodada` não vêm da API → ficam no default; refino futuro (admin ou parsing) se necessário.
- Função deployada com `--no-verify-jwt`; a segurança é o `x-cron-secret` (manter secreto).
- Pontuação dos palpites é Fase 4.
