# Fase 3 — Palpites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada usuário registre e edite seu palpite (placar) para cada jogo, com a edição travada no servidor a partir de `inicio_em − minutos_corte`.

**Architecture:** Nova tabela `app_config` (chave/valor int) guarda `minutos_corte` (e já os defaults de pontuação da Fase 4). Nova tabela `predictions` (UNIQUE por usuário+jogo) guarda os palpites, com RLS que só deixa o dono ler/escrever e bloqueia escrita após o corte via função SQL `palpite_aberto(match_id)`. No front, cada card de jogo ganha um formulário de palpite (Server Action + `useActionState`) que desabilita os campos quando o corte passou ou o jogo terminou. A regra de corte é validada em três camadas: RLS (fonte da verdade), Server Action (mensagem amigável) e UI (desabilita campos).

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase (Postgres + RLS, função SQL), Tailwind v4, React 19 `useActionState`, Vitest + React Testing Library, zod.

## Global Constraints

- Nome de exibição: `Cravou!` (sempre com ponto de exclamação, verbatim).
- Idioma da UI: Português do Brasil.
- Next.js 16: convenção de middleware é `proxy` (`src/proxy.ts`); `cookies()` é async; consulte `node_modules/next/dist/docs/` antes de usar APIs do Next.
- Pontuação (referência p/ Fase 4): placar exato = 10 pts; só o resultado (V/E/D) = 5 pts; erro = 0. Valores em `app_config`.
- Corte do palpite: editável até `inicio_em − minutos_corte` (default 10 min), validado **no servidor** (RLS + Server Action), nunca apenas no front.
- Segredos nunca no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` vão ao browser.
- TDD: teste primeiro, vê falhar, implementa, vê passar, commit (um commit por unidade).
- Componentes com hooks/Framer Motion precisam de `"use client"`. Reusar `Button`/`buttonVariants()` e `Reveal`. Funcionar em dark E light. Ícones lucide (nunca emoji). `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Aplicação de migrations:** os arquivos `.sql` são criados pelo implementador, mas **aplicados no banco pelo controlador** (via Supabase Management API / MCP — requer PAT). O implementador entrega o arquivo + a query de verificação; o controlador aplica e roda a verificação.

---

## File Structure

**Criar:**
- `supabase/migrations/0004_app_config.sql` — tabela `app_config` (chave/valor int), seed dos 3 defaults, RLS (leitura autenticada, escrita admin), função `palpite_aberto(uuid)`.
- `supabase/migrations/0005_predictions.sql` — tabela `predictions` + índices + RLS (dono lê/escreve, corte via `palpite_aberto`).
- `src/lib/palpites/corte.ts` — função pura `palpiteAberto(inicioEm, minutosCorte, agora?)`.
- `src/lib/palpites/__tests__/corte.test.ts` — testes da regra de corte.
- `src/lib/palpites/validation.ts` — `palpiteSchema` (zod) + reusa `validar`.
- `src/lib/palpites/__tests__/validation.test.ts` — testes de validação.
- `src/lib/predictions.ts` — tipo `Prediction`, `listarMeusPalpites()`, `getMinutosCorte()`.
- `src/app/jogos/actions.ts` — Server Action `salvarPalpite`.
- `src/components/jogos/palpite-form.tsx` — formulário de palpite (client, `useActionState`).
- `src/components/jogos/__tests__/palpite-form.test.tsx` — teste do formulário (estados aberto/travado).

**Modificar:**
- `src/components/jogos/match-card.tsx` — receber `palpite` e `minutosCorte`, renderizar `PalpiteForm`.
- `src/app/jogos/page.tsx` — buscar palpites do usuário + `minutos_corte`, passar aos cards.

---

### Task 1: Migration `app_config` + função `palpite_aberto`

**Files:**
- Create: `supabase/migrations/0004_app_config.sql`

