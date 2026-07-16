# Odds nos jogos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir odds pré-jogo (1x2, Over/Under 2.5, Ambas marcam) num painel recolhível no card de cada jogo agendado, a partir de um snapshot único capturado pelo `sync-matches`.

**Architecture:** O `sync-matches` busca as odds uma vez por jogo agendado ao entrar na janela (~2h antes), extrai o bookmaker de referência (bet365 → 1ª casa) via helper puro `extrairOdds`, e grava em `matches.odds` (jsonb). As páginas (server components) leem `odds` junto do `Match` e o `MatchCard` renderiza um componente client recolhível.

**Tech Stack:** Next.js 16 (App Router, server components), TypeScript, Supabase (Postgres + Edge Functions/Deno), Tailwind v4, Vitest + React Testing Library.

## Global Constraints

- Idioma UI: português do Brasil, sempre. Nome do produto: `Cravou!` verbatim.
- Test runner: **Vitest** (`import { describe, it, expect, vi } from "vitest"`). NUNCA `jest.fn()`.
- Testes co-localizados em `__tests__/` ao lado do componente/módulo.
- Timezone exibição: `America/Sao_Paulo`.
- Componentes novos: Tailwind, dark E light, `cursor-pointer` em clicáveis, foco visível, ícones lucide (nunca emoji).
- Odds decimais são armazenadas/exibidas como **string** (preservam formatação, ex.: "2.32").
- Odds só aparecem para jogos `status !== 'finalizado'` que tenham `odds` capturadas.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Branch de trabalho: `feat/multi-competicao` (já em uso).

---

## Task 1: Migration — `matches.odds jsonb`

**Files:**
- Create: `supabase/migrations/0023_matches_odds.sql`

**Interfaces:**
- Produces: coluna `matches.odds jsonb` nullable.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/0023_matches_odds.sql
-- 0023 — Snapshot de odds pré-jogo (1x2, over/under 2.5, ambas marcam) por partida.
-- Coluna aditiva e nullable: jogos sem odds capturadas ficam com NULL.

alter table public.matches add column if not exists odds jsonb;
```

- [ ] **Step 2: Verificar arquivo**

Run: `ls supabase/migrations/0023_matches_odds.sql`
Expected: arquivo existe.

- [ ] **Step 3: Aplicar migration** (aditiva, segura a qualquer momento)

Run: `npx supabase db push` (ou via MCP `apply_migration` com o conteúdo acima).
Expected: aplica sem erro.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0023_matches_odds.sql
git commit -m "migration: matches.odds jsonb (snapshot de odds pre-jogo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `_shared/odds.ts` — `extrairOdds` (puro, TDD)

**Files:**
- Create: `supabase/functions/_shared/odds.ts`
- Create: `supabase/functions/_shared/__tests__/odds.test.ts`

**Interfaces:**
- Produces:
  - `type OddsSnapshot = { casa: string | null; empate: string | null; fora: string | null; over25: string | null; under25: string | null; ambas_sim: string | null; ambas_nao: string | null; bookmaker: string; capturado_em: string }`
  - `extrairOdds(payload: unknown, agora?: Date): OddsSnapshot | null` — escolhe bet365 (senão a 1ª casa), extrai 1x2/over-under-2.5/ambas dos mercados `FULL_TIME`. Retorna `null` se não houver bookmaker/lista válida ou se faltar algum valor do 1x2.

- [ ] **Step 1: Escrever o teste**

```typescript
// supabase/functions/_shared/__tests__/odds.test.ts
import { describe, it, expect } from "vitest";
import { extrairOdds } from "../odds";

// Fixture mínimo no formato da FlashScore: lista de bookmakers.
function bookmaker(name: string) {
  return {
    name,
    image: "x",
    odds: [
      {
        bettingType: "HOME_DRAW_AWAY",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "2.32", eventParticipantId: "home" },
          { value: "3.10", eventParticipantId: null },
          { value: "3.00", eventParticipantId: "away" },
        ],
      },
      {
        bettingType: "OVER_UNDER",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "9.9", selection: "OVER", handicap: { value: "0.5" } },
          { value: "1.95", selection: "OVER", handicap: { value: "2.5" } },
          { value: "1.85", selection: "UNDER", handicap: { value: "2.5" } },
        ],
      },
      {
        bettingType: "BOTH_TEAMS_TO_SCORE",
        bettingScope: "FULL_TIME",
        odds: [
          { value: "1.80", bothTeamsToScore: true },
          { value: "1.95", bothTeamsToScore: false },
        ],
      },
    ],
  };
}

