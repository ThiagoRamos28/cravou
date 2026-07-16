# Suporte a Múltiplas Competições — Implementation Plan (revisado)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a múltiplas competições — Copa do Mundo 2026 arquivada (histórico/ranking consultável) e Brasileirão 2026 ativo com ranking próprio zerado e opt-in de participação.

**Architecture:** `competicoes` é a fonte de verdade das competições; `matches` ganha `competicao_id` (backfill = Copa). O ranking passa a filtrar por competição via `ranking(p_competicao_id, p_periodo)` e opt-in em `profiles_competicoes`. As páginas continuam **server components** que buscam via helpers em `src/lib/*` — o `competicaoId` é **threaded** por esses helpers, sem reescrever a UI. A competição selecionada persiste em **cookie** (`competicao`), lido no servidor. `app_config`/`recalcular_pontos` **não mudam** (o modelo global por data já dá Modelo A ao Brasileirão). `sync-matches` itera as competições ativas.

**Tech Stack:** Next.js 16 (App Router, server components), TypeScript, Supabase (Postgres + RLS + Edge Functions/Deno), Tailwind v4, **Vitest** + React Testing Library.

## Global Constraints

- Idioma UI: português do Brasil, sempre. Nome do produto: `Cravou!` verbatim.
- Test runner: **Vitest** (`vi.fn()`, `import { describe, it, expect, vi } from "vitest"`). NUNCA `jest.fn()`.
- Testes co-localizados em `__tests__/` ao lado do componente.
- Timezone exibição: `America/Sao_Paulo`. Corte de temporada Copa: `timestamptz '2026-07-04 00:00:00-03'`.
- Modelo de pontuação: global por data (não mexer em `app_config`/`recalcular_pontos`/`pontos_palpite`/`palpite_aberto`).
- Slugs: Copa = `copa-mundo-2026` (formato `fases`, `ativa=false`), Brasileirão = `brasileirao-2026` (formato `pontos-corridos`, `ativa=true`).
- Páginas são **server components**; não convertê-las para client. Data-access só via `src/lib/*`.
- Componentes novos: Tailwind, dark E light, `cursor-pointer` em clicáveis, foco visível, ícones lucide (nunca emoji).
- Commits terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Branch de trabalho: `feat/multi-competicao` (já criada).

---

## Task 1: Migration — `competicoes`, `matches.competicao_id`, seed

**Files:**
- Create: `supabase/migrations/0019_competicoes.sql`

**Interfaces:**
- Produces: tabela `competicoes(id uuid, slug text unique, nome text, formato text check('fases'|'pontos-corridos'), ativa bool, fs_tournament_url text, ordem int, created_at timestamptz)`; `matches.competicao_id uuid NOT NULL references competicoes(id)`; 2 linhas seed. Copa e Brasileirão IDs resolvíveis por slug.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/0019_competicoes.sql
-- 0019 — Competições multi-torneio (Copa arquivada + Brasileirão ativo).

create table if not exists public.competicoes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  formato text not null default 'pontos-corridos'
    check (formato in ('fases', 'pontos-corridos')),
  ativa boolean not null default true,
  fs_tournament_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.competicoes (slug, nome, formato, ativa, ordem) values
  ('copa-mundo-2026', 'Copa do Mundo 2026', 'fases', false, 1),
  ('brasileirao-2026', 'Brasileirão Série A 2026', 'pontos-corridos', true, 2)
on conflict (slug) do nothing;

alter table public.matches add column if not exists competicao_id uuid references public.competicoes (id);

update public.matches
set competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
where competicao_id is null;

alter table public.matches alter column competicao_id set not null;

create index if not exists matches_competicao_id_idx on public.matches (competicao_id);

-- RLS de competicoes: leitura para autenticados, escrita só admin (mesmo padrão de app_config).
alter table public.competicoes enable row level security;

create policy "competicoes_select_authenticated"
  on public.competicoes for select
  to authenticated
  using (true);

create policy "competicoes_write_admin"
  on public.competicoes for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
