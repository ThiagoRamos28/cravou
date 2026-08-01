# Listagens de Jogos: Data, Ordenação e Paginação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar da memória o que deveria ser query — para que `/jogos` e `/historico` ganhem filtro por intervalo de datas, inversão de ordem e paginação real, e a landing pare de mostrar jogos antigos de competições que o usuário nem acompanha.

**Architecture:** As opções de `listarJogos` passam a virar cláusulas PostgREST em vez de filtros em memória, e a função devolve `{ jogos, total }` (o total vem de `{ count: "exact" }` na mesma ida ao banco). A tradução difícil — fronteiras de data em BRT e conjuntos de status — vive em funções puras num módulo novo, testável sem banco. `/historico` passa a cruzar jogos e palpites no Postgres via embed `predictions!inner`, com o resumo calculado sobre o conjunto filtrado inteiro e a lista paginada.

**Tech Stack:** Next.js 16 (App Router, server components + server actions) · TypeScript · Supabase (`@supabase/supabase-js` 2.108) · Tailwind v4 · Vitest + React Testing Library

## Global Constraints

- **Nome de exibição:** `Cravou!` — sempre com ponto de exclamação, verbatim.
- **Idioma da UI e dos identificadores de domínio:** Português do Brasil (`situacao`, `ordem`, `diaSeguinte`, `limitesDeData`).
- **Fuso horário:** `America/Sao_Paulo` (BRT, UTC−3) em toda exibição. `inicio_em` é UTC no banco. O offset `-03:00` é fixo — correto no Brasil desde a extinção do horário de verão em 2019, e é premissa assumida da spec.
- **TDD obrigatório:** escreva o teste, veja falhar, implemente, veja passar, commit. Um commit por unidade.
- **Mensagens de commit** terminam com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Checklist de UI:** `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1, transições 150–300ms, responsivo mobile-first, funciona em dark **e** light. Reusar `Button`/`buttonVariants()`.
- **Ícones:** `lucide-react`. Nunca emoji como ícone.
- **Componentes com hooks precisam de `"use client"`.**
- **Tamanho de página:** `JOGOS_POR_PAGINA = 20`.
- **Defaults de `listarJogos`:** `situacao: "a_fazer"`, `ordem: "asc"`, `offset: 0`, `limite: JOGOS_POR_PAGINA`, `apenasFuturos: false`, `incluirNaoJogaveis: false`.
- **Estados de `matches.status`:** `agendado`, `ao_vivo`, `finalizado`, `adiado`, `cancelado`.
- Comandos: `npm test`, `npm run build`. Não instalar dependências novas.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/jogos/constantes.ts` | `JOGOS_POR_PAGINA` — client-safe, sem imports de servidor | Criar |
| `src/lib/jogos/filtros.ts` | funções puras: `diaSeguinte`, `limitesDeData`, `statusPorSituacao` | Criar |
| `src/lib/jogos/__tests__/filtros.test.ts` | testes das puras | Criar |
| `src/lib/matches.ts` | `listarJogos` monta a query e devolve `{ jogos, total }` | Modificar |
| `src/lib/__tests__/matches-query.test.ts` | prova que os filtros chegam à query | Criar |
| `src/lib/historico.ts` | `resumoHistorico` sobre projeção estreita | Modificar |
| `src/lib/historico-dados.ts` | lista paginada + linhas do resumo, via embed `predictions!inner` | Criar |
| `src/app/jogos/page.tsx` | lê `searchParams` novos; renderiza 1ª página | Modificar |
| `src/app/jogos/actions.ts` | server action `carregarMaisJogos` | Modificar |
| `src/components/jogos/filtro-periodo.tsx` | `FiltroPeriodo` (data + ordem + limpar) e o hook `useNavegarFiltro`, compartilhados pelas duas telas | Criar |
| `src/components/jogos/jogos-filtro.tsx` | chips de situação, compondo `FiltroPeriodo` | Modificar |
| `src/components/jogos/jogos-lista.tsx` | lista client que acumula páginas | Criar |
| `src/app/historico/page.tsx` | resumo do conjunto filtrado + lista paginada | Modificar |
| `src/app/historico/actions.ts` | server action `carregarMaisHistorico` | Criar |
| `src/components/historico/historico-lista.tsx` | lista client que acumula páginas | Criar |
| `src/app/page.tsx` | landing: só futuros, da competição, com opt-in | Modificar |
| `src/app/admin/page.tsx`, `src/app/admin/auditoria/page.tsx` | adaptar ao retorno `{ jogos, total }` | Modificar |

---

### Task 1: Funções puras de filtro

**Files:**
- Create: `src/lib/jogos/constantes.ts`
- Create: `src/lib/jogos/filtros.ts`
- Test: `src/lib/jogos/__tests__/filtros.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `JOGOS_POR_PAGINA`, `type Situacao = "a_fazer" | "encerrados" | "todos"`, `diaSeguinte(data: string): string`, `limitesDeData(de?: string, ate?: string): { gte?: string; lt?: string }`, `statusPorSituacao(situacao: Situacao, incluirNaoJogaveis: boolean): string[] | null`. As Tasks 2 e 4 consomem todas.

**O caso que erra em silêncio:** um jogo às 21h de 31/07 em Brasília é `2026-08-01T00:00:00Z` no banco. Se o filtro comparar a data crua, esse jogo **não** é encontrado pelo dia 31/07 — ele vaza para 01/08. É por isso que a fronteira leva offset explícito.

- [ ] **Step 1: Escreva os testes que falham**

Crie `src/lib/jogos/__tests__/filtros.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diaSeguinte, limitesDeData, statusPorSituacao } from "@/lib/jogos/filtros";

describe("diaSeguinte", () => {
  it("avança um dia comum", () => {
    expect(diaSeguinte("2026-07-15")).toBe("2026-07-16");
  });

  it("vira o mês", () => {
    expect(diaSeguinte("2026-07-31")).toBe("2026-08-01");
  });

  it("vira o ano", () => {
    expect(diaSeguinte("2026-12-31")).toBe("2027-01-01");
  });

  it("acerta fevereiro em ano bissexto", () => {
    expect(diaSeguinte("2028-02-28")).toBe("2028-02-29");
  });

  it("acerta fevereiro em ano comum", () => {
    expect(diaSeguinte("2026-02-28")).toBe("2026-03-01");
  });
});

