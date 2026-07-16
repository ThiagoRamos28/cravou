# Suporte a Múltiplas Competições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-competition support (Copa do Mundo 2026 archived, Brasileirão 2026 active with separate ranking and opt-in participation).

**Architecture:** Introduce `competicoes` table as the source of truth for active tournaments, backfill existing Copa matches, make `app_config` and `ranking()` competition-aware, generalize `sync-matches` to loop over active competitions, and add a competition selector component shared across palpites/historico/ranking/regras pages. User opt-in via `profiles_competicoes` determines ranking visibility per competition.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + RLS + Edge Functions), Tailwind CSS v4, Framer Motion, TDD for migrations.

## Global Constraints

- Idioma UI: português do Brasil, sempre
- Mensagens de commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Timezone: `America/Sao_Paulo` para exibição ao usuário
- Modelos pontuação: Modelo A (15/7/4/1) aplicável a ambas competições; mesmas regras de corte (10 min)
- Nomes fixture: Copa = `'Copa do Mundo 2026'` (format fases), Brasileirão = `'Brasileirão Série A 2026'` (format pontos-corridos)
- Dark/light theme: todo componente novo deve funcionar em ambos
- `prefers-reduced-motion`: Framer Motion anima respeitando essa preferência

---

## Task 1: Migration — `competicoes` table, `matches.competicao_id`, seed

**Files:**
- Create: `supabase/migrations/0019_competicoes.sql`

**Interfaces:**
- Produces: 
  - `competicoes` table with columns: `id (uuid)`, `slug (text unique)`, `nome (text)`, `formato (text enum: 'fases'/'pontos-corridos')`, `ativa (boolean)`, `fs_tournament_url (text)`, `ordem (int)`, `created_at (timestamptz)`
  - `matches.competicao_id (uuid)` NOT NULL FK to `competicoes.id`
  - Two seeded rows: Copa (ativa=false, ordem=1), Brasileirão (ativa=true, ordem=2)

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/0019_competicoes.sql
-- 0019 — Tabela de competições multi-torneio para Copa + Brasileirão

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

-- Seed inicial: Copa (encerrada) e Brasileirão (ativa)
insert into public.competicoes (slug, nome, formato, ativa, ordem) values
  ('copa-mundo-2026', 'Copa do Mundo 2026', 'fases', false, 1),
  ('brasileirao-2026', 'Brasileirão Série A 2026', 'pontos-corridos', true, 2);

-- Adicionar coluna competicao_id em matches
alter table public.matches add column competicao_id uuid references public.competicoes (id);

-- Backfill: todos os jogos existentes são da Copa
update public.matches 
set competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
where competicao_id is null;

-- NOT NULL constraint agora seguro
alter table public.matches alter column competicao_id set not null;

-- Index para queries filtradas por competição
create index if not exists matches_competicao_id_idx on public.matches (competicao_id);

-- RLS: matches já tem policies, não precisa mudar nada (leitura pública para autenticados)
```

- [ ] **Step 2: Validate migration file path and content**

Expected: File exists at `supabase/migrations/0019_competicoes.sql` with seed and FK definitions.

```bash
ls -la supabase/migrations/0019_competicoes.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_competicoes.sql
git commit -m "migration: adicionar tabela competicoes + matches.competicao_id + seed Copa/Brasileirao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Migration — `app_config` per-competition, `palpite_aberto()` updated

**Files:**
- Create: `supabase/migrations/0020_app_config_por_competicao.sql`

**Interfaces:**
- Consumes: `competicoes` table with id, slug; `matches` with `competicao_id`
- Produces: 
  - `app_config` with composite PK `(competicao_id, chave)` 
  - `palpite_aberto(match_id)` returns boolean, resolves competition from `matches.competicao_id`
  - Both Copa and Brasileirão seeded with Modelo A values (15/7/4/1, corte 10 min)

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/0020_app_config_por_competicao.sql
-- 0020 — app_config ganha competicao_id; palpite_aberto respeita config por competição

-- Remover constraint atual (chave como PK único)
alter table public.app_config drop constraint if exists app_config_pkey;

-- Adicionar competicao_id
alter table public.app_config add column competicao_id uuid references public.competicoes (id) on delete cascade;

-- Nova PK composta
alter table public.app_config add primary key (competicao_id, chave);

-- Backfill: copiar linhas atuais (sem competicao_id) para a Copa
-- Primeiro, pega a ID da Copa
insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'minutos_corte',
  10
from public.competicoes c
where c.slug = 'copa-mundo-2026'
  and not exists (select 1 from public.app_config where competicao_id = c.id and chave = 'minutos_corte')
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_placar_exato',
  15
from public.competicoes c
where c.slug = 'copa-mundo-2026'
  and not exists (select 1 from public.app_config where competicao_id = c.id and chave = 'pts_placar_exato')
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_resultado',
  7
from public.competicoes c
where c.slug = 'copa-mundo-2026'
  and not exists (select 1 from public.app_config where competicao_id = c.id and chave = 'pts_resultado')
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_saldo',
  4