```

- [ ] **Step 2: Verificar arquivo**

Run: `ls supabase/migrations/0019_competicoes.sql`
Expected: arquivo existe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_competicoes.sql
git commit -m "migration: tabela competicoes + matches.competicao_id + seed Copa/Brasileirao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Migration — `profiles_competicoes` + opt-in retroativo

**Files:**
- Create: `supabase/migrations/0020_profiles_competicoes.sql`

**Interfaces:**
- Consumes: `competicoes`, `profiles`, `predictions`, `matches.competicao_id` (Task 1)
- Produces: `profiles_competicoes(user_id, competicao_id, ativo bool, created_at, pk(user_id,competicao_id))` com RLS (dono lê/escreve as próprias linhas). Todo usuário com predictions na Copa recebe linha `ativo=true` na Copa.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/0020_profiles_competicoes.sql
-- 0020 — Opt-in de participação por competição + opt-in retroativo da Copa.

create table if not exists public.profiles_competicoes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  competicao_id uuid not null references public.competicoes (id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, competicao_id)
);

-- Opt-in retroativo: quem já palpitou na Copa continua no ranking da Copa.
insert into public.profiles_competicoes (user_id, competicao_id, ativo)
select distinct p.user_id, m.competicao_id, true
from public.predictions p
join public.matches m on m.id = p.match_id
where m.competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
on conflict (user_id, competicao_id) do nothing;

alter table public.profiles_competicoes enable row level security;

create policy "profiles_competicoes_select_own"
  on public.profiles_competicoes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_competicoes_insert_own"
  on public.profiles_competicoes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "profiles_competicoes_update_own"
  on public.profiles_competicoes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verificar arquivo**

Run: `ls supabase/migrations/0020_profiles_competicoes.sql`
Expected: existe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_profiles_competicoes.sql
git commit -m "migration: profiles_competicoes com opt-in retroativo da Copa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Migration — `ranking(p_competicao_id, p_periodo)`

**Files:**
- Create: `supabase/migrations/0021_ranking_por_competicao.sql`

**Interfaces:**
- Consumes: `profiles`, `profiles_competicoes` (ativo=true), `predictions`, `matches.competicao_id`
- Produces: `ranking(p_competicao_id uuid, p_periodo text default 'geral')` retornando as mesmas colunas de hoje (`user_id, apelido, avatar_url, pontos, cravadas, acertos_saldo, acertos_resultado, acertos_gols, erros, palpites_pontuados, total_palpites, pontos_max_total`). Só aparecem usuários com opt-in ativo naquela competição. Substitui a assinatura antiga `ranking(text)`.

**Contexto:** a versão atual (migration 0017) é `ranking(p_periodo text)`. Esta troca a assinatura para `(uuid, text)`. O único chamador é `src/lib/ranking.ts` (Task 4), atualizado em conjunto.

- [ ] **Step 1: Criar migration** (baseada na 0017, adicionando join de opt-in + filtro de competição)

```sql
-- supabase/migrations/0021_ranking_por_competicao.sql
-- 0021 — ranking(p_competicao_id, p_periodo): filtra por competição e opt-in ativo.
-- Substitui ranking(text) da 0017. p_periodo (temporada_1/2) só é relevante para a Copa
-- (formato 'fases'); Brasileirão sempre chama com 'geral'.

drop function if exists public.ranking(text);

create function public.ranking(p_competicao_id uuid, p_periodo text default 'geral')
returns table (
  user_id            uuid,
  apelido            text,
  avatar_url         text,
  pontos             bigint,
  cravadas           bigint,
  acertos_saldo      bigint,
  acertos_resultado  bigint,
  acertos_gols       bigint,
  erros              bigint,
  palpites_pontuados bigint,
  total_palpites     bigint,
  pontos_max_total   bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id,
    pr.apelido,
    pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    count(*) filter (
      where p.pontos is not null
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and m.placar_casa <> m.placar_fora
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora)
    )::bigint as acertos_saldo,
    count(*) filter (
      where p.pontos is not null
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and not (m.placar_casa <> m.placar_fora
                 and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora))
    )::bigint as acertos_resultado,
    count(*) filter (
      where p.pontos is not null
        and sign(p.palpite_casa - p.palpite_fora) <> sign(m.placar_casa - m.placar_fora)
        and (p.palpite_casa = m.placar_casa or p.palpite_fora = m.placar_fora)
    )::bigint as acertos_gols,
    count(*) filter (where p.pontos = 0)::bigint as erros,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados,
    count(p.id)::bigint as total_palpites,
    coalesce(sum(p.pontos_max), 0)::bigint as pontos_max_total
  from public.profiles pr
  join public.profiles_competicoes pc
    on pc.user_id = pr.id
   and pc.competicao_id = p_competicao_id
   and pc.ativo = true
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m
    on m.id = p.match_id
   and m.competicao_id = p_competicao_id
  where case p_periodo
    when 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
    when 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;

