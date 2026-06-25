# Fase 7 — Testes & Robustez — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar testes formais de RLS (pgTAP), resiliência ao sync-matches, e painel admin de configuração.

**Architecture:** Três frentes independentes: (1) SQL pgTAP files em `supabase/tests/` rodados via `mcp__supabase-cravou__execute_sql`; (2) Edge Function `sync-matches` com `withRetry` + `AbortController`; (3) nova subpágina `/admin/config` com `listarConfig`/`salvarConfig` + `ConfigForm` (padrão useActionState + useToast).

**Tech Stack:** pgTAP (Postgres), Deno (Edge Function), Next.js App Router, TypeScript, Tailwind v4, Vitest + React Testing Library.

## Global Constraints

- Tailwind v4: tokens via `@theme inline` em `globals.css`; nunca `tailwind.config`.
- Ícones: `lucide-react` (nunca emoji).
- Secrets no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role só em Edge Functions.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `"use client"` em componentes com hooks; `"use server"` em server actions.
- Padrão "falha aberta" nas funções de acesso a dados: retornar `[]` em catch (ver `src/lib/ranking.ts`).
- Testes: `npm test` (Vitest). Build: `npm run build`. Ambos devem passar no final de cada task.
- Supabase MCP disponível: `mcp__supabase-cravou__execute_sql`, `mcp__supabase-cravou__apply_migration`, `mcp__supabase-cravou__deploy_edge_function`.

---

### Task 1: pgTAP — RLS de predictions

**Files:**
- Create: `supabase/tests/rls_predictions.test.sql`

**Interfaces:**
- Produz: arquivo SQL para Task 2 (mesmo padrão estrutural).
- Tabelas relevantes: `auth.users`, `public.profiles` (auto-criado via trigger), `public.matches`, `public.predictions`.
- Políticas que serão testadas (de `0005_predictions.sql`):
  - SELECT: `auth.uid() = user_id`
  - INSERT: `auth.uid() = user_id AND public.palpite_aberto(match_id)`
  - UPDATE: `auth.uid() = user_id` (USING) + `auth.uid() = user_id AND public.palpite_aberto(match_id)` (WITH CHECK)

- [ ] **Step 1: Criar diretório e arquivo de teste**

```bash
mkdir -p supabase/tests
```

Criar `supabase/tests/rls_predictions.test.sql` com o conteúdo abaixo. Cada asserção alterna entre `SET LOCAL ROLE authenticated` (para aplicar RLS) e `RESET ROLE` (para verificar como postgres).