describe("limitesDeData", () => {
  it("sem datas, não impõe limite", () => {
    expect(limitesDeData()).toEqual({});
  });

  it("só `de` vira limite inferior em BRT", () => {
    expect(limitesDeData("2026-07-15")).toEqual({
      gte: "2026-07-15T00:00:00-03:00",
    });
  });

  it("só `ate` vira limite superior exclusivo no dia seguinte", () => {
    expect(limitesDeData(undefined, "2026-07-15")).toEqual({
      lt: "2026-07-16T00:00:00-03:00",
    });
  });

  it("intervalo fechado cobre os dois dias inteiros", () => {
    expect(limitesDeData("2026-07-15", "2026-07-31")).toEqual({
      gte: "2026-07-15T00:00:00-03:00",
      lt: "2026-08-01T00:00:00-03:00",
    });
  });

  it("um único dia cobre as 24h daquele dia em BRT", () => {
    const { gte, lt } = limitesDeData("2026-07-31", "2026-07-31");
    // Um jogo às 21h BRT de 31/07 é 2026-08-01T00:00:00Z — tem que cair dentro.
    const jogo21hBRT = new Date("2026-08-01T00:00:00Z").getTime();
    expect(new Date(gte!).getTime()).toBeLessThanOrEqual(jogo21hBRT);
    expect(new Date(lt!).getTime()).toBeGreaterThan(jogo21hBRT);
  });
});

describe("statusPorSituacao", () => {
  it("a_fazer = ainda não terminou (fecha o buraco dos 10 min)", () => {
    expect(statusPorSituacao("a_fazer", false)).toEqual(["agendado", "ao_vivo"]);
  });

  it("encerrados = só finalizado", () => {
    expect(statusPorSituacao("encerrados", false)).toEqual(["finalizado"]);
  });

  it("todos exclui adiado e cancelado", () => {
    expect(statusPorSituacao("todos", false)).toEqual([
      "agendado",
      "ao_vivo",
      "finalizado",
    ]);
  });

  it("incluirNaoJogaveis remove a restrição de status (visão do admin)", () => {
    expect(statusPorSituacao("todos", true)).toBeNull();
  });

  it("incluirNaoJogaveis não afeta um recorte explícito de situação", () => {
    expect(statusPorSituacao("encerrados", true)).toEqual(["finalizado"]);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npm test -- filtros`
Expected: FAIL — não existe `@/lib/jogos/filtros`.

- [ ] **Step 3: Crie a constante**

`src/lib/jogos/constantes.ts`:

```ts
// Client-safe: nada de imports de servidor aqui. A lista client precisa deste valor
// para saber se ainda há página seguinte (mesmo arranjo de src/lib/feed-constants.ts).
export const JOGOS_POR_PAGINA = 20;
```

- [ ] **Step 4: Implemente as puras**

`src/lib/jogos/filtros.ts`:

```ts
export type Situacao = "a_fazer" | "encerrados" | "todos";

// "2026-07-31" → "2026-08-01". Usa UTC de propósito: aqui só interessa a aritmética de
// calendário, não o instante — construir com fuso local viraria o dia em máquinas a oeste.
export function diaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// O usuário escolhe DIAS DO CALENDÁRIO DE BRASÍLIA; `inicio_em` é UTC. Comparar a data crua
// deixaria um jogo às 21h de 31/07 BRT (= 01/08 00:00 UTC) fora do filtro do dia 31.
// Por isso a fronteira carrega o offset explícito e o Postgres resolve a conversão.
// `ate` é INCLUSIVO: o limite superior é a meia-noite do dia seguinte, exclusiva.
export function limitesDeData(
  de?: string,
  ate?: string
): { gte?: string; lt?: string } {
  const limites: { gte?: string; lt?: string } = {};
  if (de) limites.gte = `${de}T00:00:00-03:00`;
  if (ate) limites.lt = `${diaSeguinte(ate)}T00:00:00-03:00`;
  return limites;
}

// `null` = nenhuma restrição de status (só o /admin pede isso, para poder corrigir jogo
// adiado/cancelado à mão). Fora daí, adiado e cancelado nunca entram numa listagem.
export function statusPorSituacao(
  situacao: Situacao,
  incluirNaoJogaveis: boolean
): string[] | null {
  if (situacao === "encerrados") return ["finalizado"];
  if (situacao === "a_fazer") return ["agendado", "ao_vivo"];
  return incluirNaoJogaveis ? null : ["agendado", "ao_vivo", "finalizado"];
}
```

- [ ] **Step 5: Rode e confirme que passa**

Run: `npm test -- filtros`
Expected: PASS — 16 testes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/jogos/
git commit -m "feat: funcoes puras de filtro de jogos (data em BRT, status por situacao)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `listarJogos` vira query de verdade

**Files:**
- Modify: `src/lib/matches.ts:72-106` (`listarJogos`)
- Modify: `src/app/jogos/page.tsx`, `src/app/page.tsx`, `src/app/historico/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/auditoria/page.tsx` (adaptar ao novo retorno)
- Test: `src/lib/__tests__/matches-query.test.ts` (criar)

**Interfaces:**
- Consumes: `Situacao`, `limitesDeData`, `statusPorSituacao`, `JOGOS_POR_PAGINA` da Task 1.
- Produces: `listarJogos(filtro?): Promise<{ jogos: Match[]; total: number }>` com as opções da spec. As Tasks 3, 4 e 5 consomem.

**Atenção — mudança de retorno em 5 lugares.** `listarJogos` deixa de devolver `Match[]` e passa a devolver `{ jogos, total }`. O type-check do `npm run build` acha todos os consumidores; nesta task o objetivo é só **manter o comportamento equivalente** em cada um deles, sem UI nova (isso vem nas Tasks 3-5).

Tradução por call site nesta task:

| Arquivo | Antes | Depois |
|---|---|---|
| `app/jogos/page.tsx` | `soAbertos: soAbertosAtivo, soEncerrados: soEncerradosAtivo, minutosCorte` | `situacao` derivada dos mesmos searchParams, sem `minutosCorte` |
| `app/page.tsx` | `soAbertos: true, minutosCorte, limite: 6` | `situacao: "a_fazer", limite: 6` (o resto vem na Task 5) |
| `app/historico/page.tsx` | `{ competicaoId }` | `{ competicaoId, situacao: "encerrados", limite: 500 }` (substituído de vez na Task 4) |
| `app/admin/page.tsx` | `{ incluirNaoJogaveis: true }` | `{ situacao: "todos", incluirNaoJogaveis: true, limite: 500 }` |
| `app/admin/auditoria/page.tsx` | `{ soEncerrados: true }` | `{ situacao: "encerrados", limite: 500 }` |

O `limite: 500` nos três casos que ainda não têm paginação é **deliberado e temporário**: sem ele o default de 20 truncaria silenciosamente essas telas. As Tasks 3 e 4 substituem isso por paginação real no `/jogos` e `/historico`; `/admin` e `/admin/auditoria` ficam com o teto explícito, que é honesto e visível.

- [ ] **Step 1: Escreva o teste que falha**

O ponto deste teste é provar que os filtros **viram query**, não filtro em memória. O mock registra cada método chamado no query builder:

Crie `src/lib/__tests__/matches-query.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const chamadas: Array<[string, unknown[]]> = [];
const resposta: { data: unknown[]; count: number } = { data: [], count: 0 };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      chamadas.push(["from", [tabela]]);
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "eq", "in", "gte", "lt", "gt", "range"]) {
        q[m] = (...args: unknown[]) => {
          chamadas.push([m, args]);
          return q;
        };
      }
      q.then = (resolve: (v: unknown) => unknown) => resolve(resposta);
      return q;
    },
  }),
}));