revoke execute on function public.ranking(uuid, text) from public, anon;
grant execute on function public.ranking(uuid, text) to authenticated;
```

- [ ] **Step 2: Verificar arquivo**

Run: `ls supabase/migrations/0021_ranking_por_competicao.sql`
Expected: existe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_ranking_por_competicao.sql
git commit -m "migration: ranking(competicao_id, periodo) com opt-in ativo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `src/lib/competicoes.ts` + threading em `ranking.ts` e `matches.ts`

**Files:**
- Create: `src/lib/competicoes.ts`
- Create: `src/lib/__tests__/competicoes.test.ts`
- Modify: `src/lib/ranking.ts`
- Modify: `src/lib/matches.ts:21-53` (assinatura de `listarJogos`)

**Interfaces:**
- Produces:
  - Tipo `Competicao = { id: string; slug: string; nome: string; formato: 'fases' | 'pontos-corridos'; ativa: boolean; ordem: number }`
  - `listarCompeticoes(): Promise<Competicao[]>` — todas, ordenadas por `ordem`. Falha aberta: `[]`.
  - `competicoesVisiveis(todas: Competicao[], slugsComOptIn: string[]): Competicao[]` — pura, testável: ativas ∪ competições onde o usuário tem opt-in. Ordenada por `ordem`.
  - `COOKIE_COMPETICAO = "competicao"` (constante do nome do cookie, valor = slug)
  - `resolverCompeticao(todas: Competicao[], slugCookie: string | undefined): Competicao | undefined` — pura: retorna a do cookie se existir e visível, senão a `ativa` de maior `ordem`, senão a primeira.
  - `listarRanking(competicaoId, periodo)` (assinatura NOVA — ver abaixo)
  - `listarJogos({ ..., competicaoId })` (campo NOVO no filtro)
- Consumes: `ranking(p_competicao_id, p_periodo)` (Task 3), `matches.competicao_id` (Task 1)

- [ ] **Step 1: Escrever teste das funções puras**

```typescript
// src/lib/__tests__/competicoes.test.ts
import { describe, it, expect } from "vitest";
import { competicoesVisiveis, resolverCompeticao, type Competicao } from "@/lib/competicoes";

const copa: Competicao = { id: "c1", slug: "copa-mundo-2026", nome: "Copa", formato: "fases", ativa: false, ordem: 1 };
const bra: Competicao = { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão", formato: "pontos-corridos", ativa: true, ordem: 2 };

describe("competicoesVisiveis", () => {
  it("inclui ativas e as com opt-in, ordenadas por ordem", () => {
    expect(competicoesVisiveis([copa, bra], ["copa-mundo-2026"])).toEqual([copa, bra]);
  });
  it("exclui inativa sem opt-in", () => {
    expect(competicoesVisiveis([copa, bra], [])).toEqual([bra]);
  });
});

describe("resolverCompeticao", () => {
  it("usa o cookie quando aponta para competição visível", () => {
    expect(resolverCompeticao([copa, bra], "copa-mundo-2026")).toEqual(copa);
  });
  it("cai na ativa de maior ordem quando sem cookie", () => {
    expect(resolverCompeticao([copa, bra], undefined)).toEqual(bra);
  });
  it("ignora cookie inválido", () => {
    expect(resolverCompeticao([copa, bra], "inexistente")).toEqual(bra);
  });
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `npm test -- competicoes`
Expected: FAIL (módulo/função inexistente).

- [ ] **Step 3: Implementar `src/lib/competicoes.ts`**

```typescript
// src/lib/competicoes.ts
import { createClient } from "@/lib/supabase/server";

export type Competicao = {
  id: string;
  slug: string;
  nome: string;
  formato: "fases" | "pontos-corridos";
  ativa: boolean;
  ordem: number;
};

export const COOKIE_COMPETICAO = "competicao";

const COLS = "id, slug, nome, formato, ativa, ordem";

// Todas as competições, ordenadas por `ordem`. Falha aberta: [] em erro.
export async function listarCompeticoes(): Promise<Competicao[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("competicoes").select(COLS).order("ordem");
    return (data as Competicao[]) ?? [];
  } catch {
    return [];
  }
}

// Pura: ativas ∪ competições onde o usuário fez opt-in (por slug). Ordenada por `ordem`.
export function competicoesVisiveis(
  todas: Competicao[],
  slugsComOptIn: string[]
): Competicao[] {
  const set = new Set(slugsComOptIn);
  return todas
    .filter((c) => c.ativa || set.has(c.slug))
    .sort((a, b) => a.ordem - b.ordem);
}

// Pura: competição selecionada — cookie válido, senão ativa de maior ordem, senão a 1ª.
export function resolverCompeticao(
  todas: Competicao[],
  slugCookie: string | undefined
): Competicao | undefined {
  if (slugCookie) {
    const doCookie = todas.find((c) => c.slug === slugCookie);
    if (doCookie) return doCookie;
  }
  const ativas = todas.filter((c) => c.ativa).sort((a, b) => b.ordem - a.ordem);
  return ativas[0] ?? todas[0];
}

// Slugs de competições em que o usuário logado tem opt-in ativo. Falha aberta: [].
export async function meusOptIns(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("profiles_competicoes")
      .select("ativo, competicoes(slug)")
      .eq("user_id", user.id)
      .eq("ativo", true);
    return (
      (data as { competicoes: { slug: string } | null }[] | null) ?? []
    )
      .map((r) => r.competicoes?.slug)
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `npm test -- competicoes`
Expected: PASS.

- [ ] **Step 5: Atualizar `src/lib/ranking.ts`** (assinatura + RPC)

Substituir a função `listarRanking` (linhas 22-32) por:

```typescript
// Ranking de uma competição, já ordenado. Falha aberta: [] em erro.
export async function listarRanking(
  competicaoId: string,
  periodo: RankingPeriodo = "geral"
): Promise<RankingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking", {
      p_competicao_id: competicaoId,
      p_periodo: periodo,
    });
    return (data as RankingRow[]) ?? [];
  } catch {
    return [];
  }
}
```

(Mantém `RankingRow`, `RankingPeriodo` inalterados.)

- [ ] **Step 6: Atualizar `src/lib/matches.ts`** — aceitar `competicaoId` no filtro

Em `listarJogos` (linha 21), adicionar `competicaoId?: string;` ao objeto de filtro e, logo após `let q = ...` (linha 31), inserir:

```typescript
    if (filtro?.competicaoId) q = q.eq("competicao_id", filtro.competicaoId);