from public.competicoes c
where c.slug = 'copa-mundo-2026'
  and not exists (select 1 from public.app_config where competicao_id = c.id and chave = 'pts_saldo')
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_time_marca',
  1
from public.competicoes c
where c.slug = 'copa-mundo-2026'
  and not exists (select 1 from public.app_config where competicao_id = c.id and chave = 'pts_time_marca')
on conflict do nothing;

-- Agora seed Brasileirão com os mesmos valores
insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'minutos_corte',
  10
from public.competicoes c
where c.slug = 'brasileirao-2026'
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_placar_exato',
  15
from public.competicoes c
where c.slug = 'brasileirao-2026'
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_resultado',
  7
from public.competicoes c
where c.slug = 'brasileirao-2026'
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_saldo',
  4
from public.competicoes c
where c.slug = 'brasileirao-2026'
on conflict do nothing;

insert into public.app_config (competicao_id, chave, valor)
select 
  c.id,
  'pts_time_marca',
  1
from public.competicoes c
where c.slug = 'brasileirao-2026'
on conflict do nothing;

-- Atualizar palpite_aberto(match_id) para resolver competicao a partir do jogo
drop function if exists public.palpite_aberto(uuid);

create function public.palpite_aberto(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select now() < m.inicio_em - make_interval(
    mins => coalesce(
      (select ac.valor 
       from public.app_config ac
       where ac.competicao_id = m.competicao_id 
         and ac.chave = 'minutos_corte'),
      10
    )
  )
  from public.matches m
  where m.id = p_match_id;
$$;

-- RLS não muda: app_config é read-only para autenticados, write-only para admin
```

- [ ] **Step 2: Verify SQL syntax**

```bash
cd supabase/migrations && head -50 0020_app_config_por_competicao.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_app_config_por_competicao.sql
git commit -m "migration: app_config por competicao + palpite_aberto atualizado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Migration — `profiles_competicoes` opt-in table + retroactive opt-in for Copa participants

**Files:**
- Create: `supabase/migrations/0021_profiles_competicoes.sql`

**Interfaces:**
- Consumes: `profiles`, `competicoes`, `predictions`, `matches` with `competicao_id`
- Produces: 
  - `profiles_competicoes` table: `(user_id, competicao_id, ativo, created_at)` as PK
  - Retroactive opt-in: all users with predictions on Copa matches get auto-enrolled with `ativo = true`

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/0021_profiles_competicoes.sql
-- 0021 — Tabela profiles_competicoes + opt-in retroativo para participantes da Copa

create table if not exists public.profiles_competicoes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  competicao_id uuid not null references public.competicoes (id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, competicao_id)
);

-- Retroactive opt-in: qualquer usuário com palpites na Copa fica ativo na Copa
insert into public.profiles_competicoes (user_id, competicao_id, ativo)
select distinct
  p.user_id,
  m.competicao_id,
  true
from public.predictions p
join public.matches m on m.id = p.match_id
where m.competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
on conflict (user_id, competicao_id) do nothing;

-- RLS: users veem suas próprias linhas
alter table public.profiles_competicoes enable row level security;

create policy "profiles_competicoes_select_own"
  on public.profiles_competicoes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_competicoes_update_own"
  on public.profiles_competicoes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_competicoes_insert_own"
  on public.profiles_competicoes for insert
  to authenticated
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verify migration**

```bash
cd supabase && wc -l migrations/0021_profiles_competicoes.sql
```

Expected: ~40 lines

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_profiles_competicoes.sql
git commit -m "migration: profiles_competicoes com opt-in retroativo para Copa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Migration — `ranking(p_competicao_id, p_periodo)` SQL function

**Files:**
- Create: `supabase/migrations/0022_ranking_por_competicao.sql`

**Interfaces:**
- Consumes: `profiles`, `profiles_competicoes` (ativo=true), `predictions`, `matches` (competicao_id), `app_config`
- Produces: 
  - `ranking(p_competicao_id uuid, p_periodo text = 'geral')` returns table with user_id, apelido, avatar_url, pontos, cravadas, acertos_*, erros, palpites_pontuados, total_palpites, pontos_max_total
  - Only users with `profiles_competicoes.ativo = true` appear
  - Filters matches by competicao_id AND periodo (T1 < 2026-07-04, T2 >= 2026-07-04, geral = all)

- [ ] **Step 1: Write test query (no test framework, but document expected behavior)**

In Supabase Studio, after applying previous migrations, we'll verify:
- `ranking(copa_id, 'geral')` does NOT include Brasileirão matches
- `ranking(brasileirao_id, 'geral')` does NOT include Copa matches (or returns empty if no matches yet)
- User without `profiles_competicoes.ativo = true` for a competition does NOT appear in that ranking

- [ ] **Step 2: Create migration**

