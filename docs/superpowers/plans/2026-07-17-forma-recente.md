# Forma recente (últimos 5 jogos por equipe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir, no card de cada jogo não finalizado, a forma recente (últimos 5 resultados V/E/D nesta competição) dos dois times, com badges sempre visíveis e detalhe recolhível.

**Architecture:** A forma é derivada em tempo de leitura a partir dos `matches` já sincronizados — sem migration, sem chamada externa, sem alteração no `sync-matches`. Uma função pura `calcularForma` (testável sem banco) transforma a lista de jogos finalizados da competição na forma de um time; `listarFormaCompeticao` faz uma única query e monta o mapa `nomeTime → FormaJogo[]`; um componente client `FormaTimes` (espelhando `OddsJogo`) renderiza os badges e o detalhe no `MatchCard`.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, Supabase (`@supabase/ssr`), React Testing Library + Vitest, Tailwind CSS v4, lucide-react.

## Global Constraints

- **Idioma da UI:** Português do Brasil. Nome de exibição do produto: `Cravou!` (verbatim).
- **Fuso:** toda exibição de data/hora usa `America/Sao_Paulo`.
- **Placar dos 90 min:** `placar_casa`/`placar_fora` já são o placar de tempo normal — usar direto, sem tratamento de prorrogação.
- **UI:** `cursor-pointer` em clicáveis, foco visível (`focus-visible:ring`), contraste ≥ 4.5:1, funcionar em dark E light, ícones lucide (nunca emoji). Badges V/E/D não podem depender só de cor — a letra vai dentro do badge.
- **TDD:** teste primeiro, ver falhar, implementar, ver passar, commit (um commit por unidade).
- **Commits** terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Comandos:** `npm test` (vitest run único), `npm run build` (inclui type-check).

## File Structure

- `src/lib/matches.ts` (modificar) — tipos `ResultadoForma`/`FormaJogo`, função pura `calcularForma`, e `listarFormaCompeticao` (query + montagem do mapa).
- `src/lib/__tests__/forma.test.ts` (criar) — testes de `calcularForma`.
- `src/components/jogos/forma-times.tsx` (criar) — componente client (badges + recolhível).
- `src/components/jogos/__tests__/forma-times.test.tsx` (criar) — testes do componente.
- `src/components/jogos/match-card.tsx` (modificar) — aceita e renderiza a forma.
- `src/components/jogos/__tests__/match-card.test.tsx` (modificar) — teste da regra de exibição.
- `src/app/jogos/page.tsx` (modificar) — busca a forma e passa aos cards.

---

### Task 1: Função pura `calcularForma` + tipos

**Files:**
- Modify: `src/lib/matches.ts` (adicionar tipos e função; não altera o existente)
- Test: `src/lib/__tests__/forma.test.ts`

**Interfaces:**
- Consumes: tipo `Match` já exportado de `src/lib/matches.ts`.
- Produces:
  ```ts
  export type ResultadoForma = "V" | "E" | "D";
  export type FormaJogo = {
    resultado: ResultadoForma;
    golsPro: number;
    golsContra: number;
    adversario: string;
    mando: "casa" | "fora";
    inicioEm: string; // ISO
  };
  export function calcularForma(
    jogosFinalizados: Pick<Match, "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em">[],
    time: string,
  ): FormaJogo[]; // no máx. 5, ordenada mais antigo → mais recente
  ```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/forma.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularForma } from "@/lib/matches";

type J = {
  time_casa: string;
  time_fora: string;
  placar_casa: number | null;
  placar_fora: number | null;
  inicio_em: string;
};

// Helper: jogo em ordem cronológica crescente por índice
function jogo(p: Partial<J> & Pick<J, "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em">): J {
  return p;
}