```

- [ ] **Step 7: Rodar suíte inteira + typecheck**

Run: `npm test`
Expected: testes de `competicoes` passam; nada quebra.
Run: `npm run build`
Expected: **irá falhar** nos chamadores de `listarRanking`/`listarJogos` que ainda passam a assinatura antiga — esses são corrigidos nas Tasks 6-9. Anotar os erros e prosseguir (não corrigir páginas aqui).

> Nota ao implementer: NÃO altere páginas nesta task. A quebra de tipo nos chamadores é esperada e será resolvida nas tasks de página. Comite apenas `src/lib/*`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/competicoes.ts src/lib/__tests__/competicoes.test.ts src/lib/ranking.ts src/lib/matches.ts
git commit -m "feat: lib competicoes + threading de competicaoId em ranking/matches

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `CompeticaoSelector` (client, cookie + refresh)

**Files:**
- Create: `src/components/competicao/competicao-selector.tsx`
- Create: `src/components/competicao/__tests__/competicao-selector.test.tsx`

**Interfaces:**
- Consumes: `Competicao` (Task 4), `COOKIE_COMPETICAO`
- Produces: `<CompeticaoSelector competicoes={Competicao[]} selecionadaId={string} />` — client component. Ao mudar: grava cookie `competicao=<slug>` (path=/, max-age 1 ano) e chama `router.refresh()`. Se `competicoes.length <= 1`, não renderiza nada (não há o que trocar).

- [ ] **Step 1: Escrever teste**

```typescript
// src/components/competicao/__tests__/competicao-selector.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompeticaoSelector } from "../competicao-selector";
import type { Competicao } from "@/lib/competicoes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const comps: Competicao[] = [
  { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 },
  { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 },
];

describe("CompeticaoSelector", () => {
  it("lista as competições e marca a selecionada", () => {
    render(<CompeticaoSelector competicoes={comps} selecionadaId="c2" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("c2");
    expect(screen.getByRole("option", { name: "Copa do Mundo 2026" })).toBeInTheDocument();
  });

  it("não renderiza com uma só competição", () => {
    const { container } = render(<CompeticaoSelector competicoes={[comps[1]]} selecionadaId="c2" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `npm test -- competicao-selector`
Expected: FAIL (componente inexistente).

- [ ] **Step 3: Implementar**

```tsx
// src/components/competicao/competicao-selector.tsx
"use client";

import { useRouter } from "next/navigation";
import { COOKIE_COMPETICAO, type Competicao } from "@/lib/competicoes";

export function CompeticaoSelector({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const router = useRouter();

  if (competicoes.length <= 1) return null;

  function aoTrocar(e: React.ChangeEvent<HTMLSelectElement>) {
    const comp = competicoes.find((c) => c.id === e.target.value);
    if (!comp) return;
    // Cookie de 1 ano, escopo raiz. Lido no servidor para renderizar a competição certa.
    document.cookie = `${COOKIE_COMPETICAO}=${comp.slug}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Competição</span>
      <select
        value={selecionadaId}
        onChange={aoTrocar}
        aria-label="Selecionar competição"
        className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {competicoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `npm test -- competicao-selector`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/competicao/
git commit -m "feat: CompeticaoSelector (cookie + router.refresh)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Integrar seletor no header + resolver competição no ranking

**Files:**
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/ranking/page.tsx`
- Modify: `src/app/ranking/actions.ts`
- Modify: `src/components/ranking/ranking-content.tsx`

**Interfaces:**
- Consumes: `listarCompeticoes`, `meusOptIns`, `competicoesVisiveis`, `resolverCompeticao`, `COOKIE_COMPETICAO` (Task 4); `CompeticaoSelector` (Task 5); `listarRanking(competicaoId, periodo)` (Task 4)
- Produces:
  - `site-header.tsx` renderiza `<CompeticaoSelector>` (server component lê cookie + competições visíveis e passa como props) e um link para `/perfil/competicoes`.
  - `ranking/page.tsx` resolve competição via cookie e chama `listarRanking(comp.id, "geral")`, passando `comp` para `RankingContent`.
  - `buscarRanking(competicaoId, periodo)` — server action com competição explícita.
  - `RankingContent` recebe `competicao: Competicao` e só mostra `<SeasonSelector>` quando `competicao.formato === "fases"`.

- [ ] **Step 1: Ler os arquivos atuais** para preservar layout/props.

Run: `sed -n '1,80p' src/components/site-header.tsx`
(O implementer deve inserir o seletor sem quebrar o header existente — provavelmente ao lado do theme-toggle.)

- [ ] **Step 2: `site-header.tsx`** — buscar competições visíveis e renderizar o seletor

Como o header já é usado em páginas server, torná-lo `async` server component (se ainda não for) e no topo:

```tsx
import { cookies } from "next/headers";
import { CompeticaoSelector } from "@/components/competicao/competicao-selector";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

// dentro do componente async:
const [todas, optIns, cookieStore] = await Promise.all([
  listarCompeticoes(),
  meusOptIns(),
  cookies(),
]);
const visiveis = competicoesVisiveis(todas, optIns);
const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
```

E no JSX, junto aos controles do header:

```tsx
{atual && <CompeticaoSelector competicoes={visiveis} selecionadaId={atual.id} />}
<a href="/perfil/competicoes" className="text-sm text-muted-foreground hover:text-foreground">
  Minhas competições
</a>
```

> Se `site-header.tsx` hoje for síncrono/client, o implementer deve extrair a busca para o server component pai OU tornar o header async (é usado em páginas server). Decidir preservando o comportamento atual; não quebrar navegação/theme-toggle.

- [ ] **Step 3: `ranking/page.tsx`** — resolver competição e passar para o conteúdo

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RankingContent } from "@/components/ranking/ranking-content";
import { getSessao } from "@/lib/auth/profile";
import { listarRanking } from "@/lib/ranking";
import {
  listarCompeticoes, meusOptIns, competicoesVisiveis, resolverCompeticao, COOKIE_COMPETICAO,
} from "@/lib/competicoes";

export default async function RankingPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(), meusOptIns(), cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);

  const linhas = atual ? await listarRanking(atual.id, "geral") : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Ranking
        </h1>
        {atual ? (
          <RankingContent linhasIniciais={linhas} meuId={sessao.userId} competicao={atual} />
        ) : (
          <p className="text-muted-foreground">Nenhuma competição disponível.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 4: `ranking/actions.ts`** — competição explícita

```typescript
"use server";

import { listarRanking, type RankingPeriodo, type RankingRow } from "@/lib/ranking";

const PERIODOS: RankingPeriodo[] = ["geral", "temporada_1", "temporada_2"];

export async function buscarRanking(
  competicaoId: string,
  periodo: string
): Promise<RankingRow[]> {
  const p: RankingPeriodo = (PERIODOS as string[]).includes(periodo)
    ? (periodo as RankingPeriodo)
    : "geral";
  return listarRanking(competicaoId, p);
}
```

- [ ] **Step 5: `ranking-content.tsx`** — receber `competicao`, condicionar SeasonSelector

Alterar a assinatura e o corpo:

```tsx
import type { Competicao } from "@/lib/competicoes";
// ...
export function RankingContent({
  linhasIniciais,
  meuId,
  competicao,
}: {
  linhasIniciais: RankingRow[];
  meuId: string;
  competicao: Competicao;
}) {
  const [periodo, setPeriodo] = useState<RankingPeriodo>("geral");
  const [linhas, setLinhas] = useState<RankingRow[]>(linhasIniciais);
  const [carregando, setCarregando] = useState(false);
  const periodoAtualRef = useRef<RankingPeriodo>("geral");

  async function aoTrocarPeriodo(novoPeriodo: RankingPeriodo) {
    setPeriodo(novoPeriodo);
    periodoAtualRef.current = novoPeriodo;
    setCarregando(true);
    try {
      const resultado = await buscarRanking(competicao.id, novoPeriodo);
      if (periodoAtualRef.current === novoPeriodo) setLinhas(resultado);
    } catch {
      // falha aberta
    } finally {
      if (periodoAtualRef.current === novoPeriodo) setCarregando(false);
    }
  }

  return (
    <div>
      {competicao.formato === "fases" && (
        <SeasonSelector periodo={periodo} onChange={aoTrocarPeriodo} />
      )}
      {/* resto inalterado: skeleton / vazio / Podium+Tabela */}
      {/* ... */}
    </div>
  );
}
```

(O restante do corpo — skeletons, estado vazio, `Podium`/`RankingTable`/`RankingListaMobile` — permanece exatamente como está hoje.)

- [ ] **Step 6: Rodar testes + build**

Run: `npm test`
Expected: PASS (inclusive testes existentes de ranking-content, se houver — ajustar mocks para a nova prop `competicao` se algum teste renderizar `RankingContent`).
Run: `npm run build`
Expected: ranking compila. Jogos/histórico ainda podem quebrar (Tasks 7-9). Anotar.

- [ ] **Step 7: Commit**

```bash
git add src/components/site-header.tsx src/app/ranking/ src/components/ranking/ranking-content.tsx
git commit -m "feat: seletor de competicao no header + ranking por competicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `/jogos` filtra por competição + card de opt-in

