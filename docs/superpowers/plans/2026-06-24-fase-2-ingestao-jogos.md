# Cravou! — Fase 2: Ingestão de Jogos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer os jogos da Copa 2026 (e seus placares) da API-Football para o banco automaticamente via cron, exibi-los numa página `/jogos`, com fallback manual de placar pelo admin.

**Architecture:** Uma Edge Function `sync-matches` (Deno) busca os fixtures na API-Football, mapeia para linhas da tabela `matches` e faz upsert via service role, pulando jogos que o admin corrigiu manualmente (`placar_manual`). `pg_cron` chama a função em intervalo, autenticada por um header `x-cron-secret`. A app Next.js lê `matches` (RLS de leitura para autenticados) numa página `/jogos`, e um painel `/admin` (gating por `is_admin`) permite corrigir placar e disparar a sync.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS + Edge Functions + pg_cron + pg_net), Deno (Edge Function), API-Football (api-sports.io), Vitest.

## Global Constraints

- Nome exibido: **Cravou!** (com ponto de exclamação). UI em Português do Brasil.
- ⚠️ Next.js 16: convenção de proxy (não middleware); confirmar APIs em `node_modules/next/dist/docs/` quando em dúvida. `cookies()` é assíncrono.
- Segredos nunca no client. `API_FOOTBALL_KEY`, `CRON_SECRET` e o service role vivem só na Edge Function / secrets do Supabase (ou env server na Vercel). Ao browser, só `NEXT_PUBLIC_*`.
- Fonte: **api-sports.io direto** — base `https://v3.football.api-sports.io`, header `x-apisports-key: <chave>`.
- Copa do Mundo 2026 na API-Football: `league=1`, `season=2026` (configuráveis por env da função; confirmar na Task 4).
- Pontuação dos palpites é da Fase 4 — **não** calcular pontos aqui.
- Reusar o design system (`Button`/`buttonVariants`, tokens, `lucide-react`); dark E light.
- Status interno de um jogo: `agendado` | `ao_vivo` | `finalizado`.
- Commits: um por task; mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Migração — tabela `matches` + RLS

**Files:**
- Create: `supabase/migrations/0002_matches.sql`

**Interfaces:**
- Consumes: tabela `profiles` (coluna `is_admin`) da Fase 1.
- Produces: tabela `public.matches` com unique em `api_fixture_id`; RLS (leitura para autenticados; escrita só para admins — o service role da Edge Function ignora RLS).

- [ ] **Step 1: Escrever a migração**

Create `supabase/migrations/0002_matches.sql`:

```sql
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id bigint unique,
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

-- Leitura: qualquer usuário autenticado vê os jogos
create policy "matches_select_authenticated"
  on public.matches for select
  to authenticated
  using (true);

-- Escrita manual: apenas admins (o service role da Edge Function ignora RLS)
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

- [ ] **Step 2: Aplicar e verificar** (o controlador aplica via API/MCP do Supabase; sem ação local de banco)

Verificação (rode no SQL Editor ou via API de Management):

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
git commit -m "feat: migracao matches com RLS de leitura e escrita admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Módulo de mapeamento de fixtures (puro) + testes

**Files:**
- Create: `supabase/functions/_shared/fixtures.ts`
- Create: `supabase/functions/_shared/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: nada (TypeScript puro, sem imports de Deno — para ser testável pelo Vitest).
- Produces:
  - `type MatchRow = { api_fixture_id: number; fase: string; rodada: string; time_casa: string; time_fora: string; bandeira_casa: string | null; bandeira_fora: string | null; inicio_em: string; status: "agendado"|"ao_vivo"|"finalizado"; placar_casa: number | null; placar_fora: number | null }`
  - `mapStatus(short: string): "agendado"|"ao_vivo"|"finalizado"`
  - `mapRound(round: string): { fase: string; rodada: string }`
  - `toMatchRow(fixture: ApiFixture): MatchRow`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `supabase/functions/_shared/__tests__/fixtures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapStatus, mapRound, toMatchRow } from "../fixtures";

describe("mapStatus", () => {
  it("mapeia finalizados", () => {
    for (const s of ["FT", "AET", "PEN"]) expect(mapStatus(s)).toBe("finalizado");
  });
  it("mapeia ao vivo", () => {
    for (const s of ["1H", "HT", "2H", "ET", "P", "LIVE"]) expect(mapStatus(s)).toBe("ao_vivo");
  });
  it("o resto vira agendado", () => {
    for (const s of ["NS", "TBD", "PST", "CANC"]) expect(mapStatus(s)).toBe("agendado");
  });
});

describe("mapRound", () => {
  it("fase de grupos com número da rodada", () => {
    expect(mapRound("Group Stage - 2")).toEqual({ fase: "grupos", rodada: "2" });
  });
  it("mata-mata", () => {
    expect(mapRound("Round of 16")).toEqual({ fase: "oitavas", rodada: "" });
    expect(mapRound("Quarter-finals")).toEqual({ fase: "quartas", rodada: "" });
    expect(mapRound("Semi-finals")).toEqual({ fase: "semi", rodada: "" });
    expect(mapRound("3rd Place Final")).toEqual({ fase: "terceiro", rodada: "" });
    expect(mapRound("Final")).toEqual({ fase: "final", rodada: "" });
  });
});

describe("toMatchRow", () => {
  it("mapeia um fixture finalizado", () => {
    const fixture = {
      fixture: { id: 1234, date: "2026-06-20T19:00:00+00:00", status: { short: "FT" } },
      league: { round: "Group Stage - 1" },
      teams: {
        home: { name: "Brazil", logo: "https://x/br.png" },
        away: { name: "Serbia", logo: "https://x/rs.png" },
      },
      goals: { home: 2, away: 0 },
    };
    expect(toMatchRow(fixture)).toEqual({
      api_fixture_id: 1234,
      fase: "grupos",
      rodada: "1",
      time_casa: "Brazil",
      time_fora: "Serbia",
      bandeira_casa: "https://x/br.png",
      bandeira_fora: "https://x/rs.png",
      inicio_em: "2026-06-20T19:00:00+00:00",
      status: "finalizado",
      placar_casa: 2,
      placar_fora: 0,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- fixtures`
Expected: FAIL — `../fixtures` não existe.

- [ ] **Step 3: Implementar o módulo**

Create `supabase/functions/_shared/fixtures.ts`:

```ts
export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
};

export type MatchRow = {
  api_fixture_id: number;
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

const FINALIZADO = new Set(["FT", "AET", "PEN"]);
const AO_VIVO = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);

export function mapStatus(short: string): MatchRow["status"] {
  if (FINALIZADO.has(short)) return "finalizado";
  if (AO_VIVO.has(short)) return "ao_vivo";
  return "agendado";
}

export function mapRound(round: string): { fase: string; rodada: string } {
  const r = round.toLowerCase();
  if (r.includes("group")) {
    const m = round.match(/(\d+)\s*$/);
    return { fase: "grupos", rodada: m ? m[1] : "" };
  }
  if (r.includes("round of 16")) return { fase: "oitavas", rodada: "" };
  if (r.includes("quarter")) return { fase: "quartas", rodada: "" };
  if (r.includes("semi")) return { fase: "semi", rodada: "" };
  if (r.includes("3rd place") || r.includes("third place")) return { fase: "terceiro", rodada: "" };
  if (r.includes("final")) return { fase: "final", rodada: "" };
  return { fase: "grupos", rodada: "" };
}

export function toMatchRow(f: ApiFixture): MatchRow {
  const { fase, rodada } = mapRound(f.league.round);
  return {
    api_fixture_id: f.fixture.id,
    fase,
    rodada,
    time_casa: f.teams.home.name,
    time_fora: f.teams.away.name,
    bandeira_casa: f.teams.home.logo,
    bandeira_fora: f.teams.away.logo,
    inicio_em: f.fixture.date,
    status: mapStatus(f.fixture.status.short),
    placar_casa: f.goals.home,
    placar_fora: f.goals.away,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- fixtures`
Expected: PASS (3 blocos / 7 asserts).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/__tests__/fixtures.test.ts
git commit -m "feat: mapeamento puro de fixtures da API-Football

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Edge Function `sync-matches`