import { listarJogos } from "@/lib/matches";

function chamada(metodo: string) {
  return chamadas.filter(([m]) => m === metodo).map(([, args]) => args);
}

describe("listarJogos — filtros viram query", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta.data = [];
    resposta.count = 0;
  });

  it("por padrão pede só jogos que ainda não terminaram", async () => {
    await listarJogos({ competicaoId: "c1" });
    expect(chamada("in")).toContainEqual(["status", ["agendado", "ao_vivo"]]);
  });

  it("filtra a competição na query", async () => {
    await listarJogos({ competicaoId: "c1" });
    expect(chamada("eq")).toContainEqual(["competicao_id", "c1"]);
  });

  it("situacao encerrados vira eq de status", async () => {
    await listarJogos({ competicaoId: "c1", situacao: "encerrados" });
    expect(chamada("eq")).toContainEqual(["status", "finalizado"]);
  });

  it("incluirNaoJogaveis não restringe status", async () => {
    await listarJogos({ competicaoId: "c1", situacao: "todos", incluirNaoJogaveis: true });
    const statusEmIn = chamada("in").filter(([col]) => col === "status");
    const statusEmEq = chamada("eq").filter(([col]) => col === "status");
    expect(statusEmIn).toHaveLength(0);
    expect(statusEmEq).toHaveLength(0);
  });

  it("intervalo de datas vira gte/lt com offset de Brasília", async () => {
    await listarJogos({ competicaoId: "c1", de: "2026-07-15", ate: "2026-07-31" });
    expect(chamada("gte")).toContainEqual(["inicio_em", "2026-07-15T00:00:00-03:00"]);
    expect(chamada("lt")).toContainEqual(["inicio_em", "2026-08-01T00:00:00-03:00"]);
  });

  it("apenasFuturos vira gt em inicio_em", async () => {
    await listarJogos({ competicaoId: "c1", apenasFuturos: true });
    const gt = chamada("gt");
    expect(gt).toHaveLength(1);
    expect(gt[0][0]).toBe("inicio_em");
  });

  it("ordem desc inverte a ordenação", async () => {
    await listarJogos({ competicaoId: "c1", ordem: "desc" });
    expect(chamada("order")).toContainEqual(["inicio_em", { ascending: false }]);
  });

  it("pagina no servidor com range", async () => {
    await listarJogos({ competicaoId: "c1", offset: 40, limite: 20 });
    expect(chamada("range")).toContainEqual([40, 59]);
  });

  it("devolve o total vindo do count", async () => {
    resposta.count = 261;
    const { total } = await listarJogos({ competicaoId: "c1" });
    expect(total).toBe(261);
  });

  it("falha aberta: devolve vazio e total 0 em erro", async () => {
    resposta.data = null as unknown as unknown[];
    const r = await listarJogos({ competicaoId: "c1" });
    expect(r.jogos).toEqual([]);
    expect(r.total).toBe(0);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npm test -- matches-query`
Expected: FAIL — hoje `listarJogos` devolve array (não `{ jogos, total }`) e filtra em memória, então `in`/`gte`/`lt`/`gt`/`range` não são chamados.

- [ ] **Step 3: Reescreva `listarJogos`**

Em `src/lib/matches.ts`, substitua a função inteira (linhas 72-106) por:

```ts
export async function listarJogos(filtro?: {
  competicaoId?: string;
  fase?: string;
  rodada?: string;
  situacao?: Situacao;
  de?: string;
  ate?: string;
  ordem?: "asc" | "desc";
  offset?: number;
  limite?: number;
  apenasFuturos?: boolean;
  incluirNaoJogaveis?: boolean;
}): Promise<{ jogos: Match[]; total: number }> {
  try {
    const situacao = filtro?.situacao ?? "a_fazer";
    const offset = filtro?.offset ?? 0;
    const limite = filtro?.limite ?? JOGOS_POR_PAGINA;
    const ascendente = (filtro?.ordem ?? "asc") === "asc";

    const supabase = await createClient();
    let q = supabase
      .from("matches")
      .select(COLS, { count: "exact" })
      .order("inicio_em", { ascending: ascendente });

    if (filtro?.competicaoId) q = q.eq("competicao_id", filtro.competicaoId);
    if (filtro?.fase) q = q.eq("fase", filtro.fase);
    if (filtro?.rodada) q = q.eq("rodada", filtro.rodada);

    const status = statusPorSituacao(situacao, filtro?.incluirNaoJogaveis ?? false);
    if (status) {
      q = status.length === 1 ? q.eq("status", status[0]) : q.in("status", status);
    }

    const { gte, lt } = limitesDeData(filtro?.de, filtro?.ate);
    if (gte) q = q.gte("inicio_em", gte);
    if (lt) q = q.lt("inicio_em", lt);

    if (filtro?.apenasFuturos) q = q.gt("inicio_em", new Date().toISOString());

    q = q.range(offset, offset + limite - 1);

    const { data, count } = await q;
    return { jogos: (data as Match[]) ?? [], total: count ?? 0 };
  } catch {
    return { jogos: [], total: 0 };
  }
}
```

Acrescente ao topo do arquivo:

```ts
import { limitesDeData, statusPorSituacao, type Situacao } from "@/lib/jogos/filtros";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
```

E remova o `import { palpiteAberto }` se ele tiver ficado sem uso no arquivo (a função continua existindo em `@/lib/palpites/corte`, usada pelas páginas e pela server action de palpite).

- [ ] **Step 4: Adapte os 5 consumidores**

Aplique a tabela de tradução da seção acima. Em cada página, o padrão é desestruturar:

```ts
const { jogos } = await listarJogos({ ... });
```

Em `src/app/jogos/page.tsx`, derive a situação dos searchParams que já existem, preservando o padrão atual (abertos, a menos que se peça outra coisa):

```ts
const { soAbertos, encerrados } = await searchParams;
const situacao: Situacao =
  encerrados === "1" ? "encerrados" : soAbertos === "0" ? "todos" : "a_fazer";
```

E passe `situacao` ao `JogosFiltro` no lugar dos dois booleanos — ajuste a prop do componente e seus testes na Task 3; nesta task basta manter o build verde derivando os booleanos a partir de `situacao`:

```tsx
<JogosFiltro
  soAbertos={situacao === "a_fazer"}
  soEncerrados={situacao === "encerrados"}
/>
```

- [ ] **Step 5: Rode a suíte e o build**

Run: `npm test -- matches-query`
Expected: PASS — 10 testes.

Run: `npm test`
Expected: verde. O teste `src/lib/__tests__/matches-listagem.test.ts` (da spec 1) vai **falhar**, porque esperava `Match[]` e agora recebe `{ jogos, total }` — e porque o filtro de `adiado`/`cancelado` saiu da memória para a query. **Reescreva-o** para o novo contrato em vez de apagá-lo: as três asserções viram checagens de que `statusPorSituacao` foi aplicado na query (o mock do novo teste já cobre isso, então o arquivo antigo pode ser removido **desde que** você confirme que `matches-query.test.ts` cobre os mesmos três casos: esconde adiado, esconde cancelado, admin vê tudo). Registre no commit qual dos dois caminhos você escolheu e por quê.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 6: Commit**

```bash
git add src/lib/matches.ts src/lib/__tests__/ src/app/jogos/page.tsx src/app/page.tsx src/app/historico/page.tsx src/app/admin/page.tsx src/app/admin/auditoria/page.tsx
git commit -m "feat: listarJogos filtra, ordena e pagina no servidor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `/jogos` — filtro de data, inverter ordem e Carregar mais

**Files:**
- Modify: `src/components/jogos/jogos-filtro.tsx`
- Modify: `src/components/jogos/__tests__/jogos-filtro.test.tsx`
- Create: `src/components/jogos/jogos-lista.tsx`
- Create: `src/components/jogos/__tests__/jogos-lista.test.tsx`
- Modify: `src/app/jogos/actions.ts`
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `listarJogos` da Task 2; `JOGOS_POR_PAGINA` e `Situacao` da Task 1.
- Produces: server action `carregarMaisJogos(params): Promise<Match[]>`; componente `JogosLista`.

**Padrão a seguir:** [`src/components/feed/palpites-amigos-list.tsx`](../../../src/components/feed/palpites-amigos-list.tsx) já implementa exatamente este acúmulo — `useState` dos itens, `useState` do offset, `useTransition`, `temMais` derivado de `recebidos.length === LIMIT`. Copie a estrutura, não invente outra.

**A armadilha que já nos pegou:** `useState(itensIniciais)` **ignora** um novo valor inicial quando o servidor re-renderiza com outro filtro. Foi o bug do `/ranking` que exigia F5 ao trocar de competição (corrigido em `59c2f38`). A página **precisa** passar `key` com a assinatura do filtro para a lista remontar.

- [ ] **Step 1: Escreva o teste da lista (falhando)**

Crie `src/components/jogos/__tests__/jogos-lista.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Match } from "@/lib/matches";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";

const carregarMais = vi.fn();
vi.mock("@/app/jogos/actions", () => ({
  carregarMaisJogos: (...args: unknown[]) => carregarMais(...args),
}));

import { JogosLista } from "@/components/jogos/jogos-lista";

function jogo(id: string): Match {
  return {
    id,
    fase: "grupos",
    rodada: "",
    time_casa: `Casa ${id}`,
    time_fora: `Fora ${id}`,
    bandeira_casa: null,
    bandeira_fora: null,
    inicio_em: "2026-09-01T20:00:00Z",
    status: "agendado",
    placar_casa: null,
    placar_fora: null,
    odds: null,
  };
}

const pagina = (n: number) => Array.from({ length: n }, (_, i) => jogo(`j${i}`));

const props = {
  palpites: {},
  minutosCorte: 10,
  formaPorTime: new Map(),
  filtro: { competicaoId: "c1", situacao: "a_fazer" as const, ordem: "asc" as const },
};

describe("JogosLista", () => {
  beforeEach(() => carregarMais.mockReset());

  it("não mostra Carregar mais quando a 1ª página veio incompleta", () => {
    render(<JogosLista jogosIniciais={pagina(3)} {...props} />);
    expect(screen.queryByRole("button", { name: /carregar mais/i })).toBeNull();
  });

  it("mostra Carregar mais quando a 1ª página veio cheia", () => {
    render(<JogosLista jogosIniciais={pagina(JOGOS_POR_PAGINA)} {...props} />);
    expect(screen.getByRole("button", { name: /carregar mais/i })).toBeInTheDocument();
  });

  it("acumula a página seguinte e pede o offset certo", async () => {
    carregarMais.mockResolvedValue([jogo("novo")]);
    render(<JogosLista jogosIniciais={pagina(JOGOS_POR_PAGINA)} {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /carregar mais/i }));

    expect(carregarMais).toHaveBeenCalledWith(
      expect.objectContaining({ offset: JOGOS_POR_PAGINA })
    );
    expect(await screen.findByText("Casa novo")).toBeInTheDocument();
    // veio menos que a página cheia: não há mais o que carregar
    expect(screen.queryByRole("button", { name: /carregar mais/i })).toBeNull();
  });

  it("estado vazio quando não há jogo algum", () => {
    render(<JogosLista jogosIniciais={[]} {...props} />);
    expect(screen.getByText(/nenhum jogo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npm test -- jogos-lista`
Expected: FAIL — `JogosLista` não existe.

- [ ] **Step 3: Escreva a server action**

Em `src/app/jogos/actions.ts`, acrescente (mantendo o que já existe no arquivo):

```ts
"use server";

import { listarJogos } from "@/lib/matches";
import type { Match } from "@/lib/matches";
import type { Situacao } from "@/lib/jogos/filtros";

export async function carregarMaisJogos(params: {
  competicaoId: string;
  situacao: Situacao;
  de?: string;
  ate?: string;
  ordem: "asc" | "desc";
  offset: number;
}): Promise<Match[]> {
  const { jogos } = await listarJogos(params);
  return jogos;
}
```

- [ ] **Step 4: Implemente `JogosLista`**

`src/components/jogos/jogos-lista.tsx` — espelhando `palpites-amigos-list.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { MatchCard } from "@/components/jogos/match-card";
import { Button } from "@/components/ui/button";
import { carregarMaisJogos } from "@/app/jogos/actions";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { Match } from "@/lib/matches";
import type { Situacao } from "@/lib/jogos/filtros";
import type { FormaJogo } from "@/lib/matches";

type Palpite = { palpite_casa: number; palpite_fora: number };

export function JogosLista({
  jogosIniciais,
  palpites,
  minutosCorte,
  formaPorTime,
  filtro,
}: {
  jogosIniciais: Match[];
  palpites: Record<string, Palpite>;
  minutosCorte: number;
  formaPorTime: Map<string, FormaJogo[]>;
  filtro: {
    competicaoId: string;
    situacao: Situacao;
    de?: string;
    ate?: string;
    ordem: "asc" | "desc";
  };
}) {
  const [jogos, setJogos] = useState(jogosIniciais);
  const [offset, setOffset] = useState(jogosIniciais.length);
  const [temMais, setTemMais] = useState(jogosIniciais.length === JOGOS_POR_PAGINA);
  const [carregando, startTransition] = useTransition();

  function aoCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisJogos({ ...filtro, offset });
      setJogos((antes) => [...antes, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < JOGOS_POR_PAGINA) setTemMais(false);
    });
  }

  if (jogos.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Nenhum jogo encontrado com esses filtros.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
      {temMais && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={aoCarregarMais}
            disabled={carregando}
          >
            {carregando ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </>
  );
}
```

Run: `npm test -- jogos-lista`
Expected: PASS — 4 testes.

- [ ] **Step 5: Escreva o teste do filtro novo (falhando)**

Substitua `src/components/jogos/__tests__/jogos-filtro.test.tsx` — o componente muda de dois booleanos para `situacao` e ganha data e ordem. Mantenha o mock de `useRouter` que o arquivo já usa; o teste novo:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
}));

