# Fase 5 — Histórico & Navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao usuário filtros por fase/rodada na tela de jogos e uma tela "Meu histórico" com resumo de desempenho, enriquecendo antes os dados de fase/rodada na ingestão.

**Architecture:** Primeiro um spike confirma se a API expõe rodada; depois a `sync-matches` passa a gravar `fase`/`rodada` (com fallback por data quando a API não traz), e os 73 jogos recebem backfill. No front, `/jogos` vira um server component que lê `?fase=&rodada=` e renderiza chips de filtro; `/historico` é uma nova tela que cruza palpites + jogos finalizados e mostra um resumo calculado por função pura.

**Tech Stack:** Next.js 16 (App Router, server components, search params), TypeScript, Supabase (Postgres + Edge Functions Deno), Tailwind v4, Vitest + React Testing Library, lucide-react.

## Global Constraints

- Nome de exibição: `Cravou!` (sempre com ponto de exclamação, verbatim).
- Idioma da UI: Português do Brasil.
- Next.js 16: `cookies()` é async; middleware é `src/proxy.ts`; consulte `node_modules/next/dist/docs/` antes de usar APIs do Next.
- Pontuação (configurável em `app_config`): `pts_placar_exato=10`, `pts_saldo=7`, `pts_resultado=5`, `pts_gols_time=2`.
- Segredos nunca no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` vão ao browser. Chaves da API só na Edge Function.
- TDD: teste primeiro, vê falhar, implementa, vê passar, commit (um commit por unidade).
- Componentes com hooks/eventos precisam de `"use client"`. Reusar `Button`/`buttonVariants()`, `Reveal`, `avatarPadrao`. Funcionar em dark E light. Ícones lucide (nunca emoji). `cursor-pointer`, foco visível, contraste ≥ 4.5:1, mobile-first.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Edge Functions e migrations:** o arquivo é criado pelo implementador, mas **deploy/aplicação no Supabase é feito pelo controlador** (via MCP: `deploy_edge_function`, `apply_migration`, `get_logs`). O implementador entrega o arquivo + a verificação.

---

## File Structure

**Criar:**
- `src/lib/jogos/rodada.ts` (+ `__tests__/rodada.test.ts`) — função pura `rodadaPorData`.
- `src/lib/historico.ts` (+ `__tests__/historico.test.ts`) — `type ItemHistorico`, `resumoHistorico`.
- `src/components/jogos/jogos-filtro.tsx` (+ `__tests__/jogos-filtro.test.tsx`) — chips de fase/rodada.
- `src/components/historico/resumo.tsx` (+ `__tests__/resumo.test.tsx`) — cards de resumo.
- `src/components/historico/historico-item.tsx` — linha de um jogo no histórico.
- `src/app/historico/page.tsx` — tela "Meu histórico".
- `supabase/migrations/0007_backfill_fase_rodada.sql` — backfill (só se o fallback por data for usado).

**Modificar:**
- `supabase/functions/_shared/fixtures.ts` — `MatchRow` + mappers (fase/rodada).
- `supabase/functions/sync-matches/index.ts` — spike (temporário) e tag de fase por stage.
- `src/lib/matches.ts` — `Match` ganha `rodada` no select; `listarJogos({ fase?, rodada? })`; `listarFasesERodadas()`.
- `src/app/jogos/page.tsx` — ler search params, recorte, `JogosFiltro`.
- `src/components/site-header.tsx` — link "Histórico".

---

### Task 1: Spike — confirmar se a API expõe rodada/estágio

**Files:**
- Modify (temporário): `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Produces: **decisão documentada** — a API traz um campo de rodada por fixture? Qual o nome? Há `tournament_stage_id` distinto por fase?

- [ ] **Step 1: Instrumentar a sync para logar um fixture cru**

Em `supabase/functions/sync-matches/index.ts`, logo após `const [fixtures, results] = await Promise.all(...)`, adicionar temporariamente:

```ts
// SPIKE (remover depois): inspecionar o shape cru da API
console.log("SPIKE fixture[0]:", JSON.stringify(fixtures[0] ?? null));
console.log("SPIKE result[0]:", JSON.stringify(results[0] ?? null));
```

- [ ] **Step 2: Controlador faz deploy da função**

Via MCP `deploy_edge_function` (name `sync-matches`, incluindo `index.ts` e `deno.json`, `verify_jwt` mantém o valor atual da função).