**Files:**
- Create: `supabase/functions/sync-matches/index.ts`
- Create: `supabase/functions/sync-matches/deno.json`

**Interfaces:**
- Consumes: `toMatchRow`, `MatchRow` de `../_shared/fixtures.ts`; secrets `API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE`, `API_FOOTBALL_SEASON`, `CRON_SECRET`; env auto `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: endpoint HTTP que, autenticado por header `x-cron-secret`, busca fixtures e faz upsert em `matches`, retornando JSON `{ ok, total, upserted, pulados_manual }`.

- [ ] **Step 1: Escrever o config do Deno**

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
import { toMatchRow, type MatchRow } from "../_shared/fixtures.ts";

Deno.serve(async (req) => {
  // Autenticação simples por segredo compartilhado (cron + admin enviam este header).
  const segredo = req.headers.get("x-cron-secret");
  if (!segredo || segredo !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ ok: false, erro: "não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("API_FOOTBALL_KEY")!;
  const league = Deno.env.get("API_FOOTBALL_LEAGUE") ?? "1";
  const season = Deno.env.get("API_FOOTBALL_SEASON") ?? "2026";

  const resp = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}`,
    { headers: { "x-apisports-key": apiKey } }
  );
  if (!resp.ok) {
    return new Response(
      JSON.stringify({ ok: false, erro: `API-Football ${resp.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  const data = await resp.json();
  const fixtures = Array.isArray(data?.response) ? data.response : [];
  const rows: MatchRow[] = fixtures.map(toMatchRow);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Respeita correções manuais: não sobrescreve jogos com placar_manual = true.
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
Expected: PASS (a função usa `toMatchRow`, já coberto; o handler em si é verificado na Task 4 contra o banco real).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-matches/
git commit -m "feat: edge function sync-matches (API-Football -> matches)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deploy da função + secrets + sync inicial (checkpoint de credenciais)

**Files:** nenhum arquivo de código (deploy + secrets via Supabase CLI/MCP, com o controlador).

**Interfaces:**
- Consumes: a função da Task 3; a tabela da Task 1.
- Produces: função `sync-matches` publicada; secrets configurados; tabela `matches` populada com os jogos da Copa.

- [ ] **Step 1: Definir os secrets da função** (controlador, com a chave fornecida pelo usuário)

```bash
supabase secrets set \
  API_FOOTBALL_KEY=<chave-do-usuario> \
  API_FOOTBALL_LEAGUE=1 \
  API_FOOTBALL_SEASON=2026 \
  CRON_SECRET=<segredo-gerado> \
  --project-ref xyfuxtlnjapsptqufgah
```

- [ ] **Step 2: Confirmar league/season** (chamada única à API-Football para validar que `league=1&season=2026` retorna fixtures da Copa). Se vier vazio, ajustar `API_FOOTBALL_LEAGUE`/`SEASON` consultando `/leagues?search=World Cup`.

- [ ] **Step 3: Deploy da função** (sem verificação de JWT — a autenticação é o `x-cron-secret`)

```bash
supabase functions deploy sync-matches --no-verify-jwt --project-ref xyfuxtlnjapsptqufgah
```

- [ ] **Step 4: Invocar manualmente e verificar**

```bash
curl -s -X POST "https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches" \
  -H "x-cron-secret: <segredo-gerado>"
```
Expected: JSON `{ ok: true, total: N, upserted: N, pulados_manual: 0 }` com N > 0.

Verificar no banco: `select count(*), min(inicio_em), max(inicio_em) from public.matches;` → contagem > 0.

- [ ] **Step 5: Sem commit** (operação de infraestrutura). Registrar no ledger o segredo (apenas referência, não o valor) e que a função está publicada.

---

### Task 5: Agendamento com pg_cron

**Files:**
- Create: `supabase/migrations/0003_cron_sync_matches.sql`

**Interfaces:**
- Consumes: a função publicada (Task 4) e o `CRON_SECRET`.
- Produces: job `pg_cron` que chama `sync-matches` a cada 15 minutos via `pg_net`.

- [ ] **Step 1: Escrever a migração de cron**

Create `supabase/migrations/0003_cron_sync_matches.sql`. Substitua `<SEGREDO>` pelo mesmo `CRON_SECRET` da Task 4 ao aplicar:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior, se existir (idempotente)
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

- [ ] **Step 2: Aplicar** (controlador, via API/MCP do Supabase) e verificar o job:

```sql
select jobname, schedule, active from cron.job where jobname = 'sync-matches';
```
Expected: 1 linha, `schedule='*/15 * * * *'`, `active=true`.

- [ ] **Step 3: Confirmar execução** (após até 15 min, ou rodar a função manual da Task 4): conferir `select max(atualizado_em) from public.matches;` recente.

- [ ] **Step 4: Commit** (o arquivo de migração, com `<SEGREDO>` substituído por um placeholder — NÃO commitar o segredo real):

Antes de commitar, troque o valor real por `'<CRON_SECRET>'` no arquivo versionado (o valor real fica só no banco/secret).

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
- Consumes: `createClient` server; `getSessao` (Fase 1) para proteção; design system.
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
      <MatchCard
        match={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 0 }}
      />
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
- Consumes: `getPerfil` (Fase 1); `listarJogos`/`Match` (Task 6); `createClient` server; `Button`; env server `SYNC_FUNCTION_URL`, `CRON_SECRET` (na Vercel, para o botão de sync).
- Produces:
  - `requireAdmin(): Promise<Profile>` (redireciona se não-admin)
  - server actions `salvarPlacar(_prev, formData): Promise<{ erro?: string; ok?: string }>` (update em `matches`, seta `placar_manual=true`) e `dispararSync(): Promise<{ erro?: string; ok?: string }>` (chama a Edge Function com o `x-cron-secret`)
  - `<MatchAdminRow match={Match} />` (form de placar por jogo)

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
Expected: todos os testes PASS; lint limpo; build compila com `/admin` e `/jogos`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: admin com correcao manual de placar e disparo de sync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Configuração de ambiente (necessária para o admin disparar sync)

Na **Vercel** (Settings → Environment Variables), adicionar para Production/Preview/Development:
- `SYNC_FUNCTION_URL` = `https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches`
- `CRON_SECRET` = (o mesmo segredo definido na Task 4)

Definir um **admin**: no SQL Editor/MCP, `update public.profiles set is_admin = true where id = '<uuid do usuário>';`

---

## Self-Review

**Spec coverage (Fase 2):**
- Tabela `matches` + RLS → Task 1.
- Ingestão automática (API-Football → banco) → Tasks 2 (mapeamento), 3 (função), 4 (deploy), 5 (cron).
- Respeitar correção manual (`placar_manual`) → Task 3 (sync pula manuais) + Task 7 (admin marca manual).
- Jogos aparecem na UI → Task 6 (`/jogos`).
- Fallback manual no admin → Task 7 (`/admin`, gating `is_admin`, editar placar, disparar sync).

**Placeholder scan:** sem TBD/TODO; todo passo de código traz código completo. Os únicos valores deixados ao usuário são secrets (chave da API, `CRON_SECRET`) e a confirmação de `league/season` — explicitamente marcados como checkpoint na Task 4.

**Type consistency:** `MatchRow` (mapeamento, snake_case = colunas) e `Match` (app) batem com as colunas de `matches`. `toMatchRow`/`mapStatus`/`mapRound` usados de forma consistente. Server actions seguem o formato `(_prev, formData) => Promise<{erro?,ok?}>` do `useActionState`, como na Fase 1. `requireAdmin(): Promise<Profile>` usa o `Profile` da Fase 1.

**Notas de risco:**
- A função é deployada com `--no-verify-jwt`; a segurança é o `x-cron-secret`. Mantê-lo secreto (Supabase secret + Vercel env). 
- Pontuação dos palpites NÃO entra aqui (Fase 4); a sync só ingere jogos/placares.
- `league=1&season=2026` deve ser confirmado contra a API-Football na Task 4 (free tier pode limitar temporadas/*fixtures*; ajustar secrets se necessário).
- O módulo `_shared/fixtures.ts` é TS puro (sem imports de Deno) justamente para o Vitest conseguir testá-lo; a função Deno importa os mesmos símbolos via caminho relativo.