```sql
-- rls_predictions.test.sql
-- Execução: cole no execute_sql do MCP Supabase, ou rode via `supabase test db`.
-- Pré-requisito: pgTAP instalado (CREATE EXTENSION IF NOT EXISTS pgtap).

-- Habilitar pgTAP (fora da transação de teste para o GRANT persistir)
CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(7);

-- UUIDs fixos para reprodutibilidade
-- uid_a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- uid_b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
-- mid1  = 'cccccccc-cccc-cccc-cccc-cccccccccccc' (finalizado — corte passado)
-- mid2  = 'dddddddd-dddd-dddd-dddd-dddddddddddd' (agendado — corte aberto)

-- Fixtures como postgres (bypassa RLS)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'rls-a@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'rls-b@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');
-- Trigger on_auth_user_created cria public.profiles automaticamente

INSERT INTO public.matches (id, api_fixture_id, time_casa, time_fora, inicio_em, status)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'rls-test-mid1',
   'Brasil', 'Argentina', NOW() - INTERVAL '2 hours', 'finalizado'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'rls-test-mid2',
   'França',  'Alemanha',  NOW() + INTERVAL '2 hours', 'agendado');

INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2, 1);

-- Temp table para capturar contagens sem chamar pgTAP como authenticated
CREATE TEMP TABLE _cnt (v int) ON COMMIT DROP;

-- === Teste 1: User A vê apenas as próprias predictions ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO _cnt SELECT count(*)::int FROM public.predictions;
RESET ROLE;
SELECT is((SELECT v FROM _cnt), 1, 'User A vê apenas 1 prediction (a própria)');
TRUNCATE _cnt;

-- === Teste 2: User A vê 0 predictions de B ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO _cnt
  SELECT count(*)::int FROM public.predictions
  WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
RESET ROLE;
SELECT is((SELECT v FROM _cnt), 0, 'User A vê 0 predictions de B (filtro RLS)');
TRUNCATE _cnt;

-- === Teste 3: User A pode INSERT prediction própria (jogo aberto) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 0) $$,
  'User A insere prediction própria em jogo aberto sem erro'
);
RESET ROLE;

-- === Teste 4: User A NÃO pode INSERT com user_id de B ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
     VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'dddddddd-dddd-dddd-dddd-dddddddddddd', 0, 0) $$,
  '42501', NULL,
  'User A não pode inserir prediction com user_id de B (WITH CHECK falha)'
);
RESET ROLE;

-- === Teste 5: User A pode UPDATE na própria prediction (jogo aberto) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ UPDATE public.predictions SET palpite_casa = 2
     WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND match_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  'User A atualiza prediction própria em jogo aberto sem erro'
);
RESET ROLE;

-- === Teste 6: User A NÃO pode UPDATE prediction de B (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.predictions SET palpite_casa = 99
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
RESET ROLE;
SELECT is(
  (SELECT palpite_casa::int FROM public.predictions
   WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  2,
  'User A não modifica prediction de B (palpite_casa permanece 2)'
);

-- === Teste 7: Anônimo vê 0 predictions ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
INSERT INTO _cnt SELECT count(*)::int FROM public.predictions;
RESET ROLE;
SELECT is((SELECT v FROM _cnt), 0, 'Anônimo vê 0 predictions');
TRUNCATE _cnt;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Rodar o teste via MCP**

Use `mcp__supabase-cravou__execute_sql` com o conteúdo completo do arquivo acima.

Resultado esperado: saída com `1..7` e 7 linhas `ok 1 — User A vê apenas...` etc. Nenhuma linha `not ok`.

Se aparecer `permission denied for function is`, rode antes:
```sql
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_predictions.test.sql
git commit -m "test: RLS predictions — 7 asserções pgTAP (SELECT/INSERT/UPDATE isolation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: pgTAP — RLS de matches, ranking e app_config

**Files:**
- Create: `supabase/tests/rls_matches.test.sql`

**Interfaces:**
- Consumes: pgTAP habilitado (Task 1).
- Políticas testadas:
  - `matches`: SELECT authenticated ✓; INSERT/UPDATE só admin; DELETE sem policy = 0 linhas.
  - `ranking()`: EXECUTE granted só a `authenticated`; anon não pode chamar.
  - `app_config`: SELECT authenticated ✓; UPDATE/INSERT/DELETE só admin.

- [ ] **Step 1: Criar `supabase/tests/rls_matches.test.sql`**