- [ ] **Step 3: Controlador dispara a sync e lê os logs**

Disparar pelo admin (`/admin` → "rodar sync") ou chamar o endpoint com o `x-cron-secret`. Depois, MCP `get_logs` service `edge-function`.

- [ ] **Step 4: Registrar a decisão**

Anotar no PR/commit do Task 2: **(a)** se existe campo de rodada e seu nome (ex.: `round`, `stage`, `round_name`); **(b)** o nome do campo de estágio/fase. Isso define o que o Task 2 lê da API e se o fallback do Task 3 é necessário no caminho real.

- [ ] **Step 5: Remover a instrumentação**

Reverter as linhas `console.log("SPIKE …")`. (Não commitar a instrumentação; o deploy final virá no Task 4.)

---

### Task 2: Enriquecer a ingestão com fase/rodada

**Files:**
- Modify: `supabase/functions/_shared/fixtures.ts`
- Test: `supabase/functions/_shared/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: tipos `FsFixture`/`FsResult` existentes; descoberta do Task 1.
- Produces: `MatchRow` ganha `fase: string` e `rodada: string`. `fixtureToRow(f, fase, rodada)` e `resultToRow(r, fase, rodada)` passam a aceitar `fase` e `rodada` (default `"grupos"` / `""`).

> **Nota de TDD:** os testes deste módulo usam Vitest (já configurado para `supabase/functions/_shared/__tests__`). Rodar com `npm test -- fixtures`.

- [ ] **Step 1: Escrever o teste que falha**

Substituir o conteúdo de `supabase/functions/_shared/__tests__/fixtures.test.ts` por (mantém os casos atuais e adiciona fase/rodada):

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
  it("mapeia um jogo futuro como agendado com fase/rodada", () => {
    const row = fixtureToRow(
      { match_id: "m1", timestamp: 1782327600, home_team: home, away_team: away },
      "grupos",
      "1"
    );
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
      fase: "grupos",
      rodada: "1",
    });
  });

  it("usa defaults quando fase/rodada não são passados", () => {
    const row = fixtureToRow({ match_id: "m1", timestamp: 1, home_team: home, away_team: away });
    expect(row.fase).toBe("grupos");
    expect(row.rodada).toBe("");
  });
});

describe("resultToRow", () => {
  it("mapeia um resultado como finalizado com placar e fase/rodada", () => {
    const row = resultToRow(
      { match_id: "m2", timestamp: 1782266400, home_team: home, away_team: away, scores: { home: 2, away: 0 } },
      "oitavas",
      ""
    );
    expect(row.status).toBe("finalizado");
    expect(row.placar_casa).toBe(2);
    expect(row.placar_fora).toBe(0);
    expect(row.fase).toBe("oitavas");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- fixtures`
Expected: FAIL (mappers não aceitam fase/rodada; `MatchRow` não tem os campos).

- [ ] **Step 3: Implementar**

Em `supabase/functions/_shared/fixtures.ts`, atualizar `MatchRow` e os mappers:

```ts
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
  fase: string;
  rodada: string;
};

// ... tsToIso e base() inalterados ...

export function fixtureToRow(f: FsFixture, fase = "grupos", rodada = ""): MatchRow {
  return {
    ...base(f),
    status: "agendado",
    placar_casa: null,
    placar_fora: null,
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
    fase,
    rodada,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- fixtures`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/__tests__/fixtures.test.ts
git commit -m "feat(sync): MatchRow grava fase/rodada nos mappers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Função pura `rodadaPorData` (fallback de rodada)

**Files:**
- Create: `src/lib/jogos/rodada.ts`
- Test: `src/lib/jogos/__tests__/rodada.test.ts`

**Interfaces:**
- Produces: `rodadaPorData(inicioEm: string, blocos: { rodada: string; ate: string }[]): string` — retorna a `rodada` do primeiro bloco cujo `ate` (ISO, exclusivo no fim) é **posterior** a `inicioEm`; `""` se nenhum bloco contém.

> Usado quando a API não traz rodada (decisão do Task 1). `blocos` é parametrizado (calendário real preenchido por quem chama), nunca hard-coded na lógica.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/jogos/__tests__/rodada.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rodadaPorData } from "@/lib/jogos/rodada";