**Files:**
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `listarJogos({ competicaoId })` (Task 4), resolvedor de competição (Task 4), `meusOptIns` (Task 4)
- Produces: página de jogos filtra `matches` pela competição atual. Se o usuário não tem opt-in na competição atual, mostra card "Você ainda não está participando de {nome} — ative em Minhas competições" no lugar da lista. Título deixa de ser fixo "Jogos da Copa" e passa a usar o nome da competição.

- [ ] **Step 1: Atualizar `jogos/page.tsx`**

Resolver a competição atual (mesmo trio `listarCompeticoes`/`meusOptIns`/cookie) e:
- passar `competicaoId: atual.id` para `listarJogos(...)`;
- se `atual` não estiver nos `optIns`, renderizar o card de opt-in (com link para `/perfil/competicoes`) em vez da grade;
- trocar o `<h1>` de `"Jogos da Copa"` para `{atual?.nome ?? "Jogos"}`.

```tsx
// trecho-chave — manter todo o resto (searchParams, filtros, MatchCard) intacto
import { cookies } from "next/headers";
import {
  listarCompeticoes, meusOptIns, competicoesVisiveis, resolverCompeticao, COOKIE_COMPETICAO,
} from "@/lib/competicoes";

// ... dentro do componente, após checar sessão:
const [todas, optIns, cookieStore] = await Promise.all([
  listarCompeticoes(), meusOptIns(), cookies(),
]);
const visiveis = competicoesVisiveis(todas, optIns);
const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
const participando = atual ? optIns.includes(atual.slug) : false;

// título:
<h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
  {atual?.nome ?? "Jogos"}
</h1>

// se não participa, no lugar de <JogosFiltro/> + grade:
{!participando ? (
  <div className="rounded-2xl border border-border bg-card p-6 text-center">
    <p className="mb-3 text-muted-foreground">
      Você ainda não está participando de <strong className="text-foreground">{atual?.nome}</strong>.
    </p>
    <a href="/perfil/competicoes" className="font-display font-semibold uppercase tracking-tight text-accent hover:underline">
      Ativar participação
    </a>
  </div>
) : (
  /* JogosFiltro + grade existentes, agora com listarJogos({ ..., competicaoId: atual.id }) */
)}
```

