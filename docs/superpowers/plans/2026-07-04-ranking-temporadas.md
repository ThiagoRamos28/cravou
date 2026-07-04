# Ranking com Temporadas Separadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable viewing rankings separately by Season 1 (Grupos, until 2026-07-03), Season 2 (Mata-mata, from 2026-07-04), and General (combined). UI adds a dropdown to select period with a tooltip explaining scoring values.

**Architecture:** Database function `ranking(p_periodo)` parametrized to filter matches by date. Frontend: `SeasonSelector` component (dropdown + info tooltip) controls state, triggers data reload. Existing `Podium` and `RankingTable` components render unchanged.

**Tech Stack:** Next.js 16 (server + client components), TypeScript, Supabase RPC, Tailwind v4, Framer Motion (tooltip), lucide-react

## Global Constraints

- Idioma da UI: Português do Brasil
- Componentes com hooks/Framer Motion: `"use client"`
- Mensagens de commit terminam com `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`
- Dark/light theme: testar em ambos
- Mobile-first: dropdown acessível em < 640px
- Design do pódio e tabela: mantém exatamente como está hoje (zero mudança visual)

---

## File Structure

**New:**
- `supabase/migrations/00XX_ranking_periodo.sql` — Function `ranking(p_periodo text)` with period filtering
- `src/components/ranking/season-selector.tsx` — Dropdown + info icon with scoring tooltip

**Modified:**
- `src/lib/ranking.ts` — Accept `period` parameter, pass to RPC
- `src/app/ranking/page.tsx` — Render client-side `RankingContent` wrapper instead of direct async call

---

## Tasks

### Task 1: Create migration with `ranking(p_periodo)` function

**Files:**
- Create: `supabase/migrations/00XX_ranking_periodo.sql`