describe("calcularForma", () => {
  it("pega só os 5 mais recentes, ordenados mais antigo → mais recente", () => {
    // 6 jogos do Botafogo, datas crescentes
    const jogos: J[] = Array.from({ length: 6 }, (_, i) =>
      jogo({
        time_casa: "Botafogo",
        time_fora: `Adv${i}`,
        placar_casa: 1,
        placar_fora: 0,
        inicio_em: `2026-07-0${i + 1}T22:00:00.000Z`,
      }),
    );
    const forma = calcularForma(jogos, "Botafogo");
    expect(forma).toHaveLength(5);
    // mais antigo primeiro (2026-07-02) e mais recente por último (2026-07-06)
    expect(forma[0].inicioEm).toBe("2026-07-02T22:00:00.000Z");
    expect(forma[4].inicioEm).toBe("2026-07-06T22:00:00.000Z");
    expect(forma[0].adversario).toBe("Adv1");
  });

  it("retorna menos de 5 quando o time tem poucos jogos", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Santos", time_fora: "Inter", placar_casa: 0, placar_fora: 0, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Grêmio", time_fora: "Santos", placar_casa: 2, placar_fora: 1, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Santos")).toHaveLength(2);
  });

  it("calcula V/E/D corretamente como mandante", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Time", time_fora: "X", placar_casa: 2, placar_fora: 1, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Y", placar_casa: 1, placar_fora: 1, inicio_em: "2026-07-02T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Z", placar_casa: 0, placar_fora: 3, inicio_em: "2026-07-03T22:00:00.000Z" }),
    ];
    const forma = calcularForma(jogos, "Time");
    expect(forma.map((f) => f.resultado)).toEqual(["V", "E", "D"]);
    expect(forma[0]).toMatchObject({ mando: "casa", adversario: "X", golsPro: 2, golsContra: 1 });
  });

  it("calcula V/E/D corretamente como visitante (placar espelhado)", () => {
    const jogos: J[] = [
      jogo({ time_casa: "X", time_fora: "Time", placar_casa: 0, placar_fora: 2, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Y", time_fora: "Time", placar_casa: 3, placar_fora: 0, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    const forma = calcularForma(jogos, "Time");
    expect(forma.map((f) => f.resultado)).toEqual(["V", "D"]);
    expect(forma[0]).toMatchObject({ mando: "fora", adversario: "X", golsPro: 2, golsContra: 0 });
  });

  it("ignora jogos com placar nulo", () => {
    const jogos: J[] = [
      jogo({ time_casa: "Time", time_fora: "X", placar_casa: null, placar_fora: null, inicio_em: "2026-07-01T22:00:00.000Z" }),
      jogo({ time_casa: "Time", time_fora: "Y", placar_casa: 1, placar_fora: 0, inicio_em: "2026-07-02T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Time")).toHaveLength(1);
  });

  it("ignora jogos onde o time não participa", () => {
    const jogos: J[] = [
      jogo({ time_casa: "A", time_fora: "B", placar_casa: 1, placar_fora: 0, inicio_em: "2026-07-01T22:00:00.000Z" }),
    ];
    expect(calcularForma(jogos, "Time")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- forma.test`
Expected: FAIL — `calcularForma` não está exportado de `@/lib/matches`.

- [ ] **Step 3: Implementar os tipos e a função**

Em `src/lib/matches.ts`, adicionar após o tipo `Match` (e antes de `const COLS`):

```ts
export type ResultadoForma = "V" | "E" | "D";

export type FormaJogo = {
  resultado: ResultadoForma;
  golsPro: number;
  golsContra: number;
  adversario: string;
  mando: "casa" | "fora";
  inicioEm: string;
};

export function calcularForma(
  jogosFinalizados: Pick<
    Match,
    "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em"
  >[],
  time: string,
): FormaJogo[] {
  return jogosFinalizados
    .filter(
      (j) =>
        (j.time_casa === time || j.time_fora === time) &&
        j.placar_casa != null &&
        j.placar_fora != null,
    )
    .sort((a, b) => a.inicio_em.localeCompare(b.inicio_em)) // mais antigo → mais recente
    .slice(-5)
    .map((j) => {
      const mando: "casa" | "fora" = j.time_casa === time ? "casa" : "fora";
      const golsPro = (mando === "casa" ? j.placar_casa : j.placar_fora) as number;
      const golsContra = (mando === "casa" ? j.placar_fora : j.placar_casa) as number;
      const adversario = mando === "casa" ? j.time_fora : j.time_casa;
      const resultado: ResultadoForma =
        golsPro > golsContra ? "V" : golsPro === golsContra ? "E" : "D";
      return { resultado, golsPro, golsContra, adversario, mando, inicioEm: j.inicio_em };
    });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- forma.test`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches.ts src/lib/__tests__/forma.test.ts
git commit -m "feat: calcularForma (ultimos 5 jogos por equipe)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `listarFormaCompeticao` (query + mapa)

**Files:**
- Modify: `src/lib/matches.ts` (adicionar a função no fim do arquivo)

**Interfaces:**
- Consumes: `calcularForma` e o tipo `FormaJogo` da Task 1; `createClient` de `@/lib/supabase/server` (já importado no topo do arquivo).
- Produces:
  ```ts
  export async function listarFormaCompeticao(
    competicaoId: string,
  ): Promise<Map<string, FormaJogo[]>>;
  ```

**Nota:** esta função faz I/O (Supabase) e não tem teste unitário próprio — a lógica testável está em `calcularForma` (Task 1). É exercitada de ponta a ponta no build/uso. Fold a implementação num único commit.

- [ ] **Step 1: Implementar `listarFormaCompeticao`**

Adicionar ao final de `src/lib/matches.ts`:

```ts
// Forma recente (últimos 5 jogos por equipe) de todos os times da competição.
// Deriva de matches finalizados já sincronizados — sem chamadas externas.
export async function listarFormaCompeticao(
  competicaoId: string,
): Promise<Map<string, FormaJogo[]>> {
  const mapa = new Map<string, FormaJogo[]>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select("time_casa, time_fora, placar_casa, placar_fora, inicio_em")
      .eq("competicao_id", competicaoId)
      .eq("status", "finalizado")
      .order("inicio_em", { ascending: true });
    const jogos =
      (data as Pick<
        Match,
        "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em"
      >[]) ?? [];
    const times = new Set<string>();
    for (const j of jogos) {
      times.add(j.time_casa);
      times.add(j.time_fora);
    }
    for (const time of times) {
      mapa.set(time, calcularForma(jogos, time));
    }
    return mapa;
  } catch {
    return mapa;
  }
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run build`
Expected: build passa sem erros de tipo (não precisa subir servidor; o objetivo é só o type-check).

- [ ] **Step 3: Commit**

```bash
git add src/lib/matches.ts
git commit -m "feat: listarFormaCompeticao (mapa de forma por time)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Componente `FormaTimes` (badges + recolhível)

**Files:**
- Create: `src/components/jogos/forma-times.tsx`
- Test: `src/components/jogos/__tests__/forma-times.test.tsx`

**Interfaces:**
- Consumes: tipo `FormaJogo` de `@/lib/matches`; `ChevronDown` de `lucide-react`; `traduzirPais` de `@/lib/i18n/paises` (usado no MatchCard para nomes — aqui os nomes já chegam traduzidos via props, ver Task 4).
- Produces:
  ```ts
  export function FormaTimes(props: {
    nomeCasa: string;
    nomeFora: string;
    formaCasa: FormaJogo[];
    formaFora: FormaJogo[];
  }): JSX.Element;
  ```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/components/jogos/__tests__/forma-times.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormaTimes } from "@/components/jogos/forma-times";
import type { FormaJogo } from "@/lib/matches";

function f(resultado: "V" | "E" | "D", adversario: string): FormaJogo {
  return {
    resultado,
    golsPro: resultado === "V" ? 2 : 1,
    golsContra: resultado === "V" ? 0 : resultado === "E" ? 1 : 3,
    adversario,
    mando: "casa",
    inicioEm: "2026-07-01T22:00:00.000Z",
  };
}

describe("FormaTimes", () => {
  it("mostra a letra V/E/D nos badges (não depende só de cor) e esconde o detalhe", () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "X"), f("E", "Y")]}
        formaFora={[f("D", "Z")]}
      />,
    );
    // letras presentes nos badges
    expect(screen.getAllByText("V").length).toBeGreaterThan(0);
    // detalhe (adversário) começa oculto
    expect(screen.queryByText(/X/)).toBeNull();
  });

  it("expande o detalhe ao clicar em 'ver forma'", async () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "Adversário1")]}
        formaFora={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /ver forma/i }));
    expect(screen.getByText(/Adversário1/)).toBeInTheDocument();
  });

  it("omite a linha de um time sem jogos", () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "X")]}
        formaFora={[]}
      />,
    );
    // Botafogo aparece (tem forma); nome do time sem forma não vira linha de badges.
    expect(screen.getByText("Botafogo")).toBeInTheDocument();
    expect(screen.queryByText("Santos")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- forma-times.test`
Expected: FAIL — módulo `forma-times` não existe.

- [ ] **Step 3: Implementar `FormaTimes`**

Criar `src/components/jogos/forma-times.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FormaJogo, ResultadoForma } from "@/lib/matches";