O `listarJogos(...)` passa a incluir `competicaoId: atual?.id` no objeto de filtro (só busca se `atual` existir; senão lista vazia).

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: `/jogos` compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/jogos/page.tsx
git commit -m "feat: /jogos filtra por competicao + card de opt-in

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `/historico` filtra por competição

**Files:**
- Modify: `src/app/historico/page.tsx`

**Interfaces:**
- Consumes: `listarJogos({ competicaoId })`, resolvedor de competição
- Produces: histórico só considera jogos da competição atual (passa `competicaoId` ao `listarJogos()`). Resto (filtro finalizado+palpite, Resumo, HistoricoItem) inalterado.

- [ ] **Step 1: Atualizar `historico/page.tsx`**

Resolver competição atual e trocar:

```tsx
const [jogos, palpites] = await Promise.all([listarJogos(), listarMeusPalpites()]);
```

por (com a resolução de competição acima):

```tsx
const [jogos, palpites] = await Promise.all([
  atual ? listarJogos({ competicaoId: atual.id }) : Promise.resolve([]),
  listarMeusPalpites(),
]);
```

(Adicionar o trio de resolução `listarCompeticoes`/`meusOptIns`/cookie + `resolverCompeticao` como nas tasks anteriores.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `/historico` compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/historico/page.tsx
git commit -m "feat: /historico filtra por competicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `/regras` — rótulo por competição

**Files:**
- Modify: `src/app/regras/page.tsx`

**Interfaces:**
- Consumes: resolvedor de competição
- Produces: página de regras mostra o nome da competição atual num subtítulo. Como o modelo é global (Modelo A), o conteúdo de pontuação **não muda por competição**; para o Brasileirão, esconder a nota específica de "Temporada 1/2 da Copa" (que só faz sentido para `formato = 'fases'`).

- [ ] **Step 1: Tornar `regras/page.tsx` async e resolver competição**

Adicionar o trio de resolução. Sob o `<h1>`, inserir um subtítulo com `{atual?.nome}`. Envolver os dois blocos que falam de "Temporada 1/Temporada 2" e "Mudança de pontuação em 04/07/2026" em `{atual?.formato === "fases" && ( ... )}` — para o Brasileirão eles não aparecem.

```tsx
export default async function RegrasPage() {
  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(), meusOptIns(), cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
  // ... render; usar {atual?.nome} no subtítulo e condicionar os blocos da Copa a atual?.formato === "fases"
}
```

(O array `NIVEIS` e a estrutura visual permanecem. Só o texto introdutório que hoje afirma "valores da Temporada 2 — Mata-mata" deve virar condicional: para pontos-corridos, dizer apenas que os valores abaixo são os vigentes.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `/regras` compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/regras/page.tsx
git commit -m "feat: /regras com rotulo de competicao e nota da Copa condicional

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Tela `/perfil/competicoes` (opt-in/opt-out)

**Files:**
- Create: `src/app/perfil/competicoes/page.tsx`
- Create: `src/app/perfil/competicoes/actions.ts`

**Interfaces:**
- Consumes: `listarCompeticoes` (Task 4); auth via `supabase.auth.getUser()`
- Produces:
  - `alternarParticipacao(competicaoId: string, ativo: boolean)` — server action que faz upsert em `profiles_competicoes(user_id, competicao_id, ativo)` (onConflict `user_id,competicao_id`) e `revalidatePath("/perfil/competicoes")`. Erro → `{ erro }`.
  - Página lista todas as competições com o estado atual de participação do usuário e um botão/toggle por competição (form + server action). Marca "Ativa"/"Encerrada".

- [ ] **Step 1: `actions.ts`**

```typescript
// src/app/perfil/competicoes/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function alternarParticipacao(competicaoId: string, ativo: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login." };

  const { error } = await supabase
    .from("profiles_competicoes")
    .upsert(
      { user_id: user.id, competicao_id: competicaoId, ativo },
      { onConflict: "user_id,competicao_id" }
    );

  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/perfil/competicoes");
  return { ok: true };
}
```

- [ ] **Step 2: `page.tsx`** (server component; estado de participação lido direto)

```tsx
// src/app/perfil/competicoes/page.tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessao } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { listarCompeticoes } from "@/lib/competicoes";
import { alternarParticipacao } from "./actions";

export default async function CompeticoesPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const supabase = await createClient();
  const [competicoes, { data: participacoes }] = await Promise.all([
    listarCompeticoes(),
    supabase.from("profiles_competicoes").select("competicao_id, ativo").eq("user_id", sessao.userId),
  ]);
  const ativoPor = new Map(
    (participacoes as { competicao_id: string; ativo: boolean }[] | null ?? []).map((p) => [p.competicao_id, p.ativo])
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight">
          Minhas competições
        </h1>
        <p className="mb-8 text-muted-foreground">
          Ative sua participação para palpitar e aparecer no ranking de cada competição.
        </p>
        <ul className="flex flex-col gap-3">
          {competicoes.map((c) => {
            const participando = ativoPor.get(c.id) ?? false;
            return (
              <li key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-tight">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.ativa ? "Ativa" : "Encerrada"}</p>
                </div>
                <form action={async () => { "use server"; await alternarParticipacao(c.id, !participando); }}>
                  <button
                    type="submit"
                    className={`cursor-pointer rounded-lg px-4 py-2 font-display text-sm font-semibold uppercase tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      participando
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {participando ? "Participando" : "Ativar"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: rota compila.

- [ ] **Step 4: Commit**

```bash
git add src/app/perfil/competicoes/
git commit -m "feat: tela /perfil/competicoes para opt-in/opt-out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `sync-matches` — loop multi-competição

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: `competicoes` (`id, slug, fs_tournament_url, formato`), `sync_cache` (chave text), `matches.competicao_id`
- Produces:
  - A função busca `select id, slug, fs_tournament_url, formato from competicoes where ativa = true` e itera cada uma.
  - Usa `fs_tournament_url` da linha no lugar do secret `FS_TOURNAMENT_URL` (fallback: se `fs_tournament_url` for null, usa o secret — compat).
  - `formato = 'fases'`: mantém a detecção de stages atual (grupos/mata-mata).
  - `formato = 'pontos-corridos'`: pula stages; `fase = 'pontos-corridos'`, `rodada` = número da rodada extraído da resposta de fixtures/results (confirmar o campo exato inspecionando a resposta real da FlashScore ao implementar).
  - Todo upsert em `matches` inclui `competicao_id`.
  - Chaves de `sync_cache` prefixadas: `${competicaoId}:<chave-antiga>`.

**Nota ao implementer:** este é o arquivo mais complexo. Leia-o inteiro primeiro. Preserve o tratamento existente de 429/quota/timeout e o cache de stages — apenas parametrize por competição. NÃO reescreva a lógica de pontuação/decisão (90min/prorrogação); ela é ortogonal.

- [ ] **Step 1: Ler o arquivo inteiro e mapear pontos de acoplamento**

Run: `wc -l supabase/functions/sync-matches/index.ts` e leia-o.
Identifique: onde `FS_TOURNAMENT_URL` é lido; onde `sync_cache` é lido/escrito (chaves); todos os `.from("matches").upsert/insert/update`; onde stages são detectados.

- [ ] **Step 2: Extrair a lógica de uma competição para `syncCompeticao(comp)`**

Envolva o corpo atual numa função que recebe `{ id, slug, fs_tournament_url, formato }`. No handler principal:

```typescript
const { data: competicoes, error } = await supabase
  .from("competicoes")
  .select("id, slug, fs_tournament_url, formato")
  .eq("ativa", true);
if (error) throw error;

for (const comp of competicoes ?? []) {
  await syncCompeticao(comp);  // sequencial: preserva rate-limit atual
}
```

- [ ] **Step 3: Parametrizar URL, cache e upserts**

- URL: `const url = comp.fs_tournament_url ?? Deno.env.get("FS_TOURNAMENT_URL");`
- Cache: toda chave vira `` `${comp.id}:${chaveAntiga}` `` nas chamadas a `sync_cache`.
- Upserts de `matches`: adicionar `competicao_id: comp.id` no objeto.
- Stages: `if (comp.formato === "fases") { /* detecção atual */ } else { fase = "pontos-corridos"; rodada = <extraído da fixture>; }`

- [ ] **Step 4: Validar sintaxe (Deno)**

Run: `deno check supabase/functions/sync-matches/index.ts` (se deno disponível) — senão, revisão manual + `npx supabase functions deploy sync-matches --no-verify-jwt` fica para o passo de deploy manual do usuário.
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "refactor: sync-matches loop multi-competicao (formato fases/pontos-corridos)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Validação final (migrations, testes, build, fumaça)

**Files:** nenhum (validação).

- [ ] **Step 1: Aplicar migrations**

Run: `npx supabase db push` (ou via MCP `apply_migration` por arquivo, 0019→0021).
Expected: 0019, 0020, 0021 aplicam sem erro.

- [ ] **Step 2: Sanidade SQL** (Supabase Studio / execute_sql)

```sql
-- competições existem e Copa tem os jogos
select slug, ativa, (select count(*) from matches m where m.competicao_id = c.id) as jogos
from competicoes c order by ordem;

-- ranking da Copa não mistura Brasileirão; assinatura nova funciona
select count(*) from ranking((select id from competicoes where slug='copa-mundo-2026'), 'geral');
select count(*) from ranking((select id from competicoes where slug='brasileirao-2026'), 'geral');

-- opt-in retroativo cobriu quem palpitou na Copa
select count(*) from profiles_competicoes
where competicao_id = (select id from competicoes where slug='copa-mundo-2026') and ativo;
```
Expected: Copa com jogos > 0; Brasileirão ranking 0 (sem jogos/opt-in ainda); opt-in retroativo > 0.

- [ ] **Step 3: Testes**

Run: `npm test`
Expected: todos passam (incl. `competicoes`, `competicao-selector`, e os existentes).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: zero erros de tipo (todos os chamadores de `listarRanking`/`listarJogos` já atualizados).

- [ ] **Step 5: Fumaça no browser** (`npm run dev`)

1. Header mostra o seletor de competição (2 opções) + "Minhas competições".
2. `/ranking` default = Brasileirão; sem SeasonSelector. Trocar para Copa → SeasonSelector T1/T2/Geral aparece e o pódio da Copa carrega.
3. Trocar competição no header e recarregar (F5) → seleção persiste (cookie).
4. `/perfil/competicoes` → "Ativar" Brasileirão; voltar a `/jogos` → some o card de opt-in (mostra jogos ou "nenhum jogo" se sync ainda não rodou).
5. `/regras`: Brasileirão sem a nota de Temporada 1/2; Copa com a nota.
6. Dark e light: seletor e card de opt-in legíveis em ambos.

- [ ] **Step 6: Commit de validação**

```bash
git commit --allow-empty -m "test: validacao multi-competicao (migrations, npm test, build, fumaca)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Resumo

12 tarefas: **3 migrations** (competições+FK / opt-in / ranking), **1 lib** (tipos + threading), **1 componente** (seletor), **5 integrações de página** (header+ranking, jogos, histórico, regras, tela de opt-in), **1 Edge Function** (sync loop) e **validação**. `app_config`/`recalcular_pontos` intocados. Cada task commita sozinha; ao fim, Copa arquivada e Brasileirão ativo coexistem com rankings, opt-in, sync e seletor por cookie.