const blocos = [
  { rodada: "1", ate: "2026-06-17T00:00:00.000Z" },
  { rodada: "2", ate: "2026-06-23T00:00:00.000Z" },
  { rodada: "3", ate: "2026-06-28T00:00:00.000Z" },
];

describe("rodadaPorData", () => {
  it("classifica um jogo no primeiro bloco", () => {
    expect(rodadaPorData("2026-06-12T18:00:00.000Z", blocos)).toBe("1");
  });
  it("classifica um jogo no segundo bloco", () => {
    expect(rodadaPorData("2026-06-20T18:00:00.000Z", blocos)).toBe("2");
  });
  it("classifica um jogo no terceiro bloco", () => {
    expect(rodadaPorData("2026-06-27T18:00:00.000Z", blocos)).toBe("3");
  });
  it("retorna vazio quando depois de todos os blocos", () => {
    expect(rodadaPorData("2026-07-10T18:00:00.000Z", blocos)).toBe("");
  });
  it("fronteira: instante igual ao 'ate' cai no bloco seguinte", () => {
    expect(rodadaPorData("2026-06-17T00:00:00.000Z", blocos)).toBe("2");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- rodada`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/jogos/rodada.ts`:

```ts
// Classifica um jogo numa rodada pelos blocos de data (fallback quando a API
// não traz a rodada). `ate` é o fim exclusivo do bloco (ISO). Blocos em ordem.
export function rodadaPorData(
  inicioEm: string,
  blocos: { rodada: string; ate: string }[]
): string {
  const t = new Date(inicioEm).getTime();
  for (const b of blocos) {
    if (t < new Date(b.ate).getTime()) return b.rodada;
  }
  return "";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- rodada`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/jogos/rodada.ts src/lib/jogos/__tests__/rodada.test.ts
git commit -m "feat: rodadaPorData (fallback de rodada por blocos de data)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deploy da sync enriquecida + backfill dos 73 jogos

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`
- Create (se fallback por data): `supabase/migrations/0007_backfill_fase_rodada.sql`

**Interfaces:**
- Consumes: `fixtureToRow`/`resultToRow` com fase/rodada (Task 2); `rodadaPorData` se necessário (Task 3); descoberta do Task 1.
- Produces: jogos no banco com `fase`/`rodada` populados.

- [ ] **Step 1: Passar fase/rodada no upsert da sync**

Em `supabase/functions/sync-matches/index.ts`, ajustar as chamadas dos mappers para passar a fase (do stage consultado — hoje `"grupos"`) e a rodada (campo da API se o Task 1 confirmou; senão deixar `""` e popular via backfill por data no Step 4). Exemplo com a rodada vindo da API (substituir `r.round` pelo campo real do Task 1):

```ts
for (const f of fixtures)
  porId.set((f as { match_id: string }).match_id,
    fixtureToRow(f as never, "grupos", String((f as { round?: string }).round ?? "")));
for (const r of results)
  porId.set((r as { match_id: string }).match_id,
    resultToRow(r as never, "grupos", String((r as { round?: string }).round ?? "")));
```

Se o Task 1 mostrou que **não há** campo de rodada, manter `""` aqui (o backfill por data no Step 4 cuida da rodada).

- [ ] **Step 2: Controlador faz deploy e dispara a sync**

MCP `deploy_edge_function` (name `sync-matches`, arquivos `index.ts` + `deno.json`). Depois disparar a sync (admin) para reescrever os jogos com fase/rodada. Lembrar: a sync pula `placar_manual=true` — esses não são reescritos pela sync.

- [ ] **Step 3: Verificar**

MCP `execute_sql`:
```sql
select fase, rodada, count(*) from public.matches group by fase, rodada order by 1,2;
```
Esperado: rodadas populadas (`1`/`2`/`3` para grupos) se a API trouxe; senão ainda `''` (segue para o Step 4).

- [ ] **Step 4 (somente se rodada veio vazia): backfill por data**

Calcular os blocos de data reais da fase de grupos a partir dos próprios jogos e gerar `supabase/migrations/0007_backfill_fase_rodada.sql`. Padrão (ajustar as datas-limite ao calendário real, derivado de `select distinct date(inicio_em) from matches order by 1`):

```sql
-- Backfill da rodada dos grupos por blocos de data (fim exclusivo)
update public.matches set rodada = '1'
  where fase = 'grupos' and rodada = '' and inicio_em <  '2026-06-17T00:00:00Z';
update public.matches set rodada = '2'
  where fase = 'grupos' and rodada = '' and inicio_em >= '2026-06-17T00:00:00Z' and inicio_em < '2026-06-23T00:00:00Z';
update public.matches set rodada = '3'
  where fase = 'grupos' and rodada = '' and inicio_em >= '2026-06-23T00:00:00Z';
```
Controlador aplica via MCP `apply_migration` (name `backfill_fase_rodada`) e re-verifica o `group by` do Step 3.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-matches/index.ts supabase/migrations/0007_backfill_fase_rodada.sql
git commit -m "feat(sync): popula fase/rodada na ingestão + backfill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Se o backfill SQL não foi necessário, commitar só o `index.ts`.)

---

### Task 5: Camada de dados — `listarJogos` com filtro + `listarFasesERodadas`

**Files:**
- Modify: `src/lib/matches.ts`

**Interfaces:**
- Consumes: `createClient` de `src/lib/supabase/server.ts`.
- Produces:
  - `Match` ganha `rodada: string`.
  - `listarJogos(filtro?: { fase?: string; rodada?: string }): Promise<Match[]>` — filtra por fase/rodada quando informados; sem filtro, retorna tudo (compatível com chamadas atuais).
  - `listarFasesERodadas(): Promise<{ fase: string; rodadas: string[] }[]>` — fases existentes (ordenadas pela 1ª data) e, em cada uma, as rodadas distintas (ordenadas).

- [ ] **Step 1: Implementar**

Em `src/lib/matches.ts`, atualizar o tipo, o select e adicionar a função. Conteúdo:

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

const COLS =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora";

export async function listarJogos(
  filtro?: { fase?: string; rodada?: string }
): Promise<Match[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("matches").select(COLS).order("inicio_em", { ascending: true });
    if (filtro?.fase) q = q.eq("fase", filtro.fase);
    if (filtro?.rodada) q = q.eq("rodada", filtro.rodada);
    const { data } = await q;
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}

// Fases existentes (ordenadas pela 1ª data) com suas rodadas distintas.
export async function listarFasesERodadas(): Promise<
  { fase: string; rodadas: string[] }[]
> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select("fase, rodada, inicio_em")
      .order("inicio_em", { ascending: true });
    const rows = (data as { fase: string; rodada: string }[]) ?? [];
    const ordem: string[] = [];
    const mapa = new Map<string, string[]>();
    for (const r of rows) {
      if (!mapa.has(r.fase)) {
        mapa.set(r.fase, []);
        ordem.push(r.fase);
      }
      const rodadas = mapa.get(r.fase)!;
      if (r.rodada && !rodadas.includes(r.rodada)) rodadas.push(r.rodada);
    }
    return ordem.map((fase) => ({
      fase,
      rodadas: [...mapa.get(fase)!].sort(),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: compila sem erros (as chamadas atuais de `listarJogos()` sem argumento seguem válidas).

- [ ] **Step 3: Commit**

```bash
git add src/lib/matches.ts
git commit -m "feat: listarJogos com filtro fase/rodada + listarFasesERodadas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Componente `JogosFiltro` + integração na página `/jogos`

**Files:**
- Create: `src/components/jogos/jogos-filtro.tsx`
- Test: `src/components/jogos/__tests__/jogos-filtro.test.tsx`
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `listarFasesERodadas`, `listarJogos`, `listarMeusPalpites`, `getMinutosCorte`; `buttonVariants`.
- Produces: `JogosFiltro({ fases, faseAtiva, rodadaAtiva })` — chips que navegam via `?fase=&rodada=`. `fases` é o retorno de `listarFasesERodadas()`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/jogos/__tests__/jogos-filtro.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
}));

const fases = [
  { fase: "grupos", rodadas: ["1", "2", "3"] },
  { fase: "oitavas", rodadas: [] },
];

describe("JogosFiltro", () => {
  it("renderiza um chip por fase existente", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: /grupos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /oitavas/i })).toBeInTheDocument();
  });

  it("mostra as rodadas da fase ativa", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("marca a fase ativa com aria-current", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: /grupos/i })).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- jogos-filtro`
Expected: FAIL (`JogosFiltro` não existe).

- [ ] **Step 3: Implementar o componente**

Create `src/components/jogos/jogos-filtro.tsx`:

```tsx
"use client";