```sql
-- rls_matches.test.sql
-- Pré-requisito: pgTAP instalado e acessível (ver Task 1).

BEGIN;
SELECT plan(9);

-- Fixtures como postgres
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
   'rls-c@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');

INSERT INTO public.matches (id, api_fixture_id, time_casa, time_fora, inicio_em, status)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'rls-match-test',
        'Espanha', 'Portugal', NOW() + INTERVAL '1 hour', 'agendado');

CREATE TEMP TABLE _cnt (v int) ON COMMIT DROP;

-- === Teste 1: Autenticado pode SELECT em matches ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO _cnt SELECT count(*)::int FROM public.matches
  WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
RESET ROLE;
SELECT is((SELECT v FROM _cnt), 1, 'Autenticado pode SELECT matches');
TRUNCATE _cnt;

-- === Teste 2: Autenticado NÃO pode INSERT em matches ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.matches (api_fixture_id, time_casa, time_fora, inicio_em)
     VALUES ('rls-fail', 'X', 'Y', NOW() + INTERVAL '1 day') $$,
  '42501', NULL,
  'Autenticado não-admin não pode INSERT em matches'
);
RESET ROLE;

-- === Teste 3: Autenticado NÃO pode UPDATE matches (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.matches SET time_casa = 'HACK'
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
RESET ROLE;
SELECT is(
  (SELECT time_casa FROM public.matches WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  'Espanha',
  'Autenticado não-admin não modifica matches (USING falha, filtro silencioso)'
);

-- === Teste 4: Autenticado pode SELECT ranking() ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT * FROM public.ranking() $$,
  'Autenticado pode chamar ranking()'
);
RESET ROLE;

-- === Teste 5: Anônimo NÃO pode chamar ranking() ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT * FROM public.ranking() $$,
  '42501', NULL,
  'Anônimo não pode chamar ranking() (GRANT só para authenticated)'
);
RESET ROLE;

-- === Teste 6: Anônimo vê 0 matches ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
INSERT INTO _cnt SELECT count(*)::int FROM public.matches;
RESET ROLE;
SELECT is((SELECT v FROM _cnt), 0, 'Anônimo vê 0 matches (sem policy para anon)');
TRUNCATE _cnt;

-- === Teste 7: Autenticado pode SELECT app_config ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO _cnt SELECT count(*)::int FROM public.app_config;
RESET ROLE;
SELECT cmp_ok((SELECT v FROM _cnt), '>', 0, 'Autenticado pode SELECT app_config');
TRUNCATE _cnt;

-- === Teste 8: Autenticado NÃO pode UPDATE app_config (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.app_config SET valor = 999 WHERE chave = 'minutos_corte';
RESET ROLE;
SELECT isnt(
  (SELECT valor FROM public.app_config WHERE chave = 'minutos_corte'),
  999,
  'Autenticado não-admin não pode UPDATE app_config (USING admin check falha)'
);

-- === Teste 9: Autenticado NÃO pode INSERT em app_config ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.app_config (chave, valor) VALUES ('chave_hack', 42) $$,
  '42501', NULL,
  'Autenticado não-admin não pode INSERT em app_config'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Rodar via MCP**

Use `mcp__supabase-cravou__execute_sql` com o conteúdo acima.

Resultado esperado: `1..9` com 9 linhas `ok`. Nenhum `not ok`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_matches.test.sql
git commit -m "test: RLS matches/ranking/app_config — 9 asserções pgTAP

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: sync-matches — withRetry + timeout + logging estruturado

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: arquivo atual (leia antes de editar).
- Produz: mesma interface HTTP (headers, body de resposta) — não muda.

- [ ] **Step 1: Ler o arquivo atual**

Leia `supabase/functions/sync-matches/index.ts` antes de editar.

- [ ] **Step 2: Substituir o conteúdo com a versão robusta**

```typescript
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
```

- [ ] **Step 3: Deploy via MCP**

Use `mcp__supabase-cravou__deploy_edge_function` com `name: "sync-matches"` e o conteúdo do arquivo.

Confirme que o deploy retorna status de sucesso.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "feat: sync-matches com withRetry (3x, backoff 100/200ms), timeout 15s e logging estruturado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Migration `recalcular_todos` + `lib/config.ts` + server action

**Files:**
- Create: `supabase/migrations/0008_recalcular_todos.sql`
- Create: `src/lib/config.ts`
- Create: `src/app/admin/config/actions.ts`

**Interfaces:**
- Consumes: `public.recalcular_pontos(uuid)` (definida em `0006`; revogada de `authenticated`). `recalcular_todos()` é SECURITY DEFINER e a chama internamente como postgres.
- Produz:
  - `listarConfig(): Promise<ConfigRow[]>` — usado pela Task 5
  - `salvarConfig(chave: string, valor: number): Promise<void>` — usado pela action
  - `salvarConfiguracoes(prevState, formData): Promise<{ ok?: string; erro?: string }>` — usado pela Task 5
  - `type ConfigRow = { chave: string; valor: number }` — usado pela Task 5

- [ ] **Step 1: Criar e aplicar a migration**

Criar `supabase/migrations/0008_recalcular_todos.sql`:

```sql
-- Fase 7 — Função pública para recalcular pontos de todos os jogos finalizados.
-- SECURITY DEFINER permite chamar recalcular_pontos internamente (revogada de authenticated).
create or replace function public.recalcular_todos()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in select id from public.matches where status = 'finalizado' loop
    perform public.recalcular_pontos(r.id);
  end loop;