const COR: Record<ResultadoForma, string> = {
  V: "bg-green-600 text-white",
  E: "bg-amber-500 text-black",
  D: "bg-red-600 text-white",
};

const ROTULO: Record<ResultadoForma, string> = { V: "Vitória", E: "Empate", D: "Derrota" };

function Badge({ jogo }: { jogo: FormaJogo }) {
  const placar =
    jogo.mando === "casa"
      ? `${jogo.golsPro}×${jogo.golsContra}`
      : `${jogo.golsContra}×${jogo.golsPro}`;
  const rotulo = `${ROTULO[jogo.resultado]} — ${jogo.mando === "casa" ? "" : "fora, "}${placar} vs ${jogo.adversario}`;
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${COR[jogo.resultado]}`}
      title={rotulo}
      aria-label={rotulo}
    >
      {jogo.resultado}
    </span>
  );
}

function LinhaBadges({ nome, forma }: { nome: string; forma: FormaJogo[] }) {
  if (forma.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-xs font-medium">{nome}</span>
      <span className="flex shrink-0 gap-1">
        {forma.map((j, i) => (
          <Badge key={i} jogo={j} />
        ))}
      </span>
    </div>
  );
}

function DetalheTime({ nome, forma }: { nome: string; forma: FormaJogo[] }) {
  if (forma.length === 0) return null;
  return (
    <div className="text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">{nome}:</span>{" "}
      {forma
        .slice()
        .reverse()
        .map((j) => {
          const placar =
            j.mando === "casa"
              ? `${j.golsPro}×${j.golsContra}`
              : `${j.golsContra}×${j.golsPro}`;
          return `${placar} ${j.adversario} (${j.resultado})`;
        })
        .join(" · ")}
    </div>
  );
}

export function FormaTimes({
  nomeCasa,
  nomeFora,
  formaCasa,
  formaFora,
}: {
  nomeCasa: string;
  nomeFora: string;
  formaCasa: FormaJogo[];
  formaFora: FormaJogo[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex flex-col gap-1">
        <LinhaBadges nome={nomeCasa} forma={formaCasa} />
        <LinhaBadges nome={nomeFora} forma={formaFora} />
      </div>

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        ver forma
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-1">
          <DetalheTime nome={nomeCasa} forma={formaCasa} />
          <DetalheTime nome={nomeFora} forma={formaFora} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- forma-times.test`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/jogos/forma-times.tsx src/components/jogos/__tests__/forma-times.test.tsx
git commit -m "feat: componente FormaTimes (badges V/E/D + detalhe recolhivel)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Integrar no `MatchCard`

**Files:**
- Modify: `src/components/jogos/match-card.tsx`
- Modify: `src/components/jogos/__tests__/match-card.test.tsx`

**Interfaces:**
- Consumes: `FormaTimes` (Task 3); tipo `FormaJogo` (Task 1); `traduzirPais` (já importado no MatchCard).
- Produces: `MatchCard` ganha props opcionais `formaCasa?: FormaJogo[]` e `formaFora?: FormaJogo[]`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/components/jogos/__tests__/match-card.test.tsx` um teste da regra de exibição. Primeiro, no topo do arquivo garantir os imports necessários (se ainda não presentes): `import type { FormaJogo } from "@/lib/matches";`. Depois adicionar:

```tsx
const formaExemplo: FormaJogo[] = [
  { resultado: "V", golsPro: 2, golsContra: 0, adversario: "X", mando: "casa", inicioEm: "2026-07-01T22:00:00.000Z" },
];

it("mostra a forma em jogo não finalizado quando há dados", () => {
  const match = { ...matchBase, status: "agendado" as const };
  render(<MatchCard match={match} formaCasa={formaExemplo} formaFora={[]} />);
  expect(screen.getByRole("button", { name: /ver forma/i })).toBeInTheDocument();
});

it("não mostra a forma em jogo finalizado", () => {
  const match = { ...matchBase, status: "finalizado" as const, placar_casa: 1, placar_fora: 0 };
  render(<MatchCard match={match} formaCasa={formaExemplo} formaFora={[]} />);
  expect(screen.queryByRole("button", { name: /ver forma/i })).toBeNull();
});
```

> **Nota para o implementador:** o teste usa `matchBase` — o objeto `Match` de exemplo já existente no arquivo de teste. Se o nome local for outro (ex.: `baseMatch`, `jogo`), reutilize o que já estiver definido no arquivo em vez de criar um novo; ajuste apenas os campos `status`/placar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- match-card.test`
Expected: FAIL — `MatchCard` ainda não aceita `formaCasa`/`formaFora` nem renderiza `FormaTimes`.

- [ ] **Step 3: Implementar no `MatchCard`**

Em `src/components/jogos/match-card.tsx`:

1. Adicionar o import no topo (junto dos outros de `@/components/jogos`):
```tsx
import { FormaTimes } from "@/components/jogos/forma-times";
import type { FormaJogo } from "@/lib/matches";
```

2. Estender a assinatura de props da função `MatchCard`:
```tsx
export function MatchCard({
  match,
  palpite,
  minutosCorte = 10,
  formaCasa = [],
  formaFora = [],
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte?: number;
  formaCasa?: FormaJogo[];
  formaFora?: FormaJogo[];
}) {
```

3. Após a linha do bloco de odds (`{match.odds && match.status !== "finalizado" && <OddsJogo odds={match.odds} />}`), adicionar:
```tsx
      {match.status !== "finalizado" &&
        (formaCasa.length > 0 || formaFora.length > 0) && (
          <FormaTimes
            nomeCasa={traduzirPais(match.time_casa)}
            nomeFora={traduzirPais(match.time_fora)}
            formaCasa={formaCasa}
            formaFora={formaFora}
          />
        )}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- match-card.test`
Expected: PASS (os testes existentes + os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/components/jogos/match-card.tsx src/components/jogos/__tests__/match-card.test.tsx
git commit -m "feat: MatchCard renderiza forma dos times em jogos nao finalizados

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Ligar a forma na página de jogos

**Files:**
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `listarFormaCompeticao` (Task 2); `MatchCard` com props `formaCasa`/`formaFora` (Task 4).
- Produces: nenhuma (integração final).

**Nota:** integração de server component; validada por `npm run build` e teste manual. Fold num único commit.

- [ ] **Step 1: Buscar a forma junto dos jogos**

Em `src/app/jogos/page.tsx`:

1. Adicionar `listarFormaCompeticao` ao import de `@/lib/matches`:
```tsx
import { listarJogos, listarFormaCompeticao } from "@/lib/matches";
```

2. Após o bloco que resolve `jogos` e `palpites` (o `Promise.all` das linhas ~42-52), adicionar a busca da forma (só quando há competição atual):
```tsx
  const formaPorTime = atual
    ? await listarFormaCompeticao(atual.id)
    : new Map();
```

- [ ] **Step 2: Passar a forma a cada card**

Substituir o `<MatchCard>` dentro do `jogos.map(...)` por:
```tsx
                {jogos.map((j) => (
                  <MatchCard
                    key={j.id}
                    match={j}
                    palpite={palpites[j.id]}
                    minutosCorte={minutosCorte}
                    formaCasa={formaPorTime.get(j.time_casa) ?? []}
                    formaFora={formaPorTime.get(j.time_fora) ?? []}
                  />
                ))}
```

- [ ] **Step 3: Verificar build + testes**

Run: `npm run build && npm test`
Expected: build passa (type-check ok) e toda a suíte de testes passa.

- [ ] **Step 4: Commit**

```bash
git add src/app/jogos/page.tsx
git commit -m "feat: pagina de jogos exibe forma recente dos times

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Cálculo da forma (5 mais recentes, V/E/D mandante/visitante, <5 jogos, escopo competição) → Task 1. ✅
- Fonte do nosso banco, 1 query, mapa por time → Task 2. ✅
- Badges com letra (acessível) + detalhe recolhível → Task 3. ✅
- Renderizar só em não-finalizado e com dados → Task 4. ✅
- Página passa a forma aos cards → Task 5. ✅
- Sem migration / sem alteração no sync → respeitado (nenhuma task toca migrations ou `sync-matches`). ✅
- Testes de `calcularForma`, `FormaTimes`, `MatchCard` → Tasks 1, 3, 4. ✅

**Placeholder scan:** nenhum "TBD/TODO"; todo passo com código completo. ✅

**Type consistency:** `FormaJogo`/`ResultadoForma`/`calcularForma`/`listarFormaCompeticao` usados com a mesma assinatura em todas as tasks; props `formaCasa`/`formaFora` idênticas entre Task 4 e Task 5. ✅

## Encerramento (após Task 5)

- `npm test` + `npm run build` verdes.
- Push para `master` (Vercel deploya automático).
- Registrar no Obsidian Vault (`registrar-no-vault`) — protocolo de encerramento do projeto.
- Atualizar `NEXT_STEPS.md` marcando a 2ª spec como concluída.