```sql
-- supabase/migrations/0022_ranking_por_competicao.sql
-- 0022 — ranking(p_competicao_id, p_periodo) filtro por competição e período

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
)
language sql
stable
security definer
set search_path = ''
as $$
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

- [ ] **Step 3: Validate function signature**

Expected: `ranking(uuid, text)` with default for second param.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0022_ranking_por_competicao.sql
git commit -m "migration: ranking(competicao_id, periodo) com filtro por competicao e opt-in

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Migration — sync cache namespaced per competition

**Files:**
- Create: `supabase/migrations/0023_sync_cache_competicao.sql`

**Interfaces:**
- Consumes: `competicoes`
- Produces: 
  - `sync_cache` table with added `competicao_id` column
  - Updated function `sync_cache_exists(competicao_id, cache_key)` to check per-competition cache
  - Updated function `sync_cache_set(competicao_id, cache_key, cache_value)` to store per-competition

- [ ] **Step 1: Read existing 0015_sync_cache.sql to understand current structure**

```bash
cat supabase/migrations/0015_sync_cache.sql
```

Document the current table structure (likely has just `cache_key` and `cache_value`).

- [ ] **Step 2: Create migration to add competicao_id and update functions**

```sql
-- supabase/migrations/0023_sync_cache_competicao.sql
-- 0023 — sync_cache namespaced por competição

-- Adicionar competicao_id ao sync_cache
alter table if exists public.sync_cache 
add column if not exists competicao_id uuid references public.competicoes (id) on delete cascade;

-- Fazer uma PK composta se a tabela tiver cache_key único (confirmar em 0015)
-- Se PK é só cache_key hoje, dropar e recriar
alter table if exists public.sync_cache drop constraint if exists sync_cache_pkey;
alter table if exists public.sync_cache add primary key (competicao_id, cache_key);

-- Atualizar função sync_cache_exists
drop function if exists public.sync_cache_exists(text);

create function public.sync_cache_exists(p_competicao_id uuid, p_cache_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.sync_cache
    where competicao_id = p_competicao_id and cache_key = p_cache_key
  );
$$;

-- Atualizar função sync_cache_set
drop function if exists public.sync_cache_set(text, text);