end; $$;

-- Admin check é feito no Next.js via requireAdmin(); DB expõe a qualquer autenticado.
grant execute on function public.recalcular_todos() to authenticated;
```

Aplicar via `mcp__supabase-cravou__apply_migration` com `name: "recalcular_todos"`.

Verificar com `mcp__supabase-cravou__execute_sql`:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'recalcular_todos';
```
Esperado: 1 linha com `recalcular_todos`.

- [ ] **Step 2: Criar `src/lib/config.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type ConfigRow = { chave: string; valor: number };

export async function listarConfig(): Promise<ConfigRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("chave, valor")
      .order("chave");
    return (data as ConfigRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function salvarConfig(chave: string, valor: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_config")
    .update({ valor })
    .eq("chave", chave);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Criar `src/app/admin/config/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listarConfig, salvarConfig } from "@/lib/config";

const CHAVES_PTS = ["pts_placar_exato", "pts_saldo", "pts_resultado", "pts_gols_time"] as const;
const TODAS_CHAVES = ["minutos_corte", ...CHAVES_PTS] as const;
type Chave = (typeof TODAS_CHAVES)[number];

export async function salvarConfiguracoes(
  _prev: { ok?: string; erro?: string } | null,
  formData: FormData
): Promise<{ ok?: string; erro?: string }> {
  await requireAdmin();

  // 1. Parse
  const valores = {} as Record<Chave, number>;
  for (const chave of TODAS_CHAVES) {
    const val = parseInt(String(formData.get(chave) ?? ""), 10);
    if (Number.isNaN(val)) return { erro: `Valor inválido para ${chave}.` };
    valores[chave] = val;
  }

  // 2. Validação
  if (valores.minutos_corte < 1) return { erro: "Corte mínimo é 1 minuto." };
  if (CHAVES_PTS.some((k) => valores[k] < 0)) return { erro: "Pontos não podem ser negativos." };
  if (valores.pts_placar_exato < valores.pts_saldo)
    return { erro: "Placar exato deve valer ≥ saldo+vencedor." };
  if (valores.pts_saldo < valores.pts_resultado)
    return { erro: "Saldo+vencedor deve valer ≥ resultado V/E/D." };
  if (valores.pts_resultado < valores.pts_gols_time)
    return { erro: "Resultado V/E/D deve valer ≥ gols de um time." };

  // 3. Carregar valores atuais para detectar mudanças
  const atuais = await listarConfig();
  const mapaAtual = Object.fromEntries(atuais.map((r) => [r.chave, r.valor]));

  // 4. Salvar apenas o que mudou
  try {
    for (const chave of TODAS_CHAVES) {
      if (mapaAtual[chave] !== valores[chave]) {
        await salvarConfig(chave, valores[chave]);
      }
    }
  } catch {
    return { erro: "Não foi possível salvar as configurações." };
  }

  // 5. Recalcular se algum pts_* mudou
  const ptsMudou = CHAVES_PTS.some((k) => mapaAtual[k] !== valores[k]);
  if (ptsMudou) {
    try {
      const supabase = await createClient();
      await supabase.rpc("recalcular_todos");
    } catch {
      revalidatePath("/admin/config");
      return { ok: "Configurações salvas. Recálculo de pontos falhou — tente salvar novamente." };
    }
    revalidatePath("/ranking");
  }

  revalidatePath("/admin/config");
  return {
    ok: ptsMudou
      ? "Configurações salvas — pontos recalculados."
      : "Configurações salvas!",
  };
}
```

- [ ] **Step 4: Verificar types**

```bash
npm run build
```

Esperado: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_recalcular_todos.sql src/lib/config.ts src/app/admin/config/actions.ts
git commit -m "feat: recalcular_todos() + lib/config + salvarConfiguracoes action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Admin config UI — ConfigForm + página + link no admin

**Files:**
- Create: `src/components/admin/config-form.tsx`
- Create: `src/app/admin/config/page.tsx`
- Create: `src/components/admin/__tests__/config-form.test.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes (Task 4):
  - `type ConfigRow = { chave: string; valor: number }` de `@/lib/config`
  - `salvarConfiguracoes` de `@/app/admin/config/actions`
  - `listarConfig()` de `@/lib/config`