**Interfaces:**
- Produces: tabela `public.app_config(chave text pk, valor int not null)` com linhas `minutos_corte=10`, `pts_placar_exato=10`, `pts_resultado=5`. Função `public.palpite_aberto(p_match_id uuid) returns boolean` (stable, security definer) — `true` se ainda dá pra palpitar.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0004_app_config.sql`:

```sql
-- Configurações do bolão (chave/valor inteiro)
create table if not exists public.app_config (
  chave text primary key,
  valor int not null
);

insert into public.app_config (chave, valor) values
  ('minutos_corte', 10),
  ('pts_placar_exato', 10),
  ('pts_resultado', 5)
on conflict (chave) do nothing;

alter table public.app_config enable row level security;

-- Leitura: qualquer autenticado (UI precisa do minutos_corte)
create policy "app_config_select_authenticated"
  on public.app_config for select
  to authenticated
  using (true);

-- Escrita: só admin
create policy "app_config_write_admin"
  on public.app_config for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- true enquanto ainda é permitido palpitar: now() < inicio_em - minutos_corte
create or replace function public.palpite_aberto(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select now() < m.inicio_em
    - make_interval(mins => coalesce(
        (select valor from public.app_config where chave = 'minutos_corte'), 10))
  from public.matches m
  where m.id = p_match_id;
$$;
```

- [ ] **Step 2: Controlador aplica a migration no Supabase**

Aplicar o conteúdo de `0004_app_config.sql` via Supabase Management API (endpoint `POST /v1/projects/{ref}/database/query`) ou MCP do Supabase.

- [ ] **Step 3: Verificar no banco**

Rodar via Management API/MCP:

```sql
select chave, valor from public.app_config order by chave;
```
Esperado: 3 linhas — `minutos_corte=10`, `pts_placar_exato=10`, `pts_resultado=5`.

```sql
-- jogo no futuro distante deve estar aberto (true); jogo no passado, fechado (false)
select public.palpite_aberto(id) as aberto, inicio_em
from public.matches order by inicio_em desc limit 1;
```
Esperado: retorna uma linha booleana sem erro.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_app_config.sql
git commit -m "feat(db): app_config (chave/valor) + função palpite_aberto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Migration `predictions` + RLS

**Files:**
- Create: `supabase/migrations/0005_predictions.sql`

**Interfaces:**
- Consumes: `public.palpite_aberto(uuid)` (Task 1), `public.matches`, `auth.users`.
- Produces: tabela `public.predictions(id, user_id, match_id, palpite_casa, palpite_fora, pontos, created_at, updated_at)` com `unique(user_id, match_id)` e RLS: dono lê/escreve; escrita só com corte aberto.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0005_predictions.sql`:

```sql
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  palpite_casa int not null check (palpite_casa >= 0),
  palpite_fora int not null check (palpite_fora >= 0),
  pontos int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_match_id_idx on public.predictions (match_id);
create index if not exists predictions_user_id_idx on public.predictions (user_id);

alter table public.predictions enable row level security;

-- Leitura: só os próprios palpites
create policy "predictions_select_own"
  on public.predictions for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserção: só os próprios E só com o corte aberto
create policy "predictions_insert_own"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id and public.palpite_aberto(match_id));

-- Atualização: só os próprios E só com o corte aberto
create policy "predictions_update_own"
  on public.predictions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.palpite_aberto(match_id));
```

- [ ] **Step 2: Controlador aplica a migration no Supabase**

Aplicar `0005_predictions.sql` via Management API/MCP.

- [ ] **Step 3: Verificar no banco**

```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'predictions'
order by policyname;
```
Esperado: 3 políticas — `predictions_insert_own` (INSERT), `predictions_select_own` (SELECT), `predictions_update_own` (UPDATE).

```sql
select count(*) from public.predictions;
```
Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_predictions.sql
git commit -m "feat(db): tabela predictions + RLS (dono, corte aberto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Função pura de corte

**Files:**
- Create: `src/lib/palpites/corte.ts`
- Test: `src/lib/palpites/__tests__/corte.test.ts`

**Interfaces:**
- Produces: `palpiteAberto(inicioEm: string, minutosCorte: number, agora?: Date): boolean` — `true` enquanto `agora < inicio_em − minutosCorte`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/palpites/__tests__/corte.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { palpiteAberto } from "@/lib/palpites/corte";

const inicio = "2026-07-01T18:00:00.000Z"; // kickoff
const corte = 10; // minutos

describe("palpiteAberto", () => {
  it("aberto bem antes do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:00:00.000Z"))).toBe(true);
  });

  it("fechado depois do corte (mas antes do apito)", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:55:00.000Z"))).toBe(false);
  });

  it("fechado exatamente no instante do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:50:00.000Z"))).toBe(false);
  });

  it("aberto um segundo antes do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:49:59.000Z"))).toBe(true);
  });

  it("fechado depois do apito", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T19:00:00.000Z"))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- corte`
Expected: FAIL (`palpiteAberto` não existe / módulo não encontrado).

- [ ] **Step 3: Implementar**

Create `src/lib/palpites/corte.ts`:

```ts
// true enquanto ainda dá pra palpitar: agora < inicio_em - minutosCorte
export function palpiteAberto(
  inicioEm: string,
  minutosCorte: number,
  agora: Date = new Date()
): boolean {
  const corte = new Date(new Date(inicioEm).getTime() - minutosCorte * 60_000);
  return agora.getTime() < corte.getTime();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- corte`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/palpites/corte.ts src/lib/palpites/__tests__/corte.test.ts
git commit -m "feat: função pura palpiteAberto (regra de corte)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Validação do palpite (zod)

**Files:**
- Create: `src/lib/palpites/validation.ts`
- Test: `src/lib/palpites/__tests__/validation.test.ts`

**Interfaces:**
- Consumes: `validar` de `src/lib/auth/validation.ts` (assinatura: `validar<T>(schema, data) => { sucesso: true; dados: T } | { sucesso: false; erro: string }`).
- Produces: `palpiteSchema` (zod) e `type Palpite = { palpite_casa: number; palpite_fora: number }`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/palpites/__tests__/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { palpiteSchema } from "@/lib/palpites/validation";
import { validar } from "@/lib/auth/validation";

describe("palpiteSchema", () => {
  it("aceita placar válido", () => {
    const r = validar(palpiteSchema, { palpite_casa: 2, palpite_fora: 1 });
    expect(r.sucesso).toBe(true);
  });

  it("aceita strings numéricas (vindas de FormData)", () => {
    const r = validar(palpiteSchema, { palpite_casa: "0", palpite_fora: "3" });
    expect(r).toEqual({ sucesso: true, dados: { palpite_casa: 0, palpite_fora: 3 } });
  });

  it("rejeita números negativos", () => {
    const r = validar(palpiteSchema, { palpite_casa: -1, palpite_fora: 0 });
    expect(r.sucesso).toBe(false);
  });

  it("rejeita valor não numérico", () => {
    const r = validar(palpiteSchema, { palpite_casa: "abc", palpite_fora: 1 });
    expect(r.sucesso).toBe(false);
  });

  it("rejeita campo ausente", () => {
    const r = validar(palpiteSchema, { palpite_casa: 1 });
    expect(r.sucesso).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- palpites/__tests__/validation`
Expected: FAIL (`palpiteSchema` não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/palpites/validation.ts`:

```ts
import { z } from "zod";

// coerce: FormData entrega strings; convertemos pra número e validamos inteiro >= 0
const placar = z.coerce
  .number({ message: "Informe um placar válido." })
  .int("O placar deve ser um número inteiro.")
  .min(0, "O placar não pode ser negativo.");

export const palpiteSchema = z.object({
  palpite_casa: placar,
  palpite_fora: placar,
});

export type Palpite = z.infer<typeof palpiteSchema>;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- palpites/__tests__/validation`
Expected: PASS (5 testes).

> Nota: `z.coerce.number()` transforma `""` em `0` e `"abc"` em `NaN` (rejeitado pelo `.int()`). O teste "campo ausente" passa porque `undefined` vira `NaN`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/palpites/validation.ts src/lib/palpites/__tests__/validation.test.ts
git commit -m "feat: palpiteSchema (validação de placar)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Acesso a dados de palpites

**Files:**
- Create: `src/lib/predictions.ts`

**Interfaces:**
- Consumes: `createClient` de `src/lib/supabase/server.ts` (async, retorna client Supabase).
- Produces:
  - `type Prediction = { id: string; match_id: string; palpite_casa: number; palpite_fora: number; pontos: number | null }`
  - `listarMeusPalpites(): Promise<Record<string, Prediction>>` — mapa por `match_id` dos palpites do usuário logado (vazio se deslogado/erro).
  - `getMinutosCorte(): Promise<number>` — lê `app_config.minutos_corte`, default `10` em erro/ausência.

- [ ] **Step 1: Implementar**

Create `src/lib/predictions.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type Prediction = {
  id: string;
  match_id: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
};

// Mapa por match_id dos palpites do usuário logado. Falha aberta: {} em erro.
export async function listarMeusPalpites(): Promise<Record<string, Prediction>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data } = await supabase
      .from("predictions")
      .select("id, match_id, palpite_casa, palpite_fora, pontos")
      .eq("user_id", user.id);

    const mapa: Record<string, Prediction> = {};
    for (const p of (data as Prediction[]) ?? []) mapa[p.match_id] = p;
    return mapa;
  } catch {
    return {};
  }
}

// Lê minutos_corte da app_config; default 10 em qualquer falha.
export async function getMinutosCorte(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("valor")
      .eq("chave", "minutos_corte")
      .single();
    return (data as { valor: number } | null)?.valor ?? 10;
  } catch {
    return 10;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build` (ou `npx tsc --noEmit`)
Expected: compila sem erros de tipo em `src/lib/predictions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/predictions.ts
git commit -m "feat: acesso a dados de palpites (listarMeusPalpites, getMinutosCorte)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Server Action `salvarPalpite`

**Files:**
- Create: `src/app/jogos/actions.ts`

**Interfaces:**
- Consumes: `palpiteSchema` (Task 4), `validar` (`src/lib/auth/validation.ts`), `palpiteAberto` (Task 3), `getMinutosCorte` (Task 5), `createClient` (`src/lib/supabase/server.ts`).
- Produces: `salvarPalpite(prev: EstadoPalpite, formData: FormData): Promise<EstadoPalpite>` onde `type EstadoPalpite = { erro?: string; ok?: string }`. `formData` traz `match_id`, `inicio_em`, `palpite_casa`, `palpite_fora`.

- [ ] **Step 1: Implementar**

Create `src/app/jogos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validar } from "@/lib/auth/validation";
import { palpiteSchema } from "@/lib/palpites/validation";
import { palpiteAberto } from "@/lib/palpites/corte";
import { getMinutosCorte } from "@/lib/predictions";

export type EstadoPalpite = { erro?: string; ok?: string };

export async function salvarPalpite(
  _prev: EstadoPalpite,
  formData: FormData
): Promise<EstadoPalpite> {
  const matchId = String(formData.get("match_id") ?? "");
  const inicioEm = String(formData.get("inicio_em") ?? "");
  if (!matchId || !inicioEm) return { erro: "Jogo inválido." };

  const v = validar(palpiteSchema, {
    palpite_casa: formData.get("palpite_casa"),
    palpite_fora: formData.get("palpite_fora"),
  });
  if (!v.sucesso) return { erro: v.erro };

  // Pré-checagem amigável (a RLS é a fonte da verdade).
  const minutosCorte = await getMinutosCorte();
  if (!palpiteAberto(inicioEm, minutosCorte)) {
    return { erro: "O prazo para palpitar neste jogo já encerrou." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login para palpitar." };

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      palpite_casa: v.dados.palpite_casa,
      palpite_fora: v.dados.palpite_fora,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );

  // Se a RLS barrar (corte/limite), o erro cai aqui.
  if (error) return { erro: "Não foi possível salvar o palpite." };

  revalidatePath("/jogos");
  return { ok: "Palpite salvo!" };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build` (ou `npx tsc --noEmit`)
Expected: compila sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/jogos/actions.ts
git commit -m "feat: Server Action salvarPalpite (upsert + corte)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Formulário de palpite + integração no card e na página

**Files:**
- Create: `src/components/jogos/palpite-form.tsx`
- Test: `src/components/jogos/__tests__/palpite-form.test.tsx`
- Modify: `src/components/jogos/match-card.tsx`
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `salvarPalpite`/`EstadoPalpite` (Task 6), `palpiteAberto` (Task 3), `Prediction` (Task 5), `Match` (`src/lib/matches.ts`), `Button` (`src/components/ui/button.tsx`).
- Produces: `PalpiteForm({ match, palpite, minutosCorte })`; `MatchCard` aceita props extras `palpite?: Prediction` e `minutosCorte: number`.

- [ ] **Step 1: Escrever o teste do formulário (falha)**

Create `src/components/jogos/__tests__/palpite-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteForm } from "@/components/jogos/palpite-form";
import type { Match } from "@/lib/matches";

vi.mock("@/app/jogos/actions", () => ({ salvarPalpite: vi.fn() }));

const base: Match = {
  id: "m1",
  fase: "grupos",
  rodada: "1",
  time_casa: "Brasil",
  time_fora: "Argentina",
  bandeira_casa: null,
  bandeira_fora: null,
  inicio_em: "2026-07-01T18:00:00.000Z",
  status: "agendado",
  placar_casa: null,
  placar_fora: null,
};

describe("PalpiteForm", () => {
  it("mostra inputs habilitados quando o corte está aberto", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={futuro} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("desabilita e avisa quando o corte passou", () => {
    const passado: Match = { ...base, inicio_em: "2000-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={passado} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).toBeDisabled();
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument();
  });

  it("preenche os valores do palpite existente", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(
      <PalpiteForm
        match={futuro}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 1, pontos: null }}
      />
    );
    expect((screen.getByLabelText(/palpite brasil/i) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/palpite argentina/i) as HTMLInputElement).value).toBe("1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- palpite-form`
Expected: FAIL (`PalpiteForm` não existe).

- [ ] **Step 3: Implementar o formulário**

Create `src/components/jogos/palpite-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarPalpite, type EstadoPalpite } from "@/app/jogos/actions";
import { palpiteAberto } from "@/lib/palpites/corte";
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";

export function PalpiteForm({
  match,
  palpite,
  minutosCorte,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte: number;
}) {
  const [estado, formAction, pending] = useActionState(
    salvarPalpite,
    {} as EstadoPalpite
  );

  const aberto = match.status === "agendado" && palpiteAberto(match.inicio_em, minutosCorte);

  if (!aberto) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Palpites encerrados
          {palpite ? `: ${palpite.palpite_casa} × ${palpite.palpite_fora}` : ""}
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="match_id" value={match.id} />
      <input type="hidden" name="inicio_em" value={match.inicio_em} />
      <span className="text-xs text-muted-foreground">Seu palpite:</span>
      <label className="sr-only" htmlFor={`casa-${match.id}`}>
        Palpite {match.time_casa}
      </label>
      <input
        id={`casa-${match.id}`}
        name="palpite_casa"
        type="number"
        min={0}
        defaultValue={palpite?.palpite_casa ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <span className="text-muted-foreground">×</span>
      <label className="sr-only" htmlFor={`fora-${match.id}`}>
        Palpite {match.time_fora}
      </label>
      <input
        id={`fora-${match.id}`}
        name="palpite_fora"
        type="number"
        min={0}
        defaultValue={palpite?.palpite_fora ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      {estado?.erro && (
        <span className="text-xs text-red-600 dark:text-red-400">{estado.erro}</span>
      )}
      {estado?.ok && <span className="text-xs text-primary">{estado.ok}</span>}
    </form>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- palpite-form`
Expected: PASS (3 testes).

- [ ] **Step 5: Integrar no `MatchCard`**

Modify `src/components/jogos/match-card.tsx` — trocar a assinatura e o final do componente para receber e renderizar o palpite. Arquivo completo:

```tsx
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";
import { PalpiteForm } from "@/components/jogos/palpite-form";

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

export function MatchCard({
  match,
  palpite,
  minutosCorte,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte: number;
}) {
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
      <PalpiteForm match={match} palpite={palpite} minutosCorte={minutosCorte} />
    </article>
  );
}
```

- [ ] **Step 6: Integrar na página `/jogos`**

Modify `src/app/jogos/page.tsx` — buscar palpites e minutos de corte e repassar. Arquivo completo:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";

export default async function JogosPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [jogos, palpites, minutosCorte] = await Promise.all([
    listarJogos(),
    listarMeusPalpites(),
    getMinutosCorte(),
  ]);

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
              <MatchCard
                key={j.id}
                match={j}
                palpite={palpites[j.id]}
                minutosCorte={minutosCorte}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 7: Rodar testes e build**

Run: `npm test`
Expected: toda a suíte passa (incluindo `corte`, `validation`, `palpite-form`).

Run: `npm run build`
Expected: build de produção compila sem erros.

- [ ] **Step 8: Verificação manual da RLS (controlador, no app em produção/local)**

1. Logado, abrir `/jogos`, registrar um palpite num jogo futuro → mensagem "Palpite salvo!".
2. Recarregar → os campos voltam preenchidos com o palpite.
3. Conferir no banco que o palpite tem o `user_id` correto:
   ```sql
   select user_id, match_id, palpite_casa, palpite_fora from public.predictions;
   ```
4. (Opcional) Verificar que um jogo já iniciado mostra "Palpites encerrados" e não permite salvar.

- [ ] **Step 9: Commit**

```bash
git add src/components/jogos/palpite-form.tsx \
  src/components/jogos/__tests__/palpite-form.test.tsx \
  src/components/jogos/match-card.tsx \
  src/app/jogos/page.tsx
git commit -m "feat: formulário de palpite por jogo com regra de corte

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Tabela `predictions` com UNIQUE(user_id, match_id) → Task 2. ✓
- `app_config` com `minutos_corte` → Task 1. ✓
- Registrar/editar palpite (upsert) → Tasks 6 e 7. ✓
- Regra de corte validada no servidor (RLS + Server Action) → Tasks 1 (função), 2 (RLS), 6 (action). ✓
- UI: campos travam após o corte e mostram placar real quando finalizado → Task 7 (`PalpiteForm` + `MatchCard`). ✓
- RLS: usuário lê/escreve só os próprios palpites → Task 2. ✓
- Teste da regra de corte (antes/depois) → Task 3. ✓
- `pontos` fica na tabela mas é calculado na Fase 4 (aqui nasce `null`). ✓ (fora de escopo desta fase)

**2. Placeholder scan:** Sem TBD/TODO; todo passo de código mostra o código completo. ✓

**3. Type consistency:** `Prediction` (Task 5) usada igual em 6/7; `EstadoPalpite` definido em 6 e importado em 7; `palpiteAberto(inicioEm, minutosCorte, agora?)` consistente entre 3, 6 e 7; `MatchCard` recebe `minutosCorte: number` (obrigatório) e `palpite?: Prediction` — `page.tsx` passa ambos. ✓

**Notas de escopo (YAGNI):** sem `delete` de palpite (editar cobre o caso); sem cálculo de pontos (Fase 4); sem leitura de palpites alheios (Fase 4/ranking).