create function public.sync_cache_set(p_competicao_id uuid, p_cache_key text, p_cache_value text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sync_cache (competicao_id, cache_key, cache_value)
  values (p_competicao_id, p_cache_key, p_cache_value)
  on conflict (competicao_id, cache_key) do update
  set cache_value = p_cache_value;
$$;

-- Atualizar função sync_cache_get
drop function if exists public.sync_cache_get(text);

create function public.sync_cache_get(p_competicao_id uuid, p_cache_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cache_value from public.sync_cache
  where competicao_id = p_competicao_id and cache_key = p_cache_key;
$$;
```

- [ ] **Step 3: Validate file exists**

```bash
ls supabase/migrations/0023_sync_cache_competicao.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0023_sync_cache_competicao.sql
git commit -m "migration: sync_cache namespaced por competicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: TypeScript types + React hooks for competitions

**Files:**
- Modify: `src/lib/types.ts` — add competition types
- Create: `src/lib/competicoes.ts` — helper functions + hook

**Interfaces:**
- Produces: 
  - Type `Competicao` with fields: `id: string, slug: string, nome: string, formato: 'fases' | 'pontos-corridos', ativa: boolean, ordem: number`
  - Hook `useCompeticaoSelecionada()` reads/writes localStorage key `competicao_selecionada`
  - Function `getCompeticoes()` server action to fetch all competitions

- [ ] **Step 1: Add types to src/lib/types.ts**

```typescript
// src/lib/types.ts
export type CompetitionFormat = 'fases' | 'pontos-corridos';

export interface Competicao {
  id: string;
  slug: string;
  nome: string;
  formato: CompetitionFormat;
  ativa: boolean;
  ordem: number;
  created_at?: string;
}

export interface ProfileCompeticao {
  user_id: string;
  competicao_id: string;
  ativo: boolean;
  created_at?: string;
}
```

- [ ] **Step 2: Create src/lib/competicoes.ts with helpers**

```typescript
// src/lib/competicoes.ts
'use client';

import { useEffect, useState } from 'react';

const COMPETICAO_STORAGE_KEY = 'competicao_selecionada';

export function useCompeticaoSelecionada() {
  const [competicaoId, setCompeticaoId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COMPETICAO_STORAGE_KEY);
    setCompeticaoId(stored);
    setIsReady(true);
  }, []);

  const setCompeticao = (id: string) => {
    setCompeticaoId(id);
    localStorage.setItem(COMPETICAO_STORAGE_KEY, id);
  };

  return { competicaoId, setCompeticao, isReady };
}

// Server-side: fetch all competitions
export async function getCompeticoes() {
  const response = await fetch(
    new URL('/api/competicoes', process.env.NEXT_PUBLIC_APP_URL),
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }
  );
  if (!response.ok) throw new Error('Failed to fetch competitions');
  return response.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/competicoes.ts
git commit -m "feat: adicionar tipos Competicao + hook useCompeticaoSelecionada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Create `CompeticaoSelector` component

**Files:**
- Create: `src/components/competicao/competicao-selector.tsx`
- Create: `src/components/competicao/__tests__/competicao-selector.test.tsx`

**Interfaces:**
- Consumes: `useCompeticaoSelecionada` hook, `Competicao[]` prop
- Produces: dropdown component that:
  - Displays list of active competitions OR competitions user has opted into
  - Persists selection to localStorage via hook
  - Fires `onCompeticaoChange(competicaoId)` callback on selection change
  - Styled with Tailwind, dark/light theme aware, accessible (proper labels, focus visible)

- [ ] **Step 1: Write component test**

```typescript
// src/components/competicao/__tests__/competicao-selector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CompeticaoSelector } from '../competicao-selector';
import type { Competicao } from '@/lib/types';

const mockCompeticoes: Competicao[] = [
  { id: '1', slug: 'copa-2026', nome: 'Copa do Mundo 2026', formato: 'fases', ativa: false, ordem: 1 },
  { id: '2', slug: 'brasileirao-2026', nome: 'Brasileirão 2026', formato: 'pontos-corridos', ativa: true, ordem: 2 }
];

describe('CompeticaoSelector', () => {
  it('renders list of competitions', () => {
    render(<CompeticaoSelector competicoes={mockCompeticoes} />);
    expect(screen.getByText('Copa do Mundo 2026')).toBeInTheDocument();
    expect(screen.getByText('Brasileirão 2026')).toBeInTheDocument();
  });

  it('calls onCompeticaoChange when selection changes', () => {
    const onChange = jest.fn();
    render(<CompeticaoSelector competicoes={mockCompeticoes} onCompeticaoChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('renders select accessible to keyboard navigation', () => {
    render(<CompeticaoSelector competicoes={mockCompeticoes} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-label');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- competicao-selector.test.tsx 2>&1 | head -20
```

Expected: Component not found / export error

- [ ] **Step 3: Implement component**

```typescript
// src/components/competicao/competicao-selector.tsx
'use client';

import { useCompeticaoSelecionada } from '@/lib/competicoes';
import type { Competicao } from '@/lib/types';
import { useEffect, useState } from 'react';

interface CompeticaoSelectorProps {
  competicoes: Competicao[];
  onCompeticaoChange?: (competicaoId: string) => void;
}

export function CompeticaoSelector({ competicoes, onCompeticaoChange }: CompeticaoSelectorProps) {
  const { competicaoId, setCompeticao, isReady } = useCompeticaoSelecionada();
  const [displayValue, setDisplayValue] = useState('');

  // Determinar valor default: primeiro ativo, ou primeiro do list
  useEffect(() => {
    if (!isReady) return;
    
    const defaultValue = competicaoId || 
      competicoes.find(c => c.ativa)?.id || 
      competicoes[0]?.id;
    
    if (defaultValue && defaultValue !== displayValue) {
      setDisplayValue(defaultValue);
    }
  }, [isReady, competicaoId, competicoes, displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setDisplayValue(newId);
    setCompeticao(newId);
    onCompeticaoChange?.(newId);
  };

  if (!isReady) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="competicao-select" className="text-sm font-medium text-foreground">
        Competição
      </label>
      <select
        id="competicao-select"
        value={displayValue}
        onChange={handleChange}
        className="rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground 
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                   dark:bg-slate-900 dark:border-slate-700"
        aria-label="Selecionar competição"
      >
        {competicoes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- competicao-selector.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/competicao/competicao-selector.tsx src/components/competicao/__tests__/competicao-selector.test.tsx
git commit -m "feat: CompeticaoSelector component com localStorage persistence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Update `sync-matches` Edge Function for multi-competition loop

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: `competicoes` table with `fs_tournament_url`, `formato`; cache functions with `competicao_id`
- Produces: 
  - Loops over `select id, slug, fs_tournament_url, formato from competicoes where ativa = true`
  - For `formato = 'fases'`: keeps current stage detection logic
  - For `formato = 'pontos-corridos'`: uses `fase = 'pontos-corridos'` fixed, reads rodada from API response
  - All upserts include `competicao_id` in insert/update
  - Cache calls now pass `competicao_id` parameter

- [ ] **Step 1: Document current sync-matches structure (no code change yet)**

Read the file to understand:
- How it currently fetches and processes one tournament
- Where cache is used
- Where competicao_id needs to be threaded through

```bash
head -100 supabase/functions/sync-matches/index.ts
```

- [ ] **Step 2: Implement multi-competition loop**

Key changes to make:
1. Fetch all active competitions at start
2. Loop each, passing `competicao_id` through all DB operations
3. For `formato = 'fases'`: keep stage detection
4. For `formato = 'pontos-corridos'`: use fixed fase, extract rodada from API

Example snippet of loop structure:

```typescript
// supabase/functions/sync-matches/index.ts
const competicoes = await supabase
  .from('competicoes')
  .select('id, slug, fs_tournament_url, formato')
  .eq('ativa', true);

if (competicoes.error) throw competicoes.error;

for (const comp of competicoes.data) {
  Deno.serve(() => syncCompetition(comp.id, comp.fs_tournament_url, comp.formato));
}

async function syncCompetition(
  competicaoId: string, 
  tournamentUrl: string, 
  formato: 'fases' | 'pontos-corridos'
) {
  // ... reuse existing sync logic, add competicao_id to all matches inserts/updates
}
```

Replace the hardcoded `FS_TOURNAMENT_URL` with `fs_tournament_url` from the table.

Update all `matches` insert/update to include `competicao_id: competicaoId`.

Update cache calls: `sync_cache_set(competicaoId, key, val)` instead of `sync_cache_set(key, val)`.

- [ ] **Step 3: Test locally (or document test plan)**

Once deployed, trigger sync manually or wait for cron, verify:
- Copa matches still sync (if URL is set in DB)
- Brasileirão matches begin syncing (if URL is set in DB)
- Cache does not collide (separate namespaces per competition)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "refactor: sync-matches generalizado para loop multi-competicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Update `/ranking/page.tsx` and `ranking/actions.ts` with competition selector

**Files:**
- Modify: `src/app/ranking/page.tsx`
- Modify: `src/app/ranking/actions.ts`

**Interfaces:**
- Consumes: `useCompeticaoSelecionada`, `CompeticaoSelector` component, `getCompeticoes()`
- Produces: 
  - Page now passes selected `competicao_id` to server action
  - Server action calls `ranking(competicao_id, periodo)` with the selected competition
  - If `formato = 'fases'` (Copa), show sub-selector for T1/T2/Geral (implement `season-selector` as planned in spec 2026-07-04)
  - Default to Brasileirão on first load

- [ ] **Step 1: Update server action to accept competition_id**

```typescript
// src/app/ranking/actions.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { Competicao } from '@/lib/types';

export async function buscarRanking(competicaoId: string, periodo: string = 'geral') {
  const supabase = await createServerClient();
  
  // Fetch ranking for this competition
  const { data, error } = await supabase.rpc('ranking', {
    p_competicao_id: competicaoId,
    p_periodo: periodo
  });

  if (error) throw error;
  return data;
}

export async function fetchCompeticoes() {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('competicoes')
    .select('*')
    .order('ordem');

  if (error) throw error;
  return data as Competicao[];
}
```

- [ ] **Step 2: Update page component**

```typescript
// src/app/ranking/page.tsx (simplified skeleton)
'use client';

import { CompeticaoSelector } from '@/components/competicao/competicao-selector';
import { useCompeticaoSelecionada } from '@/lib/competicoes';
import { buscarRanking, fetchCompeticoes } from './actions';
import { useEffect, useState } from 'react';
import type { Competicao } from '@/lib/types';

export default function RankingPage() {
  const { competicaoId, setCompeticao } = useCompeticaoSelecionada();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState('geral');

  // Load competitions on mount
  useEffect(() => {
    (async () => {
      const comps = await fetchCompeticoes();
      setCompeticoes(comps);
      
      // Set default competition if not set
      if (!competicaoId) {
        const defaultComp = comps.find(c => c.ativa) || comps[0];
        setCompeticao(defaultComp.id);
      }
    })();
  }, []);

  // Load ranking when competition or periodo changes
  useEffect(() => {
    if (!competicaoId) return;
    
    (async () => {
      setLoading(true);
      try {
        const data = await buscarRanking(competicaoId, periodo);
        setRanking(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [competicaoId, periodo]);

  const currentCompeticao = competicoes.find(c => c.id === competicaoId);
  const showTemporadaSelector = currentCompeticao?.formato === 'fases';

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Ranking</h1>
      
      <CompeticaoSelector 
        competicoes={competicoes}
        onCompeticaoChange={setCompeticao}
      />

      {showTemporadaSelector && (
        <div>
          <label className="text-sm font-medium">Temporada</label>
          {/* TODO: integrate season-selector once 2026-07-04 spec is implemented */}
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="geral">Geral</option>
            <option value="temporada_1">Temporada 1 (Grupos)</option>
            <option value="temporada_2">Temporada 2 (Mata-mata)</option>
          </select>
        </div>
      )}

      {loading && <div className="text-center">Carregando...</div>}
      
      {/* TODO: Render pódio and ranking table (existing logic, just with new data) */}
      <pre>{JSON.stringify(ranking, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/ranking/page.tsx src/app/ranking/actions.ts
git commit -m "feat: ranking page com seletor de competicao e periodo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Update `/jogos` (palpites) page with competition selector

**Files:**
- Modify: `src/app/jogos/page.tsx`
- Modify: `src/app/jogos/actions.ts`

**Interfaces:**
- Consumes: `CompeticaoSelector`, competition selector logic
- Produces: 
  - Jogos page filters by selected competition
  - Shows "Você ainda não está participando" card if user not opted-in to selected competition
  - Fetches matches for that competition only
  - Pass `competicao_id` to `palpite_aberto()` checks

- [ ] **Step 1: Update server actions**

```typescript
// src/app/jogos/actions.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function buscarJogos(competicaoId: string) {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('competicao_id', competicaoId)
    .order('inicio_em', { ascending: true });

  if (error) throw error;
  return data;
}

export async function verificarParticipacao(competicaoId: string, userId: string) {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('profiles_competicoes')
    .select('ativo')
    .eq('user_id', userId)
    .eq('competicao_id', competicaoId)
    .single();

  if (error) return { ativo: false }; // Usuário não tem opt-in
  return data;
}
```

- [ ] **Step 2: Update page component**

```typescript
// src/app/jogos/page.tsx (simplified)
'use client';

import { CompeticaoSelector } from '@/components/competicao/competicao-selector';
import { useCompeticaoSelecionada } from '@/lib/competicoes';
import { buscarJogos, fetchCompeticoes, verificarParticipacao } from './actions';
import { useUser } from '@/lib/auth'; // Assuming this exists
import { useEffect, useState } from 'react';
import type { Competicao } from '@/lib/types';

export default function JogosPage() {
  const { competicaoId, setCompeticao } = useCompeticaoSelecionada();
  const { user } = useUser();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [jogos, setJogos] = useState([]);
  const [participacao, setParticipacao] = useState({ ativo: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const comps = await fetchCompeticoes();
      setCompeticoes(comps);
      if (!competicaoId) {
        const defaultComp = comps.find(c => c.ativa) || comps[0];
        setCompeticao(defaultComp.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!competicaoId || !user) return;

    (async () => {
      setLoading(true);
      try {
        const [jogosData, particip] = await Promise.all([
          buscarJogos(competicaoId),
          verificarParticipacao(competicaoId, user.id)
        ]);
        setJogos(jogosData);
        setParticipacao(particip);
      } finally {
        setLoading(false);
      }
    })();
  }, [competicaoId, user]);

  if (!participacao.ativo && !loading) {
    const currentComp = competicoes.find(c => c.id === competicaoId);
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">Palpites</h1>
        <CompeticaoSelector competicoes={competicoes} onCompeticaoChange={setCompeticao} />
        
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-900/20 dark:border-yellow-700">
          <p className="font-medium">Você ainda não está participando do {currentComp?.nome}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Vá até <a href="/perfil/competicoes" className="underline">Minhas competições</a> para ativar sua participação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Palpites</h1>
      <CompeticaoSelector competicoes={competicoes} onCompeticaoChange={setCompeticao} />
      
      {loading && <div>Carregando...</div>}
      
      {/* TODO: Render jogos list with prediction form (existing logic) */}
      <pre>{JSON.stringify(jogos, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/jogos/page.tsx src/app/jogos/actions.ts
git commit -m "feat: jogos/palpites com seletor competicao + verificacao opt-in

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Update `/historico` page with competition selector

**Files:**
- Modify: `src/app/historico/page.tsx`
- Modify: `src/app/historico/actions.ts` (if exists)

**Interfaces:**
- Consumes: `CompeticaoSelector`, Competição selecionada
- Produces: 
  - Histórico filters matches/predictions by selected competition
  - Shows "Sem resultados" if no matches for that competition

- [ ] **Step 1: Add server action to fetch historical matches**

```typescript
// src/app/historico/actions.ts (create if not exists)
'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function buscarHistorico(competicaoId: string) {
  const supabase = await createServerClient();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      predictions!inner (
        user_id,
        palpite_casa,
        palpite_fora,
        pontos
      )
    `)
    .eq('competicao_id', competicaoId)
    .eq('predictions.user_id', userId)
    .eq('status', 'finalizado')
    .order('inicio_em', { ascending: false });

  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Update historico page**

```typescript
// src/app/historico/page.tsx
'use client';

import { CompeticaoSelector } from '@/components/competicao/competicao-selector';
import { useCompeticaoSelecionada } from '@/lib/competicoes';
import { buscarHistorico, fetchCompeticoes } from './actions';
import { useEffect, useState } from 'react';
import type { Competicao } from '@/lib/types';

export default function HistoricoPage() {
  const { competicaoId, setCompeticao } = useCompeticaoSelecionada();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const comps = await fetchCompeticoes();
      setCompeticoes(comps);
      if (!competicaoId) {
        const defaultComp = comps.find(c => c.ativa) || comps[0];
        setCompeticao(defaultComp.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!competicaoId) return;
    
    (async () => {
      setLoading(true);
      try {
        const data = await buscarHistorico(competicaoId);
        setHistorico(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [competicaoId]);

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Histórico</h1>
      <CompeticaoSelector competicoes={competicoes} onCompeticaoChange={setCompeticao} />
      
      {loading && <div>Carregando...</div>}
      {historico.length === 0 && !loading && (
        <p className="text-muted-foreground">Sem resultados para essa competição.</p>
      )}
      
      {/* TODO: Render historico table (existing logic) */}
      <pre>{JSON.stringify(historico, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/historico/page.tsx src/app/historico/actions.ts
git commit -m "feat: historico com seletor competicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Update `/regras` page with competition config display

**Files:**
- Modify: `src/app/regras/page.tsx`
- Modify: `src/app/regras/actions.ts` (if exists)

**Interfaces:**
- Consumes: `CompeticaoSelector`, `app_config` filtered by competition
- Produces: 
  - Regras page shows competition config (pontuação) for selected competition
  - Display is competition-agnostic (just reads from app_config)

- [ ] **Step 1: Add server action to fetch app_config by competition**

```typescript
// src/app/regras/actions.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function fetchAppConfig(competicaoId: string) {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('app_config')
    .select('*')
    .eq('competicao_id', competicaoId);

  if (error) throw error;
  
  // Converte array de rows em objeto { chave: valor }
  return Object.fromEntries(data.map(row => [row.chave, row.valor]));
}
```

- [ ] **Step 2: Update regras page**

```typescript
// src/app/regras/page.tsx
'use client';

import { CompeticaoSelector } from '@/components/competicao/competicao-selector';
import { useCompeticaoSelecionada } from '@/lib/competicoes';
import { fetchCompeticoes, fetchAppConfig } from './actions';
import { useEffect, useState } from 'react';
import type { Competicao } from '@/lib/types';

export default function RegrasPage() {
  const { competicaoId, setCompeticao } = useCompeticaoSelecionada();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [config, setConfig] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const comps = await fetchCompeticoes();
      setCompeticoes(comps);
      if (!competicaoId) {
        const defaultComp = comps.find(c => c.ativa) || comps[0];
        setCompeticao(defaultComp.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!competicaoId) return;
    
    (async () => {
      setLoading(true);
      try {
        const configData = await fetchAppConfig(competicaoId);
        setConfig(configData);
      } finally {
        setLoading(false);
      }
    })();
  }, [competicaoId]);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Regras</h1>
      <CompeticaoSelector competicoes={competicoes} onCompeticaoChange={setCompeticao} />
      
      {loading && <div>Carregando...</div>}
      
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Pontuação</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b">
              <td className="py-2 px-3 font-medium">Placar Exato</td>
              <td className="py-2 px-3">{config.pts_placar_exato} pontos</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 px-3 font-medium">Resultado (V/E/D)</td>
              <td className="py-2 px-3">{config.pts_resultado} pontos</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 px-3 font-medium">Saldo de Gols</td>
              <td className="py-2 px-3">{config.pts_saldo} pontos</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium">Time Marca</td>
              <td className="py-2 px-3">{config.pts_time_marca} ponto</td>
            </tr>
          </tbody>
        </table>
        
        <p className="text-sm text-muted-foreground mt-4">
          Corte para palpites: {config.minutos_corte} minutos antes do jogo
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/regras/page.tsx src/app/regras/actions.ts
git commit -m "feat: regras com seletor competicao e exibicao de app_config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Create `/perfil/competicoes` page for opt-in management

**Files:**
- Create: `src/app/perfil/competicoes/page.tsx`
- Create: `src/app/perfil/competicoes/actions.ts`

**Interfaces:**
- Consumes: User auth, `profiles_competicoes` table
- Produces: 
  - Page lists all active competitions + competitions user participated in
  - Toggle buttons to opt-in/opt-out
  - Server actions `toggleCompeticao(competicaoId, ativo)` to upsert in DB

- [ ] **Step 1: Create server actions**

```typescript
// src/app/perfil/competicoes/actions.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function fetchUserCompeticoes() {
  const supabase = await createServerClient();
  const user = (await supabase.auth.getUser()).data.user;
  
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('competicoes')
    .select(`
      *,
      profiles_competicoes!left(ativo)
    `)
    .order('ordem');

  if (error) throw error;
  return data;
}

export async function toggleCompeticao(competicaoId: string, ativo: boolean) {
  const supabase = await createServerClient();
  const user = (await supabase.auth.getUser()).data.user;
  
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles_competicoes')
    .upsert({
      user_id: user.id,
      competicao_id: competicaoId,
      ativo
    }, {
      onConflict: 'user_id,competicao_id'
    });

  if (error) throw error;
}
```

- [ ] **Step 2: Create page component**

```typescript
// src/app/perfil/competicoes/page.tsx
'use client';

import { fetchUserCompeticoes, toggleCompeticao } from './actions';
import { useEffect, useState } from 'react';
import type { Competicao } from '@/lib/types';

interface CompeticaoComParticipacao extends Competicao {
  profiles_competicoes?: { ativo: boolean }[] | null;
}

export default function CompeticopesPage() {
  const [competicoes, setCompeticoes] = useState<CompeticaoComParticipacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchUserCompeticoes();
        setCompeticoes(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (competicaoId: string, currentAtico: boolean) => {
    try {
      await toggleCompeticao(competicaoId, !currentAtico);
      setCompeticoes(prev => prev.map(c => 
        c.id === competicaoId 
          ? { ...c, profiles_competicoes: [{ ativo: !currentAtico }] }
          : c
      ));
    } catch (err) {
      console.error('Erro ao alternar competição:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minhas Competições</h1>
        <p className="text-muted-foreground mt-2">
          Ative ou desative sua participação nas competições
        </p>
      </div>

      {loading && <div>Carregando...</div>}

      <div className="space-y-3">
        {competicoes.map(comp => {
          const participando = comp.profiles_competicoes?.[0]?.ativo ?? false;
          return (
            <div 
              key={comp.id} 
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50"
            >
              <div>
                <h3 className="font-medium">{comp.nome}</h3>
                <p className="text-sm text-muted-foreground">
                  {comp.ativa ? 'Ativa' : 'Encerrada'}
                </p>
              </div>
              <button
                onClick={() => handleToggle(comp.id, participando)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  participando
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {participando ? 'Participando' : 'Ativar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add link to this page from perfil (main profile page)**

In `src/app/perfil/page.tsx`, add navigation to `/perfil/competicoes`:

```typescript
<nav className="space-y-2">
  <a href="/perfil/competicoes" className="block px-4 py-2 rounded hover:bg-muted">
    Minhas Competições
  </a>
  {/* ... other profile links ... */}
</nav>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/perfil/competicoes/page.tsx src/app/perfil/competicoes/actions.ts src/app/perfil/page.tsx
git commit -m "feat: adicionar pagina /perfil/competicoes para opt-in management

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Manual testing, unit tests, and final build validation

**Files:**
- N/A (testing and validation only)

**Interfaces:**
- Validation: All migrations apply, ranking queries work, UI renders, components integrate

- [ ] **Step 1: Apply migrations locally**

```bash
cd supabase && npx supabase db push
```

Expected: All 5 new migrations (0019-0023) apply successfully.

- [ ] **Step 2: Run Postgres tests manually in Supabase Studio**

Test each query:

```sql
-- Test 1: ranking(competicao_copa, 'geral') does not include Brasileirão matches
select id, time_casa, competicao_id from matches order by competicao_id;

-- Test 2: palpite_aberto respects competition's minutos_corte
select palpite_aberto(id) from matches limit 1;

-- Test 3: Verify sync cache function signatures
select sync_cache_exists('fake-comp-id'::uuid, 'test-key');
```

- [ ] **Step 3: Run unit tests**

```bash
npm test
```

Expected: All existing tests pass, new component tests pass (Task 7).

- [ ] **Step 4: Build production bundle**

```bash
npm run build
```

Expected: Zero errors, type checking passes.

- [ ] **Step 5: Manual feature test in browser**

1. Navigate to `/palpites` — should see CompeticaoSelector dropdown
2. Select Brasileirão — should show opt-in card if not enrolled
3. Navigate to `/perfil/competicoes` — toggle Brasileirão to active
4. Back to `/palpites` — should now show Brasileirão matches (if any synced)
5. Navigate to `/ranking` — select Brasileirão, verify empty or populated correctly
6. Navigate to `/ranking`, select Copa — should show existing Copa ranking
7. Navigate to `/regras` — switch between Copa/Brasileirão, verify config values change
8. Test localStorage persistence: refresh page, verify selected competition persists
9. Test dark theme: toggle dark mode, verify CompeticaoSelector and forms look correct

- [ ] **Step 6: Verify Flashscore sync (once fs_tournament_url is set in DB)**

If Flashscore URLs are available, manually trigger sync via Supabase edge function dashboard or wait for cron. Verify:
- Brasileirão matches appear in DB with `competicao_id` pointing to Brasileirão
- Copa matches don't re-sync (already marked inactive)
- `matches.rodada` reflects actual rodada for Brasileirão

- [ ] **Step 7: Commit final validation (no code changes)**

```bash
git commit --allow-empty -m "test: validacao manual multi-competicao completa

- Migrations aplicadas com sucesso
- npm test: PASS
- npm run build: PASS
- Feature test: PASS (seletor, opt-in, ranking, regras, persistencia)
- Dark theme: OK

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Summary

This plan implements multi-competition support in 14 tasks:

1. **Schema** (Tasks 1–5): New `competicoes` table, `matches.competicao_id`, `app_config` per-competition, `ranking()` with competition filtering, cache namespacing
2. **Backend** (Task 8): Generalize `sync-matches` to loop and support multiple tournament formats
3. **Frontend** (Tasks 6–7, 9–13): Types, hooks, selector component, integration into all pages, opt-in management UI
4. **Validation** (Task 14): Testing and build

Each task commits independently and can be reviewed and tested on its own. By the end, the system supports running Copa do Mundo 2026 (archived, visible in history) and Brasileirão 2026 (active, new ranking) simultaneously with separate opt-in, config, and sync.