**Interfaces:**
- Consumes: Nothing (new function)
- Produces: Function `public.ranking(p_periodo text default 'geral')` callable from TypeScript via `supabase.rpc('ranking', { p_periodo: 'temporada_1' })`

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/00XX_ranking_periodo.sql` (replace `00XX` with next number; check existing migrations in `supabase/migrations/` to find the next sequence):

```sql
-- Extend public.ranking() to filter by period (temporada_1, temporada_2, geral)
create or replace function public.ranking(p_periodo text default 'geral')
returns table (
  user_id uuid,
  apelido text,
  avatar_url text,
  pontos bigint,
  cravadas bigint,
  palpites_pontuados bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id, pr.apelido, pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa
        and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m on m.id = p.match_id
  where case p_periodo
    when 'temporada_1' then m.inicio_em < '2026-07-04'
    when 'temporada_2' then m.inicio_em >= '2026-07-04'
    when 'geral' then true
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;
```

- [ ] **Step 2: Apply migration locally (if using local Supabase stack)**

If you have a local Supabase running:
```bash
supabase db push
```

If using remote project via MCP, skip this step and proceed to Task 2 (migration applies when you invoke the MCP tool).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00XX_ranking_periodo.sql
git commit -m "feat: add ranking(p_periodo) function for season filtering

- temporada_1: matches before 2026-07-04 (Grupos)
- temporada_2: matches from 2026-07-04 (Mata-mata)
- geral: all matches (default)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Extend `listarRanking()` to accept period parameter

**Files:**
- Modify: `src/lib/ranking.ts:19-27`

**Interfaces:**
- Consumes: Function `public.ranking(p_periodo text)` from Task 1
- Produces: Updated function signature `async function listarRanking(period?: string): Promise<RankingRow[]>` where `period` defaults to `'geral'` and maps to RPC call

- [ ] **Step 1: Update `listarRanking()` to accept period**

Modify `src/lib/ranking.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export type RankingRow = {
  user_id: string;
  apelido: string | null;
  avatar_url: string | null;
  pontos: number;
  cravadas: number;
  acertos_saldo: number;
  acertos_resultado: number;
  acertos_gols: number;
  erros: number;
  palpites_pontuados: number;
  total_palpites: number;
};

// Ranking por temporada (temporada_1, temporada_2, geral).
// Lê da função SECURITY DEFINER public.ranking(p_periodo).
// Falha aberta: [] em erro.
export async function listarRanking(period: string = "geral"): Promise<RankingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking", { p_periodo: period });
    return (data as RankingRow[]) ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No TS errors on `ranking.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/ranking.ts
git commit -m "feat: listarRanking() accepts period parameter (temporada_1|temporada_2|geral)

- period defaults to 'geral' (all matches)
- passes period to RPC call public.ranking(p_periodo)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Create `SeasonSelector` component with dropdown + tooltip

**Files:**
- Create: `src/components/ranking/season-selector.tsx`

**Interfaces:**
- Consumes: `app_config` table (read-only, via direct Supabase query or passed as prop)
- Produces: React component `<SeasonSelector onPeriodChange={(period) => void} currentPeriod={string} />`

- [ ] **Step 1: Write the component skeleton**

Create `src/components/ranking/season-selector.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SeasonSelectorProps = {
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  scoringConfig?: {
    t1_exact: number;
    t1_result: number;
    t1_balance: number;
    t1_goals: number;
    t2_exact: number;
    t2_result: number;
    t2_balance: number;
    t2_goals: number;
  };
};

export function SeasonSelector({
  currentPeriod,
  onPeriodChange,
  scoringConfig = {
    t1_exact: 10,
    t1_result: 7,
    t1_balance: 5,
    t1_goals: 2,
    t2_exact: 15,
    t2_result: 7,
    t2_balance: 4,
    t2_goals: 1,
  },
}: SeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  const seasons = [
    { value: "temporada_1", label: "Temporada 1 (Grupos)" },
    { value: "temporada_2", label: "Temporada 2 (Mata-mata)" },
    { value: "geral", label: "Ranking Geral" },
  ];

  return (
    <div className="mb-6 flex items-center gap-3">
      <label htmlFor="season-select" className="font-semibold text-foreground">
        Ver ranking de:
      </label>
      <select
        id="season-select"
        value={currentPeriod}
        onChange={(e) => onPeriodChange(e.target.value)}
        className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {seasons.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Ver explicação de pontuação"
          >
            <Info size={20} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">
                Temporada 1 (até 03/07)
              </h3>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Placar exato: {scoringConfig.t1_exact} pts</li>
                <li>• Resultado (V/E/D): {scoringConfig.t1_result} pts</li>
                <li>• Saldo de gols: {scoringConfig.t1_balance} pts</li>
                <li>• Time marca: {scoringConfig.t1_goals} pts</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Temporada 2 (a partir de 04/07)
              </h3>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Placar exato: {scoringConfig.t2_exact} pts</li>
                <li>• Resultado (V/E/D): {scoringConfig.t2_result} pts</li>
                <li>• Saldo de gols: {scoringConfig.t2_balance} pts</li>
                <li>• Time marca: {scoringConfig.t2_goals} pts</li>
              </ul>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verify component renders (basic TypeScript check)**

```bash
npm run build
```

Expected: No TS errors in `season-selector.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/ranking/season-selector.tsx
git commit -m "feat: add SeasonSelector component (dropdown + scoring tooltip)

- Dropdown with 3 options: Temporada 1, Temporada 2, Ranking Geral
- Info icon opens popover showing scoring values for both seasons
- onPeriodChange callback fires when selection changes
- Scoring config passed as prop (defaults to 10/7/5/2 and 15/7/4/1)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Create `RankingContent` client component to manage period state

**Files:**
- Create: `src/components/ranking/ranking-content.tsx`

**Interfaces:**
- Consumes: `listarRanking(period)` function, `Podium`, `RankingTable`, `RankingListaMobile` components, `SeasonSelector`
- Produces: React component `<RankingContent userId={string} />`

- [ ] **Step 1: Write the client component**

Create `src/components/ranking/ranking-content.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Podium } from "@/components/ranking/podium";
import { RankingTable } from "@/components/ranking/ranking-table";
import { RankingListaMobile } from "@/components/ranking/ranking-lista-mobile";
import { SeasonSelector } from "@/components/ranking/season-selector";
import { RankingRow, listarRanking } from "@/lib/ranking";

export type RankingContentProps = {
  userId: string;
};

export function RankingContent({ userId }: RankingContentProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("geral");
  const [linhas, setLinhas] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listarRanking(selectedPeriod).then((data) => {
      setLinhas(data);
      setLoading(false);
    });
  }, [selectedPeriod]);

  return (
    <>
      <SeasonSelector
        currentPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />
      {loading ? (
        <div className="space-y-4">
          {/* Simple skeleton loader */}
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        </div>
      ) : (
        <>
          <Podium linhas={linhas} />
          <RankingTable linhas={linhas} meuId={userId} />
          <RankingListaMobile linhas={linhas} meuId={userId} />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No TS errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ranking/ranking-content.tsx
git commit -m "feat: add RankingContent client component for period switching

- Manages selectedPeriod state (default: 'geral')
- Calls listarRanking(period) on period change
- Shows skeleton loader while fetching
- Renders Podium, RankingTable, RankingListaMobile unchanged

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Modify `/ranking/page.tsx` to use `RankingContent`

**Files:**
- Modify: `src/app/ranking/page.tsx`

**Interfaces:**
- Consumes: `RankingContent` component from Task 4, `getSessao()` from auth
- Produces: Page that integrates `<RankingContent />` instead of inline async calls

- [ ] **Step 1: Replace inline ranking call with RankingContent**

Modify `src/app/ranking/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RankingContent } from "@/components/ranking/ranking-content";
import { getSessao } from "@/lib/auth/profile";

export default async function RankingPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Ranking
        </h1>
        <RankingContent userId={sessao.userId} />
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No TS errors on `page.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/app/ranking/page.tsx
git commit -m "refactor: move ranking logic to RankingContent client component

- Page remains server component for auth check
- RankingContent handles period state and data fetching
- Allows dynamic period switching without page reload

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Test locally and verify build

**Files:**
- Verify: All changes work end-to-end

**Interfaces:**
- Consumes: Migration applied, all components rendered, page loads
- Produces: Working feature in browser

- [ ] **Step 1: Apply migration to local/remote Supabase (if not already done)**

If using remote Supabase via MCP (as indicated in project), apply the migration:

```bash
# (If you have MCP Supabase tools loaded, use them to apply migration)
# Otherwise, if using local stack:
supabase db push
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`

- [ ] **Step 3: Navigate to `/ranking` in browser**

Open `http://localhost:3000/ranking` (must be authenticated first)

Expected:
- Page loads with "Ver ranking de:" dropdown above pódio
- Dropdown shows 3 options: Temporada 1 (Grupos), Temporada 2 (Mata-mata), Ranking Geral
- Default selection: "Ranking Geral"
- Info icon (ⓘ) next to dropdown is clickable
- Clicking info icon opens popover with scoring table for both seasons
- Pódio and tabela render below (same layout as before)

- [ ] **Step 4: Test switching periods**

Click dropdown and select "Temporada 1". Expected:
- Skeleton loader appears briefly
- Pódio and tabela refresh with Temporada 1 data (fewer points, different top 3)
- Clicking dropdown again to select "Temporada 2" or "Ranking Geral" updates data again

- [ ] **Step 5: Test tooltip on both themes**

- Light theme: Info icon visible, tooltip readable
- Dark theme: Toggle to dark in app, repeat above check

- [ ] **Step 6: Test mobile responsiveness**

Resize browser to < 640px (DevTools mobile view):
- Dropdown still fully visible and clickable
- Info icon accessible
- Tooltip fits on screen (may scroll)
- Pódio and tabela remain responsive (as they were before)

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: All tests pass (no new tests added, but ensure no regressions)

- [ ] **Step 8: Build for production**

```bash
npm run build
```

Expected: Build succeeds, no TS or lint errors

- [ ] **Step 9: Commit final verification**

```bash
git add .
git commit -m "test: verify ranking temporadas feature works end-to-end

- Migration applied (ranking(p_periodo) parametrized)
- SeasonSelector dropdown + tooltip functional
- Period switching updates Podium, RankingTable, RankingListaMobile
- Mobile responsive, dark/light theme compatible
- npm test and npm run build pass

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Spec Coverage Check

- ✅ **Rankings separados por temporada** → Task 1 (SQL function), Task 2 (listarRanking), Task 4/5 (UI state)
- ✅ **Dropdown seletor** → Task 3 (SeasonSelector)
- ✅ **Tooltip com pontuação** → Task 3 (Info icon + Popover)
- ✅ **Design do pódio/tabela mantido** → Task 4 (no changes to Podium/RankingTable)
- ✅ **Mobile responsivo** → Task 6 (testing)
- ✅ **Dark/light theme** → Task 6 (testing)

---

## Dependency Graph

```
Task 1 (Migration)
  ↓
Task 2 (listarRanking)
  ↓
Task 4 (RankingContent) ← Task 3 (SeasonSelector)
  ↓
Task 5 (page.tsx)
  ↓
Task 6 (Testing & Build)
```

**Parallelizable:** Tasks 1 and 3 can run in parallel (no dependencies). Task 2 requires Task 1 complete before testing. Tasks 4 and 3 are semi-independent (3 can be written without 2, but testing 4 requires both).

For subagent-driven execution: dispatch Tasks 1 and 3 in parallel, then sequence the rest.