const agora = new Date("2026-07-16T18:00:00.000Z");

describe("extrairOdds", () => {
  it("extrai 1x2, over/under 2.5 e ambas marcam do bet365", () => {
    const snap = extrairOdds([bookmaker("outra"), bookmaker("bet365")], agora);
    expect(snap).toEqual({
      casa: "2.32",
      empate: "3.10",
      fora: "3.00",
      over25: "1.95",
      under25: "1.85",
      ambas_sim: "1.80",
      ambas_nao: "1.95",
      bookmaker: "bet365",
      capturado_em: "2026-07-16T18:00:00.000Z",
    });
  });

  it("usa a 1ª casa quando não há bet365", () => {
    const snap = extrairOdds([bookmaker("betano")], agora);
    expect(snap?.bookmaker).toBe("betano");
    expect(snap?.casa).toBe("2.32");
  });

  it("retorna null sem bookmakers", () => {
    expect(extrairOdds([], agora)).toBeNull();
    expect(extrairOdds(null, agora)).toBeNull();
  });

  it("retorna null quando falta o 1x2", () => {
    const semUm2 = { name: "bet365", odds: [] };
    expect(extrairOdds([semUm2], agora)).toBeNull();
  });

  it("mantém objeto válido com over/under e ambas ausentes (campos null)", () => {
    const soUm2 = {
      name: "bet365",
      odds: [
        {
          bettingType: "HOME_DRAW_AWAY",
          bettingScope: "FULL_TIME",
          odds: [{ value: "2.0" }, { value: "3.0" }, { value: "4.0" }],
        },
      ],
    };
    const snap = extrairOdds([soUm2], agora);
    expect(snap?.over25).toBeNull();
    expect(snap?.under25).toBeNull();
    expect(snap?.ambas_sim).toBeNull();
    expect(snap?.ambas_nao).toBeNull();
    expect(snap?.casa).toBe("2.0");
  });
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `npm test -- odds`
Expected: FAIL (módulo `../odds` inexistente).

- [ ] **Step 3: Implementar `_shared/odds.ts`**

```typescript
// supabase/functions/_shared/odds.ts
// Extrator puro de odds a partir da resposta de matches/odds da FlashScore.
// Sem I/O — testável com fixture.

export type OddsSnapshot = {
  casa: string | null;
  empate: string | null;
  fora: string | null;
  over25: string | null;
  under25: string | null;
  ambas_sim: string | null;
  ambas_nao: string | null;
  bookmaker: string;
  capturado_em: string;
};

type Selecao = {
  value?: string;
  selection?: string | null;
  handicap?: { value?: string } | null;
  bothTeamsToScore?: boolean | null;
};
type Mercado = { bettingType?: string; bettingScope?: string; odds?: Selecao[] };
type Bookmaker = { name?: string; odds?: Mercado[] };

// Escolhe bet365 (senão a 1ª casa) e extrai os 3 mercados FULL_TIME. Retorna null se
// não houver bookmaker válido ou se o 1x2 estiver incompleto.
export function extrairOdds(payload: unknown, agora = new Date()): OddsSnapshot | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const casas = payload as Bookmaker[];
  const bm =
    casas.find((b) => b.name?.toLowerCase() === "bet365") ?? casas[0];
  if (!bm || !Array.isArray(bm.odds)) return null;

  const mercado = (tipo: string): Selecao[] =>
    bm.odds!.find((m) => m.bettingType === tipo && m.bettingScope === "FULL_TIME")
      ?.odds ?? [];

  // 1x2 — ordem [casa, empate, fora]
  const um2 = mercado("HOME_DRAW_AWAY");
  const casa = um2[0]?.value ?? null;
  const empate = um2[1]?.value ?? null;
  const fora = um2[2]?.value ?? null;
  if (casa === null || empate === null || fora === null) return null;

  // Over/Under 2.5
  const ou = mercado("OVER_UNDER").filter((o) => o.handicap?.value === "2.5");
  const over25 = ou.find((o) => o.selection === "OVER")?.value ?? null;
  const under25 = ou.find((o) => o.selection === "UNDER")?.value ?? null;

  // Ambas marcam
  const btts = mercado("BOTH_TEAMS_TO_SCORE");
  const ambas_sim = btts.find((o) => o.bothTeamsToScore === true)?.value ?? null;
  const ambas_nao = btts.find((o) => o.bothTeamsToScore === false)?.value ?? null;

  return {
    casa,
    empate,
    fora,
    over25,
    under25,
    ambas_sim,
    ambas_nao,
    bookmaker: bm.name ?? "?",
    capturado_em: agora.toISOString(),
  };
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `npm test -- odds`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/odds.ts supabase/functions/_shared/__tests__/odds.test.ts
git commit -m "feat: extrairOdds (helper puro de odds da FlashScore)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `sync-matches` — buscar odds na janela + deploy

**Files:**
- Modify: `supabase/functions/_shared/fixtures.ts` (tipo `MatchRow`)
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: `extrairOdds`, `OddsSnapshot` (Task 2); `matches.odds` (Task 1)
- Produces: `matches.odds` populado para jogos agendados na janela (~2h antes) que ainda não têm odds.

- [ ] **Step 1: Adicionar `odds` ao `MatchRow`**

Em `supabase/functions/_shared/fixtures.ts`, no tipo `MatchRow`, logo após `competicao_id?: string;`, adicionar o import não é necessário (tipo estrutural); adicionar o campo:

```typescript
export type MatchRow = {
  competicao_id?: string;
  odds?: unknown; // OddsSnapshot | null — jsonb gravado no upsert
  api_fixture_id: string;
  // ...restante inalterado
```

> Usa-se `unknown` aqui para não acoplar `fixtures.ts` a `odds.ts`; o valor concreto é setado no sync a partir de `extrairOdds`.

- [ ] **Step 2: Importar `extrairOdds` no sync**

Em `supabase/functions/sync-matches/index.ts`, junto aos imports de `_shared`, após a linha `import { espelharEscudo } from "../_shared/escudos.ts";`:

```typescript
import { extrairOdds } from "../_shared/odds.ts";
```

- [ ] **Step 3: Incluir `odds` na leitura de existentes**

Em `syncCompeticao`, na query de `existentes`, adicionar `odds` ao select:

```typescript
  const { data: existentes } = await supabase
    .from("matches")
    .select("id, api_fixture_id, placar_casa, placar_fora, status, time_casa, time_fora, odds")
    .in("api_fixture_id", apiIds.length > 0 ? apiIds : ["__nenhum__"]);
```

E no `mapaExistentes`, adicionar `odds` ao objeto mapeado:

```typescript
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
        odds: m.odds as unknown,
      },
    ])
  );