- Consumes (existente):
  - `requireAdmin()` de `@/lib/auth/admin`
  - `Button`, `buttonVariants` de `@/components/ui/button`
  - `useToast` de `@/components/ui/toast`
  - `SiteHeader` de `@/components/site-header`
  - `SiteFooter` de `@/components/site-footer`

- [ ] **Step 1: Escrever o teste primeiro**

Criar `src/components/admin/__tests__/config-form.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ConfigRow } from "@/lib/config";

// Mocks no nível do módulo (hoisted pelo Vitest)
const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/app/admin/config/actions", () => ({ salvarConfiguracoes: vi.fn() }));

const mockUseActionState = vi.fn();
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: mockUseActionState };
});

// Import dinâmico após os mocks
const { ConfigForm } = await import("@/components/admin/config-form");

const CONFIG: ConfigRow[] = [
  { chave: "minutos_corte", valor: 10 },
  { chave: "pts_placar_exato", valor: 10 },
  { chave: "pts_saldo", valor: 7 },
  { chave: "pts_resultado", valor: 5 },
  { chave: "pts_gols_time", valor: 2 },
];

describe("ConfigForm", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
  });

  it("renderiza os 5 campos com valores iniciais", () => {
    render(<ConfigForm config={CONFIG} />);
    expect(screen.getByLabelText(/corte/i)).toHaveValue(10);
    expect(screen.getByLabelText(/placar exato/i)).toHaveValue(10);
    expect(screen.getByLabelText(/saldo/i)).toHaveValue(7);
    expect(screen.getByLabelText(/resultado v\/e\/d/i)).toHaveValue(5);
    expect(screen.getByLabelText(/gols de um time/i)).toHaveValue(2);
  });

  it("exibe erro inline quando estado.erro está presente", () => {
    mockUseActionState.mockReturnValue([{ erro: "Hierarquia de pontos inválida" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Hierarquia de pontos inválida");
  });

  it("chama toast de sucesso quando estado.ok está presente", () => {
    mockUseActionState.mockReturnValue([{ ok: "Configurações salvas!" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(mockToast).toHaveBeenCalledWith({ message: "Configurações salvas!", variant: "success" });
  });

  it("chama toast de erro quando estado.erro está presente", () => {
    mockUseActionState.mockReturnValue([{ erro: "Erro ao salvar" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(mockToast).toHaveBeenCalledWith({ message: "Erro ao salvar", variant: "error" });
  });
});
```

- [ ] **Step 2: Rodar os testes — esperar falha**

```bash
npm test -- config-form
```

Esperado: FAIL com "Cannot find module '@/components/admin/config-form'".

- [ ] **Step 3: Criar `src/components/admin/config-form.tsx`**