import { useRouter, usePathname } from "next/navigation";

const FASE_LABEL: Record<string, string> = {
  grupos: "Grupos",
  oitavas: "Oitavas",
  quartas: "Quartas",
  semi: "Semi",
  final: "Final",
};

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

export function JogosFiltro({
  fases,
  faseAtiva,
  rodadaAtiva,
}: {
  fases: { fase: string; rodadas: string[] }[];
  faseAtiva: string;
  rodadaAtiva: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function ir(fase: string, rodada: string) {
    const params = new URLSearchParams();
    if (fase) params.set("fase", fase);
    if (rodada) params.set("rodada", rodada);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const rodadas = fases.find((f) => f.fase === faseAtiva)?.rodadas ?? [];

  return (
    <div className="mb-6 flex flex-col gap-3">
      {fases.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fase">
          {fases.map((f) => (
            <button
              key={f.fase}
              type="button"
              onClick={() => ir(f.fase, "")}
              aria-current={f.fase === faseAtiva ? "true" : undefined}
              className={chip(f.fase === faseAtiva)}
            >
              {FASE_LABEL[f.fase] ?? f.fase}
            </button>
          ))}
        </div>
      )}
      {rodadas.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rodada">
          {rodadas.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => ir(faseAtiva, r)}
              aria-current={r === rodadaAtiva ? "true" : undefined}
              className={chip(r === rodadaAtiva)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- jogos-filtro`
Expected: PASS (3 testes).

- [ ] **Step 5: Integrar na página `/jogos`**

Modify `src/app/jogos/page.tsx` para ler search params e aplicar o recorte. Conteúdo completo:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, listarFasesERodadas } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";

export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; rodada?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const { fase, rodada } = await searchParams;
  const fases = await listarFasesERodadas();

  // Default: primeira fase existente quando nenhuma foi escolhida.
  const faseAtiva = fase ?? fases[0]?.fase ?? "";
  const rodadaAtiva = rodada ?? "";

  const [jogos, palpites, minutosCorte] = await Promise.all([
    listarJogos({ fase: faseAtiva || undefined, rodada: rodadaAtiva || undefined }),
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
        {fases.length > 0 && (
          <JogosFiltro fases={fases} faseAtiva={faseAtiva} rodadaAtiva={rodadaAtiva} />
        )}
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhum jogo neste recorte. Ajuste o filtro acima.
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

- [ ] **Step 6: Rodar testes e build**

Run: `npm test`
Expected: toda a suíte passa.

Run: `npm run build`
Expected: build de produção compila sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/jogos/jogos-filtro.tsx src/components/jogos/__tests__/jogos-filtro.test.tsx src/app/jogos/page.tsx
git commit -m "feat: filtro de fase/rodada na tela de jogos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Função pura `resumoHistorico` + tipo do item

**Files:**
- Create: `src/lib/historico.ts`
- Test: `src/lib/historico.test.ts`

**Interfaces:**
- Produces:
  - `type ItemHistorico = { match: Match; palpiteCasa: number; palpiteFora: number; pontos: number }` (jogos finalizados que o usuário palpitou).
  - `resumoHistorico(itens: ItemHistorico[], ptsMaximo: number): { totalPontos: number; cravadas: number; aproveitamento: number }` — `cravadas` = itens com `pontos === ptsMaximo`; `aproveitamento` = `totalPontos / (itens.length * ptsMaximo)` (0 quando não há itens), arredondado a 2 casas como fração 0–1.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/historico.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resumoHistorico, type ItemHistorico } from "@/lib/historico";
import type { Match } from "@/lib/matches";

const m = (id: string): Match => ({
  id, fase: "grupos", rodada: "1", time_casa: "A", time_fora: "B",
  bandeira_casa: null, bandeira_fora: null, inicio_em: "2026-06-12T18:00:00.000Z",
  status: "finalizado", placar_casa: 2, placar_fora: 1,
});

const itens: ItemHistorico[] = [
  { match: m("1"), palpiteCasa: 2, palpiteFora: 1, pontos: 10 },
  { match: m("2"), palpiteCasa: 1, palpiteFora: 0, pontos: 5 },
  { match: m("3"), palpiteCasa: 0, palpiteFora: 0, pontos: 0 },
];

describe("resumoHistorico", () => {
  it("soma pontos, conta cravadas e calcula aproveitamento", () => {
    const r = resumoHistorico(itens, 10);
    expect(r.totalPontos).toBe(15);
    expect(r.cravadas).toBe(1);
    expect(r.aproveitamento).toBe(0.5); // 15 / (3*10)
  });

  it("aproveitamento 0 quando não há itens", () => {
    expect(resumoHistorico([], 10)).toEqual({ totalPontos: 0, cravadas: 0, aproveitamento: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- historico`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/historico.ts`:

```ts
import type { Match } from "@/lib/matches";

export type ItemHistorico = {
  match: Match;
  palpiteCasa: number;
  palpiteFora: number;
  pontos: number;
};

export function resumoHistorico(
  itens: ItemHistorico[],
  ptsMaximo: number
): { totalPontos: number; cravadas: number; aproveitamento: number } {
  const totalPontos = itens.reduce((s, i) => s + i.pontos, 0);
  const cravadas = itens.filter((i) => i.pontos === ptsMaximo).length;
  const maxPossivel = itens.length * ptsMaximo;
  const aproveitamento =
    maxPossivel === 0 ? 0 : Math.round((totalPontos / maxPossivel) * 100) / 100;
  return { totalPontos, cravadas, aproveitamento };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- historico`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/historico.ts src/lib/historico.test.ts
git commit -m "feat: resumoHistorico (total, cravadas, aproveitamento)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Tela `/historico` (resumo + lista) + link no header

**Files:**
- Create: `src/components/historico/resumo.tsx`
- Test: `src/components/historico/__tests__/resumo.test.tsx`
- Create: `src/components/historico/historico-item.tsx`
- Create: `src/app/historico/page.tsx`
- Modify: `src/components/site-header.tsx`

**Interfaces:**
- Consumes: `resumoHistorico`/`ItemHistorico` (Task 7), `listarMeusPalpites` (Fase 3), `listarJogos` (Task 5), `getSessao`, `avatarPadrao`.
- Produces: `Resumo({ totalPontos, cravadas, aproveitamento })`; `HistoricoItem({ item })`.

- [ ] **Step 1: Escrever o teste do resumo (falha)**

Create `src/components/historico/__tests__/resumo.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Resumo } from "@/components/historico/resumo";

describe("Resumo", () => {
  it("mostra os três indicadores", () => {
    render(<Resumo totalPontos={15} cravadas={1} aproveitamento={0.5} />);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- historico/__tests__/resumo`
Expected: FAIL (`Resumo` não existe).

- [ ] **Step 3: Implementar `Resumo`**

Create `src/components/historico/resumo.tsx`:

```tsx
import { Trophy, Target, Percent } from "lucide-react";

function Card({ icon, valor, rotulo }: { icon: React.ReactNode; valor: string; rotulo: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center">
      <span className="text-accent" aria-hidden="true">{icon}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  );
}

export function Resumo({
  totalPontos,
  cravadas,
  aproveitamento,
}: {
  totalPontos: number;
  cravadas: number;
  aproveitamento: number;
}) {
  return (
    <div className="mb-8 grid grid-cols-3 gap-3">
      <Card icon={<Trophy className="h-5 w-5" />} valor={String(totalPontos)} rotulo="Pontos" />
      <Card icon={<Target className="h-5 w-5" />} valor={String(cravadas)} rotulo="Cravadas" />
      <Card icon={<Percent className="h-5 w-5" />} valor={`${Math.round(aproveitamento * 100)}%`} rotulo="Aproveitamento" />
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- historico/__tests__/resumo`
Expected: PASS.

- [ ] **Step 5: Implementar `HistoricoItem`**

Create `src/components/historico/historico-item.tsx`:

```tsx
import { Trophy } from "lucide-react";
import type { ItemHistorico } from "@/lib/historico";

export function HistoricoItem({ item }: { item: ItemHistorico }) {
  const { match: m, palpiteCasa, palpiteFora, pontos } = item;
  const cravou = palpiteCasa === m.placar_casa && palpiteFora === m.placar_fora;
  const data = new Date(m.inicio_em).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{data}</div>
        <div className="truncate font-medium">
          {m.time_casa} {m.placar_casa}×{m.placar_fora} {m.time_fora}
        </div>
        <div className="text-xs text-muted-foreground">
          Seu palpite: {palpiteCasa}×{palpiteFora}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {cravou ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Cravou! +{pontos}
          </span>
        ) : (
          <span className={`text-sm font-semibold ${pontos > 0 ? "text-primary" : "text-muted-foreground"}`}>
            +{pontos} pts
          </span>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Implementar a página `/historico`**

Create `src/app/historico/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Resumo } from "@/components/historico/resumo";
import { HistoricoItem } from "@/components/historico/historico-item";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";
import { listarMeusPalpites } from "@/lib/predictions";
import { resumoHistorico, type ItemHistorico } from "@/lib/historico";

const PTS_MAXIMO = 10; // pts_placar_exato (default)

export default async function HistoricoPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [jogos, palpites] = await Promise.all([listarJogos(), listarMeusPalpites()]);

  const itens: ItemHistorico[] = jogos
    .filter((j) => j.status === "finalizado" && palpites[j.id])
    .map((j) => {
      const p = palpites[j.id];
      return {
        match: j,
        palpiteCasa: p.palpite_casa,
        palpiteFora: p.palpite_fora,
        pontos: p.pontos ?? 0,
      };
    })
    .sort((a, b) => b.match.inicio_em.localeCompare(a.match.inicio_em));

  const resumo = resumoHistorico(itens, PTS_MAXIMO);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Meu histórico
        </h1>
        {itens.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            Você ainda não tem jogos encerrados com palpite. Seu histórico aparece
            aqui conforme os jogos terminam.
          </p>
        ) : (
          <>
            <Resumo {...resumo} />
            <div className="flex flex-col gap-3">
              {itens.map((item) => (
                <HistoricoItem key={item.match.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 7: Adicionar o link "Histórico" no header**

Modify `src/components/site-header.tsx` — na `<nav>` dos autenticados, adicionar após o link "Ranking":

```tsx
              <Link
                href="/historico"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Histórico
              </Link>
```

- [ ] **Step 8: Rodar testes e build**

Run: `npm test`
Expected: toda a suíte passa.

Run: `npm run build`
Expected: build de produção compila sem erros; rota `/historico` listada.

- [ ] **Step 9: Verificação manual (controlador)**

1. Logado, abrir `/jogos` → chips de fase/rodada; clicar troca o recorte e a URL (`?fase=grupos&rodada=2`).
2. Abrir `/historico` → resumo (pontos/cravadas/aproveitamento) + lista dos jogos finalizados palpitados, mais recentes primeiro.
3. Conferir o link "Histórico" no header.

- [ ] **Step 10: Commit**

```bash
git add src/app/historico/page.tsx src/components/historico/ src/components/site-header.tsx
git commit -m "feat: tela Meu histórico (resumo + lista) e link no header

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Enriquecimento fase/rodada (spike + ingestão + fallback + backfill) → Tasks 1–4. ✓
- Filtros fase/rodada na `/jogos` com estado na URL e default inteligente → Tasks 5–6. ✓ (default = primeira fase existente; quando o mata-mata existir, segue funcionando)
- Tela "Meu histórico" com resumo (pontos/cravadas/aproveitamento) e lista detalhada → Tasks 7–8. ✓
- Reuso de `listarMeusPalpites`/`listarJogos` → Tasks 7–8. ✓
- Funções puras testáveis `rodadaPorData` e `resumoHistorico` → Tasks 3 e 7. ✓
- Link de navegação "Histórico" → Task 8. ✓
- Estado vazio do histórico → Task 8. ✓

**2. Placeholder scan:** Sem TBD/TODO. O único ponto condicional (campo de rodada da API) é resolvido pelo Task 1 e tem caminho concreto nos dois desfechos (API traz → Task 4 Step 1; não traz → Task 4 Step 4 backfill por data). ✓

**3. Type consistency:** `MatchRow` (Task 2) com `fase`/`rodada`; `Match` (Task 5) com `rodada`; `ItemHistorico`/`resumoHistorico` consistentes entre Tasks 7 e 8; `listarFasesERodadas()` retorna `{ fase, rodadas }[]` usado igual em Tasks 5/6. `JogosFiltro` props batem com o uso em `page.tsx`. ✓

**Notas de escopo (YAGNI):** sem estatísticas ricas, sem filtro por status, sem histórico de terceiros, sem edição retroativa.
```