```

- [ ] **Step 4: Buscar odds dos jogos-alvo (após `mapaExistentes`, antes do bloco `transicoes`)**

Inserir logo após a construção de `mapaExistentes`:

```typescript
  // Odds pré-jogo: 1x por jogo agendado que entra na janela (~2h antes) e ainda não tem odds.
  // Snapshot único (não reatualiza). Lotes de 5 com delay, como o fetch de detalhes.
  const ODDS_JANELA_MS = 2 * 60 * 60 * 1000; // 2h antes do início
  const alvoOdds = paraUpsert.filter((r) => {
    if (r.status !== "agendado") return false;
    const t = new Date(r.inicio_em).getTime();
    if (t < agora || t > agora + ODDS_JANELA_MS) return false;
    return !mapaExistentes.get(r.api_fixture_id)?.odds;
  });

  const LOTE_ODDS = 5;
  for (let i = 0; i < alvoOdds.length; i += LOTE_ODDS) {
    const lote = alvoOdds.slice(i, i + LOTE_ODDS);
    await Promise.all(
      lote.map(async (r) => {
        try {
          const payload = await fsFetch(
            `/api/flashscore/v2/matches/odds?match_id=${r.api_fixture_id}&geo_ip_code=BR`
          );
          const snap = extrairOdds(payload);
          if (snap) r.odds = snap;
        } catch (e) {
          console.error(
            JSON.stringify({
              evento: "odds_erro",
              api_fixture_id: r.api_fixture_id,
              mensagem: e instanceof Error ? e.message : String(e),
            })
          );
        }
      })
    );
    if (i + LOTE_ODDS < alvoOdds.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
```

> Nota: `agora` é o parâmetro já recebido por `syncCompeticao`. O upsert de `matches` (mais
> abaixo, com `comTimestamp`) grava a coluna `odds` automaticamente, pois faz spread de `r`.

- [ ] **Step 5: Deploy da Edge Function**

O deploy inclui `source/index.ts`, `_shared/fixtures.ts`, `_shared/escudos.ts`, `_shared/odds.ts` e `source/deno.json` (estrutura de paths já usada: entrypoint `source/index.ts`, `_shared` um nível acima). Via MCP `deploy_edge_function` (verify_jwt=false) ou `npx supabase functions deploy sync-matches`.

Expected: deploy ACTIVE, nova versão.

- [ ] **Step 6: Smoke test (forçar uma run)**

Disparar a função (via o comando do cron existente, sem expor o secret) e conferir a resposta `net._http_response` = 200. Depois:

```sql
select count(*) from matches where odds is not null;
```
Expected: > 0 se havia jogo agendado na janela; a estrutura do JSON tem as chaves `casa/empate/fora`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/sync-matches/index.ts
git commit -m "feat: sync-matches captura odds pre-jogo na janela (snapshot 1x2/ou2.5/ambas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `src/lib/matches.ts` — tipo `Odds` + `Match.odds` + `COLS`

**Files:**
- Modify: `src/lib/matches.ts`

**Interfaces:**
- Consumes: `matches.odds` (Task 1)
- Produces: `type Odds`; `Match.odds: Odds | null`; `COLS` inclui `odds`.

- [ ] **Step 1: Adicionar o tipo `Odds` e o campo em `Match`**

No topo de `src/lib/matches.ts`, antes de `export type Match`:

```typescript
export type Odds = {
  casa: string | null;
  empate: string | null;
  fora: string | null;
  over25: string | null;
  under25: string | null;
  ambas_sim: string | null;
  ambas_nao: string | null;
  bookmaker: string;
  capturado_em: string;
};
```

E dentro de `export type Match`, após `placar_fora: number | null;`:

```typescript
  odds: Odds | null;
```

- [ ] **Step 2: Incluir `odds` em `COLS`**

```typescript
const COLS =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora, odds";
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: compila (o campo `odds` fica disponível em `Match`). Se algum consumidor de `Match` reclamar de propriedade faltante, é só leitura opcional — nada além de `matches.ts` precisa mudar aqui.

- [ ] **Step 4: Commit**

```bash
git add src/lib/matches.ts
git commit -m "feat: tipo Odds + Match.odds na camada de dados

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `OddsJogo` — componente client recolhível (TDD)

**Files:**
- Create: `src/components/jogos/odds-jogo.tsx`
- Create: `src/components/jogos/__tests__/odds-jogo.test.tsx`

**Interfaces:**
- Consumes: `Odds` (Task 4)
- Produces: `<OddsJogo odds={Odds} />` — botão "ver odds" que expande/recolhe os 3 mercados.

- [ ] **Step 1: Escrever o teste**

```tsx
// src/components/jogos/__tests__/odds-jogo.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OddsJogo } from "../odds-jogo";
import type { Odds } from "@/lib/matches";

const odds: Odds = {
  casa: "2.32",
  empate: "3.10",
  fora: "3.00",
  over25: "1.95",
  under25: "1.85",
  ambas_sim: "1.80",
  ambas_nao: "1.95",
  bookmaker: "bet365",
  capturado_em: "2026-07-16T18:00:00.000Z",
};

describe("OddsJogo", () => {
  it("começa recolhido (valores não visíveis)", () => {
    render(<OddsJogo odds={odds} />);
    expect(screen.getByRole("button", { name: /ver odds/i })).toBeInTheDocument();
    expect(screen.queryByText("2.32")).not.toBeInTheDocument();
  });

  it("expande ao clicar e mostra os valores", async () => {
    const user = userEvent.setup();
    render(<OddsJogo odds={odds} />);
    await user.click(screen.getByRole("button", { name: /ver odds/i }));
    expect(screen.getByText("2.32")).toBeInTheDocument();
    expect(screen.getByText("1.95")).toBeInTheDocument();
    expect(screen.getByText("1.80")).toBeInTheDocument();
  });

  it("omite mercados ausentes (over/under e ambas null)", async () => {
    const user = userEvent.setup();
    const parcial: Odds = {
      ...odds,
      over25: null,
      under25: null,
      ambas_sim: null,
      ambas_nao: null,
    };
    render(<OddsJogo odds={parcial} />);
    await user.click(screen.getByRole("button", { name: /ver odds/i }));
    expect(screen.getByText("2.32")).toBeInTheDocument();
    expect(screen.queryByText(/over 2\.5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ambas marcam/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `npm test -- odds-jogo`
Expected: FAIL (componente inexistente).

- [ ] **Step 3: Implementar `odds-jogo.tsx`**

```tsx
// src/components/jogos/odds-jogo.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Odds } from "@/lib/matches";

function Cotacao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/60 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      <span className="font-display text-sm font-bold tabular-nums">{valor}</span>
    </div>
  );
}

export function OddsJogo({ odds }: { odds: Odds }) {
  const [aberto, setAberto] = useState(false);
  const temOverUnder = odds.over25 != null || odds.under25 != null;
  const temAmbas = odds.ambas_sim != null || odds.ambas_nao != null;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        ver odds
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {odds.casa != null && <Cotacao rotulo="Casa" valor={odds.casa} />}
            {odds.empate != null && <Cotacao rotulo="Empate" valor={odds.empate} />}
            {odds.fora != null && <Cotacao rotulo="Fora" valor={odds.fora} />}
          </div>

          {(temOverUnder || temAmbas) && (
            <div className="flex flex-wrap justify-center gap-2">
              {odds.over25 != null && <Cotacao rotulo="Over 2.5" valor={odds.over25} />}
              {odds.under25 != null && <Cotacao rotulo="Under 2.5" valor={odds.under25} />}
              {odds.ambas_sim != null && (
                <Cotacao rotulo="Ambas marcam" valor={odds.ambas_sim} />
              )}
              {odds.ambas_nao != null && (
                <Cotacao rotulo="Ambas não" valor={odds.ambas_nao} />
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Odds {odds.bookmaker} · meramente informativo
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `npm test -- odds-jogo`
Expected: PASS (3 testes).

> Nota: o teste "omite mercados ausentes" verifica ausência do rótulo "over 2.5"/"ambas marcam";
> como os rótulos só renderizam quando o valor existe, a asserção passa.

- [ ] **Step 5: Commit**

```bash
git add src/components/jogos/odds-jogo.tsx src/components/jogos/__tests__/odds-jogo.test.tsx
git commit -m "feat: OddsJogo (painel recolhivel de odds no card)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Integrar `OddsJogo` no `MatchCard`

**Files:**
- Modify: `src/components/jogos/match-card.tsx`

**Interfaces:**
- Consumes: `OddsJogo` (Task 5); `Match.odds` (Task 4)
- Produces: card renderiza o painel de odds quando há odds e o jogo não está finalizado.

- [ ] **Step 1: Importar e renderizar**

Em `src/components/jogos/match-card.tsx`, adicionar o import no topo:

```typescript
import { OddsJogo } from "@/components/jogos/odds-jogo";
```

E, logo após `<PalpiteForm ... />` (antes de fechar `</article>`):

```tsx
      {match.odds && match.status !== "finalizado" && <OddsJogo odds={match.odds} />}
```

- [ ] **Step 2: Rodar testes + build**

Run: `npm test`
Expected: toda a suíte passa (inclusive `odds` e `odds-jogo`).
Run: `npm run build`
Expected: compila sem erros.

- [ ] **Step 3: Fumaça no browser** (`npm run dev`)

1. `/jogos` do Brasileirão: jogos com odds capturadas mostram "ver odds"; ao clicar, expande Casa/Empate/Fora + Over 2.5/Ambas.
2. Jogo sem odds (ainda fora da janela): sem a seção.
3. Jogo finalizado: sem odds.
4. Dark e light legíveis; foco visível no botão.

- [ ] **Step 4: Commit**

```bash
git add src/components/jogos/match-card.tsx
git commit -m "feat: exibe odds no MatchCard (agendados com odds capturadas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Resumo

6 tarefas: **1 migration** (coluna `odds`), **1 helper puro** (`extrairOdds` + testes), **1 Edge Function** (captura na janela + deploy), **1 camada de dados** (`Odds`/`Match.odds`/`COLS`), **1 componente client** (`OddsJogo` recolhível + testes) e **1 integração** no `MatchCard`. Snapshot único por jogo, quota-friendly. `app_config`/pontuação intocados.