```typescript
"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { salvarConfiguracoes } from "@/app/admin/config/actions";
import type { ConfigRow } from "@/lib/config";

const CAMPOS: { chave: string; label: string; hint: string; min: number }[] = [
  { chave: "minutos_corte", label: "Corte (min antes do jogo)", hint: "Palpites encerram X min antes do início", min: 1 },
  { chave: "pts_placar_exato", label: "Placar exato (pts)", hint: "Casa e fora corretos", min: 0 },
  { chave: "pts_saldo", label: "Saldo + vencedor (pts)", hint: "Vitória com diferença de gols exata", min: 0 },
  { chave: "pts_resultado", label: "Resultado V/E/D (pts)", hint: "Acertou quem ganhou ou empatou", min: 0 },
  { chave: "pts_gols_time", label: "Gols de um time (pts)", hint: "Acertou só os gols de um lado", min: 0 },
];

export function ConfigForm({ config }: { config: ConfigRow[] }) {
  const mapaValores = Object.fromEntries(config.map((r) => [r.chave, r.valor]));
  const [estado, formAction, pending] = useActionState(salvarConfiguracoes, null);
  const { toast } = useToast();

  useEffect(() => {
    if (estado?.ok) toast({ message: estado.ok, variant: "success" });
  }, [estado?.ok, toast]);

  useEffect(() => {
    if (estado?.erro) toast({ message: estado.erro, variant: "error" });
  }, [estado?.erro, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {CAMPOS.map(({ chave, label, hint, min }) => (
        <div key={chave} className="flex flex-col gap-1">
          <label htmlFor={chave} className="text-sm font-medium text-foreground">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <input
            id={chave}
            name={chave}
            type="number"
            min={min}
            step={1}
            defaultValue={mapaValores[chave] ?? 0}
            className="h-10 w-32 rounded-lg border border-border bg-background px-3 text-sm"
          />
        </div>
      ))}

      {estado?.erro && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {estado.erro}
        </p>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Rodar os testes — esperar passar**

```bash
npm test -- config-form
```

Esperado: 4/4 PASS.

- [ ] **Step 5: Criar `src/app/admin/config/page.tsx`**

```typescript
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireAdmin } from "@/lib/auth/admin";
import { listarConfig } from "@/lib/config";
import { ConfigForm } from "@/components/admin/config-form";

export default async function AdminConfigPage() {
  await requireAdmin();
  const config = await listarConfig();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-display mb-6 text-3xl font-bold uppercase tracking-tight">
          Configurações
        </h1>
        <ConfigForm config={config} />
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 6: Adicionar link "Configurações" em `src/app/admin/page.tsx`**

Leia o arquivo antes de editar. Adicione `buttonVariants` ao import de `@/components/ui/button` e adicione um `<a>` ao cabeçalho. O trecho a modificar é o `<div>` que contém o `<h1>Admin</h1>` e o botão de sync:

```typescript
// Adicionar ao import existente:
import { Button, buttonVariants } from "@/components/ui/button";

// Substituir o div de cabeçalho:
<div className="mb-6 flex flex-wrap items-center justify-between gap-2">
  <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Admin</h1>
  <div className="flex items-center gap-2">
    <a href="/admin/config" className={buttonVariants({ variant: "ghost", size: "sm" })}>
      Configurações
    </a>
    <form action={handleDispararSync}>
      <Button type="submit" variant="primary" size="sm">
        Sincronizar agora
      </Button>
    </form>
  </div>
</div>
```

- [ ] **Step 7: Rodar a suíte completa e o build**

```bash
npm test
```
Esperado: 75 testes passando (71 anteriores + 4 novos), 23 arquivos.

```bash
npm run build
```
Esperado: sem erros. Rotas compiladas incluem `/admin/config`.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/config-form.tsx src/components/admin/__tests__/config-form.test.tsx src/app/admin/config/page.tsx src/app/admin/page.tsx
git commit -m "feat: painel admin de configuração (/admin/config) com validação e recálculo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2 Predictions RLS (7 asserções) → Task 1 ✓
- §2.5 Matches/ranking/app_config RLS (9 asserções) → Task 2 ✓
- §3 sync-matches withRetry + timeout + logging → Task 3 ✓
- §4.2 `listarConfig` / `salvarConfig` → Task 4 ✓
- §4.3 `salvarConfiguracoes` com validação hierárquica → Task 4 ✓
- §4.5 `ConfigForm` com 5 campos + toast + inline error → Task 5 ✓
- §4.6 `/admin/config` page + link no `/admin` → Task 5 ✓
- §4.8 Testes ConfigForm (4 casos) → Task 5 ✓

**Placeholder scan:** nenhum TBD ou TODO.

**Type consistency:**
- `ConfigRow` definido em Task 4 (`src/lib/config.ts`), importado em Task 5 ✓
- `salvarConfiguracoes` assinatura em Task 4, usada em `ConfigForm` Task 5 ✓
- `listarConfig()` retorna `ConfigRow[]`, consumido pela page Task 5 ✓