import { JogosFiltro } from "@/components/jogos/jogos-filtro";

describe("JogosFiltro", () => {
  beforeEach(() => push.mockReset());

  it("marca a situação atual", () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    expect(screen.getByRole("button", { name: /a fazer/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("clicar em Encerrados navega para a situação encerrados", async () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    await userEvent.click(screen.getByRole("button", { name: /encerrados/i }));
    expect(push).toHaveBeenCalledWith("/jogos?situacao=encerrados");
  });

  it("inverter a ordem preserva os outros filtros", async () => {
    render(<JogosFiltro situacao="encerrados" ordem="asc" de="2026-07-01" />);
    await userEvent.click(screen.getByRole("button", { name: /inverter ordem/i }));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("ordem=desc");
    expect(url).toContain("situacao=encerrados");
    expect(url).toContain("de=2026-07-01");
  });

  it("escolher data navega preservando a situação", async () => {
    render(<JogosFiltro situacao="encerrados" ordem="asc" />);
    const de = screen.getByLabelText(/de/i);
    await userEvent.type(de, "2026-07-15");
    const url = push.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("de=2026-07-15");
    expect(url).toContain("situacao=encerrados");
  });

  it("limpar remove as datas e mantém a situação", async () => {
    render(<JogosFiltro situacao="encerrados" ordem="asc" de="2026-07-01" ate="2026-07-31" />);
    await userEvent.click(screen.getByRole("button", { name: /limpar/i }));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("de=");
    expect(url).not.toContain("ate=");
    expect(url).toContain("situacao=encerrados");
  });

  it("não mostra Limpar quando não há data escolhida", () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    expect(screen.queryByRole("button", { name: /limpar/i })).toBeNull();
  });
});
```

Run: `npm test -- jogos-filtro`
Expected: FAIL — o componente ainda recebe `soAbertos`/`soEncerrados` e não tem data nem ordem.

- [ ] **Step 6a: Extraia `FiltroPeriodo` (data + ordem + limpar)**

O `/historico` da Task 4 precisa **do mesmo** intervalo de data e do mesmo botão de ordem, mas
**não** dos chips de situação (lá é sempre "encerrados com palpite meu"). Para não duplicar a
construção de URL em duas telas, o pedaço de período nasce como componente próprio agora.

Crie `src/components/jogos/filtro-periodo.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

// Muda um parâmetro e PRESERVA os demais que já estão na URL — inclusive os que este
// componente não conhece (ex.: `situacao`, que só o /jogos usa). `undefined` remove.
export function useNavegarFiltro() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return function navegar(mudanca: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(mudanca)) {
      if (valor) params.set(chave, valor);
      else params.delete(chave);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

export function FiltroPeriodo({
  ordem,
  de,
  ate,
}: {
  ordem: "asc" | "desc";
  de?: string;
  ate?: string;
}) {
  const navegar = useNavegarFiltro();
  const temData = Boolean(de || ate);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-de" className="text-xs text-muted-foreground">
          De
        </label>
        <input
          id="filtro-de"
          type="date"
          value={de ?? ""}
          onChange={(e) => navegar({ de: e.target.value || undefined })}
          className="cursor-pointer rounded-xl border border-border bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-ate" className="text-xs text-muted-foreground">
          Até
        </label>
        <input
          id="filtro-ate"
          type="date"
          value={ate ?? ""}
          onChange={(e) => navegar({ ate: e.target.value || undefined })}
          className="cursor-pointer rounded-xl border border-border bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <button
        type="button"
        onClick={() => navegar({ ordem: ordem === "asc" ? "desc" : "asc" })}
        aria-label="Inverter ordem"
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
        {ordem === "asc" ? "Mais antigos" : "Mais recentes"}
      </button>

      {temData && (
        <button
          type="button"
          onClick={() => navegar({ de: undefined, ate: undefined })}
          className="cursor-pointer rounded-xl px-3 py-1.5 text-sm text-muted-foreground underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
```

Note que `useNavegarFiltro` lê a URL atual com `useSearchParams` em vez de receber os filtros
por prop. É o que permite o mesmo hook servir às duas telas: o `/jogos` tem `situacao` na URL e
o `/historico` não, e nenhum dos dois precisa saber do outro.

Os testes do Step 5 que mexem em data, ordem e limpar precisam mockar `useSearchParams`
junto de `useRouter`:

```tsx
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
  useSearchParams: () => new URLSearchParams(searchParamsAtual),
}));
```

…com `let searchParamsAtual = ""` declarado antes do mock e ajustado em cada teste (ex.:
`searchParamsAtual = "situacao=encerrados&de=2026-07-01"`).

- [ ] **Step 6b: Reescreva `JogosFiltro` compondo chips + `FiltroPeriodo`**

`src/components/jogos/jogos-filtro.tsx`. Mantenha o helper `chip()` como está. Os chips usam o
mesmo hook de navegação, e o período vem do componente do Step 6a:

```tsx
"use client";

import { FiltroPeriodo, useNavegarFiltro } from "@/components/jogos/filtro-periodo";
import type { Situacao } from "@/lib/jogos/filtros";

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

const SITUACOES: { valor: Situacao; label: string }[] = [
  { valor: "a_fazer", label: "A fazer" },
  { valor: "encerrados", label: "Encerrados" },
  { valor: "todos", label: "Todos" },
];

export function JogosFiltro({
  situacao,
  ordem,
  de,
  ate,
}: {
  situacao: Situacao;
  ordem: "asc" | "desc";
  de?: string;
  ate?: string;
}) {
  const navegar = useNavegarFiltro();

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar jogos">
        {SITUACOES.map((s) => (
          <button
            key={s.valor}
            type="button"
            onClick={() => navegar({ situacao: s.valor })}
            aria-current={situacao === s.valor ? "true" : undefined}
            className={chip(situacao === s.valor)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <FiltroPeriodo ordem={ordem} de={de} ate={ate} />
    </div>
  );
}
```

Run: `npm test -- jogos-filtro`
Expected: PASS — 6 testes.

- [ ] **Step 7: Ligue tudo na página**

Em `src/app/jogos/page.tsx`: leia os searchParams novos, passe `situacao`/`ordem`/`de`/`ate` ao filtro, e renderize `JogosLista` com o **`key` da assinatura do filtro**:

```tsx
searchParams: Promise<{
  situacao?: string;
  de?: string;
  ate?: string;
  ordem?: string;
}>;
```

```tsx
const sp = await searchParams;
const situacao: Situacao =
  sp.situacao === "encerrados" || sp.situacao === "todos" ? sp.situacao : "a_fazer";
const ordem: "asc" | "desc" = sp.ordem === "desc" ? "desc" : "asc";
const { de, ate } = sp;

const filtro = { competicaoId: atual.id, situacao, de, ate, ordem };
const { jogos } = await listarJogos(filtro);
```

```tsx
<JogosFiltro situacao={situacao} ordem={ordem} de={de} ate={ate} />
<JogosLista
  key={`${atual.id}|${situacao}|${de ?? ""}|${ate ?? ""}|${ordem}`}
  jogosIniciais={jogos}
  palpites={palpites}
  minutosCorte={minutosCorte}
  formaPorTime={formaPorTime}
  filtro={filtro}
/>
```

O `key` é obrigatório: sem ele a lista mantém os jogos do filtro anterior quando o servidor re-renderiza. Os estados vazios que existiam no `page.tsx` saem — quem cuida deles agora é o `JogosLista`.

- [ ] **Step 8: Suíte e build**

Run: `npm test`
Expected: verde.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 9: Commit**

```bash
git add src/components/jogos/ src/app/jogos/
git commit -m "feat: /jogos com filtro de data, inversao de ordem e Carregar mais

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `/historico` — resumo do conjunto filtrado + lista paginada

**Files:**
- Modify: `src/lib/historico.ts`
- Create: `src/lib/historico-dados.ts`
- Create: `src/lib/__tests__/historico-resumo.test.ts`
- Create: `src/app/historico/actions.ts`
- Create: `src/components/historico/historico-lista.tsx`
- Modify: `src/app/historico/page.tsx`

**Interfaces:**
- Consumes: `limitesDeData`, `JOGOS_POR_PAGINA`, `Situacao` da Task 1.
- Produces: `type PalpitePontuado`; `resumoHistorico(linhas: PalpitePontuado[])`; `listarHistorico({ competicaoId, userId, de, ate, ordem, offset, limite })` → `{ itens: ItemHistorico[]; total: number }`; `linhasParaResumo({ competicaoId, userId, de, ate })` → `PalpitePontuado[]`.

**A query, e por que nesta direção.** Parte de `matches` e embute os palpites com `!inner`, restrito ao usuário:

```ts
.from("matches")
.select(`${COLS}, predictions!inner(palpite_casa, palpite_fora, pontos, pontos_max)`,
        { count: "exact" })
.eq("competicao_id", competicaoId)
.eq("status", "finalizado")
.eq("predictions.user_id", userId)
.order("inicio_em", { ascending: false })
.range(offset, offset + limite - 1)
```

O `!inner` descarta jogo sem palpite do usuário. Como `predictions.match_id → matches.id` é um-para-muitos, **o embed vem como array de um elemento** — o acesso é `linha.predictions[0]`.

**Não inverta para partir de `predictions`.** A tentação é ordenar por `matches.inicio_em` com a opção `referencedTable`, e isso **falha em silêncio**: o doc do PostgREST diz que *"ordering with `referencedTable` doesn't affect the ordering of the parent table"* — ela ordena o array embutido, não as linhas do pai, e as páginas sairiam em ordem arbitrária sem erro nenhum.

**Por que o resumo não pode vir da página.** `resumoHistorico` soma pontos, conta cravadas e calcula aproveitamento. Derivado de 20 linhas, mostraria "seus pontos" como os pontos daquela página. Ele roda sobre **todas** as linhas que casam com o filtro, numa projeção estreita (sem `odds`, sem bandeiras): centenas de linhas magras, barato. A lista, que é o que custa renderizar, é que pagina.

- [ ] **Step 1: Escreva o teste do resumo estreito (falhando)**

Crie `src/lib/__tests__/historico-resumo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resumoHistorico, type PalpitePontuado } from "@/lib/historico";

function linha(p: Partial<PalpitePontuado> = {}): PalpitePontuado {
  return {
    palpiteCasa: 1,
    palpiteFora: 0,
    placarCasa: 1,
    placarFora: 0,
    pontos: 15,
    pontosMax: 15,
    ...p,
  };
}

describe("resumoHistorico", () => {
  it("conjunto vazio não divide por zero", () => {
    expect(resumoHistorico([])).toEqual({
      totalPontos: 0,
      cravadas: 0,
      aproveitamento: 0,
    });
  });

  it("soma pontos e conta cravadas", () => {
    const r = resumoHistorico([
      linha(),
      linha({ palpiteCasa: 2, palpiteFora: 2, placarCasa: 1, placarFora: 0, pontos: 0 }),
    ]);
    expect(r.totalPontos).toBe(15);
    expect(r.cravadas).toBe(1);
  });

  it("aproveitamento é pontos sobre o máximo possível", () => {
    const r = resumoHistorico([linha({ pontos: 4, pontosMax: 15 }), linha({ pontos: 15 })]);
    // 19 de 30
    expect(r.aproveitamento).toBeCloseTo(0.63, 2);
  });

  it("não conta cravada quando o jogo não tem placar", () => {
    const r = resumoHistorico([
      linha({ placarCasa: null, placarFora: null, pontos: 0, pontosMax: 15 }),
    ]);
    expect(r.cravadas).toBe(0);
  });
});
```

Run: `npm test -- historico-resumo`
Expected: FAIL — `PalpitePontuado` não existe; `resumoHistorico` hoje exige `ItemHistorico[]` com um `Match` inteiro.

- [ ] **Step 2: Estreite `resumoHistorico`**

Em `src/lib/historico.ts`, mantenha `ItemHistorico` (a lista renderizada precisa do `Match` completo) e faça o resumo depender só do que ele usa:

```ts
import type { Match } from "@/lib/matches";

export type ItemHistorico = {
  match: Match;
  palpiteCasa: number;
  palpiteFora: number;
  pontos: number;
  pontosMax: number;
};

// Projeção estreita: é tudo que o resumo precisa. Assim ele roda sobre o conjunto filtrado
// inteiro sem trazer linhas largas (odds jsonb, bandeiras) do banco.
export type PalpitePontuado = {
  palpiteCasa: number;
  palpiteFora: number;
  placarCasa: number | null;
  placarFora: number | null;
  pontos: number;
  pontosMax: number;
};

export function resumoHistorico(
  linhas: PalpitePontuado[]
): { totalPontos: number; cravadas: number; aproveitamento: number } {
  const totalPontos = linhas.reduce((s, l) => s + l.pontos, 0);
  const cravadas = linhas.filter(
    (l) =>
      l.placarCasa !== null &&
      l.placarFora !== null &&
      l.palpiteCasa === l.placarCasa &&
      l.palpiteFora === l.placarFora
  ).length;
  const maxPossivel = linhas.reduce((s, l) => s + (l.pontosMax ?? 10), 0);
  const aproveitamento =
    maxPossivel === 0 ? 0 : Math.round((totalPontos / maxPossivel) * 100) / 100;
  return { totalPontos, cravadas, aproveitamento };
}

// Converte o item renderizável na projeção do resumo (usado quando já se tem a lista).
export function paraResumo(itens: ItemHistorico[]): PalpitePontuado[] {
  return itens.map((i) => ({
    palpiteCasa: i.palpiteCasa,
    palpiteFora: i.palpiteFora,
    placarCasa: i.match.placar_casa,
    placarFora: i.match.placar_fora,
    pontos: i.pontos,
    pontosMax: i.pontosMax,
  }));
}
```

Run: `npm test -- historico-resumo`
Expected: PASS — 4 testes.

- [ ] **Step 3: Escreva a camada de dados**

Crie `src/lib/historico-dados.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { limitesDeData } from "@/lib/jogos/filtros";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { Match } from "@/lib/matches";
import type { ItemHistorico, PalpitePontuado } from "@/lib/historico";

const COLS_HISTORICO =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora, odds";

type LinhaEmbed = Match & {
  predictions: {
    palpite_casa: number;
    palpite_fora: number;
    pontos: number | null;
    pontos_max: number | null;
  }[];
};

type Filtro = {
  competicaoId: string;
  userId: string;
  de?: string;
  ate?: string;
};

// Parte de `matches` de propósito: ordenar/paginar por coluna do PAI funciona; ordenar por
// coluna de tabela embutida com `referencedTable` ordenaria só o array interno, e as páginas
// sairiam em ordem arbitrária sem erro nenhum.
function queryBase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: Filtro,
  colunas: string
) {
  let q = supabase
    .from("matches")
    .select(
      `${colunas}, predictions!inner(palpite_casa, palpite_fora, pontos, pontos_max)`,
      { count: "exact" }
    )
    .eq("competicao_id", f.competicaoId)
    .eq("status", "finalizado")
    .eq("predictions.user_id", f.userId);

  const { gte, lt } = limitesDeData(f.de, f.ate);
  if (gte) q = q.gte("inicio_em", gte);
  if (lt) q = q.lt("inicio_em", lt);
  return q;
}

// Falha aberta: [] em erro, como o resto da camada de dados do projeto.
export async function listarHistorico(
  f: Filtro & { ordem?: "asc" | "desc"; offset?: number; limite?: number }
): Promise<{ itens: ItemHistorico[]; total: number }> {
  try {
    const offset = f.offset ?? 0;
    const limite = f.limite ?? JOGOS_POR_PAGINA;
    const supabase = await createClient();
    const { data, count } = await queryBase(supabase, f, COLS_HISTORICO)
      .order("inicio_em", { ascending: (f.ordem ?? "desc") === "asc" })
      .range(offset, offset + limite - 1);

    const itens = ((data as LinhaEmbed[]) ?? []).map((linha) => {
      const { predictions, ...match } = linha;
      const p = predictions[0];
      return {
        match: match as Match,
        palpiteCasa: p.palpite_casa,
        palpiteFora: p.palpite_fora,
        pontos: p.pontos ?? 0,
        pontosMax: p.pontos_max ?? 10,
      };
    });
    return { itens, total: count ?? 0 };
  } catch {
    return { itens: [], total: 0 };
  }
}

// O resumo NÃO pode sair da página exibida — seriam "os pontos daquela página". Roda sobre
// todo o conjunto filtrado, numa projeção estreita (sem odds, sem bandeiras).
export async function linhasParaResumo(f: Filtro): Promise<PalpitePontuado[]> {
  try {
    const supabase = await createClient();
    const { data } = await queryBase(supabase, f, "placar_casa, placar_fora");
    type Estreita = {
      placar_casa: number | null;
      placar_fora: number | null;
      predictions: { palpite_casa: number; palpite_fora: number; pontos: number | null; pontos_max: number | null }[];
    };
    return ((data as Estreita[]) ?? []).map((l) => ({
      palpiteCasa: l.predictions[0].palpite_casa,
      palpiteFora: l.predictions[0].palpite_fora,
      placarCasa: l.placar_casa,
      placarFora: l.placar_fora,
      pontos: l.predictions[0].pontos ?? 0,
      pontosMax: l.predictions[0].pontos_max ?? 10,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Server action e lista client**

`src/app/historico/actions.ts`:

```ts
"use server";

import { getSessao } from "@/lib/auth/profile";
import { listarHistorico } from "@/lib/historico-dados";
import type { ItemHistorico } from "@/lib/historico";

export async function carregarMaisHistorico(params: {
  competicaoId: string;
  de?: string;
  ate?: string;
  ordem: "asc" | "desc";
  offset: number;
}): Promise<ItemHistorico[]> {
  const sessao = await getSessao();
  if (!sessao) return [];
  const { itens } = await listarHistorico({ ...params, userId: sessao.userId });
  return itens;
}
```

`src/components/historico/historico-lista.tsx` — mesma estrutura do `JogosLista`, renderizando `HistoricoItem`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { HistoricoItem } from "@/components/historico/historico-item";
import { Button } from "@/components/ui/button";
import { carregarMaisHistorico } from "@/app/historico/actions";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { ItemHistorico } from "@/lib/historico";

export function HistoricoLista({
  itensIniciais,
  filtro,
}: {
  itensIniciais: ItemHistorico[];
  filtro: { competicaoId: string; de?: string; ate?: string; ordem: "asc" | "desc" };
}) {
  const [itens, setItens] = useState(itensIniciais);
  const [offset, setOffset] = useState(itensIniciais.length);
  const [temMais, setTemMais] = useState(itensIniciais.length === JOGOS_POR_PAGINA);
  const [carregando, startTransition] = useTransition();

  function aoCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisHistorico({ ...filtro, offset });
      setItens((antes) => [...antes, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < JOGOS_POR_PAGINA) setTemMais(false);
    });
  }

  if (itens.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Nenhum jogo encerrado com palpite seu nesse período.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {itens.map((item) => (
          <HistoricoItem key={item.match.id} item={item} />
        ))}
      </div>
      {temMais && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="sm" onClick={aoCarregarMais} disabled={carregando}>
            {carregando ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Reescreva a página**

`src/app/historico/page.tsx` lê os searchParams, busca resumo e primeira página em paralelo, e
usa o **`FiltroPeriodo`** criado na Task 3 (sem chips de situação — aqui é sempre "encerrados
com palpite meu"):

```tsx
export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; ordem?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [todas, optIns, cookieStore, sp] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
    searchParams,
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);

  const ordem: "asc" | "desc" = sp.ordem === "asc" ? "asc" : "desc";
  const { de, ate } = sp;

  if (!atual) {
    return (/* mesma casca de página, com a mensagem de nenhuma competição disponível */);
  }

  const filtro = { competicaoId: atual.id, de, ate, ordem };
  const [{ itens }, linhas] = await Promise.all([
    listarHistorico({ ...filtro, userId: sessao.userId }),
    linhasParaResumo({ ...filtro, userId: sessao.userId }),
  ]);
  const resumo = resumoHistorico(linhas);

  // …casca da página…
  // <FiltroPeriodo ordem={ordem} de={de} ate={ate} />
  // <Resumo {...resumo} />
  // <HistoricoLista
  //   key={`${atual.id}|${de ?? ""}|${ate ?? ""}|${ordem}`}
  //   itensIniciais={itens}
  //   filtro={filtro}
  // />
}
```

O `key` no `HistoricoLista` é obrigatório pelo mesmo motivo da Task 3. E note que o resumo vem
de `linhasParaResumo` (conjunto filtrado inteiro), **não** de `itens` (a página) — é o ponto
central desta task.

- [ ] **Step 6: Suíte e build**

Run: `npm test`
Expected: verde. O teste antigo que chamava `resumoHistorico(itens)` com `ItemHistorico[]` precisa passar por `paraResumo(itens)` — ajuste, não delete.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 7: Commit**

```bash
git add src/lib/historico.ts src/lib/historico-dados.ts src/lib/__tests__/historico-resumo.test.ts src/app/historico/ src/components/historico/ src/components/jogos/
git commit -m "feat: /historico pagina no servidor e resume o conjunto filtrado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Landing — só jogos futuros, da minha competição

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/components/landing/__tests__/proximos-jogos.test.tsx` (ajustar se existir; senão criar)

**Interfaces:**
- Consumes: `listarJogos` com `apenasFuturos` (Task 2), `competicoesVisiveis`/`resolverCompeticao`/`meusOptIns` de `@/lib/competicoes`.

**Os dois defeitos, lado a lado.** Hoje: `listarJogos({ soAbertos: true, minutosCorte: mc, limite: 6 })`.
1. Ordem **crescente** + `limite: 6` corta os 6 **primeiros**, e `soAbertos` inclui jogos com data vencida → os mais **velhos** aparecem primeiro. Com 6 ou mais atrasados, nenhum jogo futuro aparece.
2. Sem `competicaoId` e sem checagem de opt-in → mistura competições e mostra jogo de competição que o usuário não acompanha.

- [ ] **Step 1: Escreva a página nova**

Em `src/app/page.tsx`, dentro do `if (logado)`:

```ts
const [todas, optIns, cookieStore] = await Promise.all([
  listarCompeticoes(),
  meusOptIns(),
  cookies(),
]);
const visiveis = competicoesVisiveis(todas, optIns);
const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
const participando = atual ? optIns.includes(atual.slug) : false;

if (atual && participando) {
  const r = await listarJogos({
    competicaoId: atual.id,
    situacao: "a_fazer",
    apenasFuturos: true,
    ordem: "asc",
    limite: 6,
  });
  proximosJogos = r.jogos;
}
```

Os imports novos vêm de `@/lib/competicoes` e `next/headers`, seguindo o padrão de `src/app/jogos/page.tsx`. O `getMinutosCorte` deixa de ser necessário para a listagem — remova a chamada se ela ficar sem uso na página.

- [ ] **Step 2: Verifique o comportamento**

Run: `npm test`
Expected: verde. Se houver teste de `ProximosJogos`, confirme que ele não assumia jogos passados.

Run: `npm run build`
Expected: sucesso.

Confira com uma query que o filtro faz sentido nos dados reais:

```sql
select count(*) filter (where inicio_em > now()) as futuros,
       count(*) filter (where inicio_em <= now() and status in ('agendado','ao_vivo')) as vencidos_ou_ao_vivo
from matches m join competicoes c on c.id = m.competicao_id
where c.slug = 'brasileirao-2026';
```

Se `vencidos_ou_ao_vivo` for maior que zero, são exatamente os jogos que **antes** apareceriam na frente na landing.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/landing/
git commit -m "fix: landing mostra so jogos futuros da competicao em que o usuario participa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Validação final

**Files:** nenhum novo.

- [ ] **Step 1: Suíte e build**

Run: `npm test` → verde. Run: `npm run build` → sucesso. Run: `npm run lint` → sem erro novo.

- [ ] **Step 2: Confirme que nada ficou filtrando em memória**

Leia `src/lib/matches.ts` e confirme: dentro de `listarJogos` não sobrou nenhum `.filter(...)` sobre `resultado`. Se sobrou, a paginação está mentindo — a página seria cortada **antes** do filtro, devolvendo menos itens que o pedido e um `total` inconsistente.

- [ ] **Step 3: Cheque os cinco consumidores**

Confirme que cada um desestrutura o novo retorno e passa o que precisa:
`app/jogos/page.tsx`, `app/page.tsx`, `app/historico/page.tsx`, `app/admin/page.tsx`, `app/admin/auditoria/page.tsx`.

- [ ] **Step 4: Atualize o NEXT_STEPS**

Marque a spec 2 como entregue e deixe a fila com as specs 3 (ranking mensal) e 4 (alertas), mais as animações fora da fila. Anote a dívida que esta spec **não** pagou: `matches.rodada` continua vazio no Brasileirão, e por isso não existe filtro por rodada.

- [ ] **Step 5: Commit**

```bash
git add NEXT_STEPS.md
git commit -m "docs: listagens de jogos entregues

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notas para quem executa

- **A paginação não veio pelo volume de linhas.** 261 linhas do Postgres nunca foram o gargalo; o custo é renderizar 261 cards e trafegar linhas largas com `odds` jsonb. Não espere ganho de latência de banco — o ganho é de render e de escala.
- **Nenhum `.filter()` pode sobrar dentro de `listarJogos`.** Filtro em memória depois do `.range()` corta a página errada. É o erro mais fácil de cometer aqui e o mais difícil de notar.
- **`key` nas duas listas client.** Sem ele, trocar o filtro mantém os itens antigos na tela — o bug do `/ranking` que exigia F5 (`59c2f38`).
- **`ate` é inclusivo.** Se alguém "simplificar" `limitesDeData` para `lte` no próprio dia, todo jogo da noite do último dia do intervalo desaparece — e o teste do jogo às 21h BRT existe exatamente para pegar isso.
- **Fora de escopo, não esqueça:** filtro por time ou rodada (precisaria popular `matches.rodada`), ranking mensal (spec 3), alertas (spec 4), animações.
