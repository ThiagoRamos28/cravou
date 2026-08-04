# Ranking Mensal + Abas de Competição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar cada mês do Brasileirão numa disputa própria com campeão, e mover a escolha de competição do header para abas na própria `/ranking`.

**Architecture:** Uma migration estende a função SQL `ranking()` com um ramo mensal e uma cascata de desempate de seis níveis, e acrescenta `ranking_meses()` para listar os meses e dizer quais já fecharam. Os tipos e as funções puras do ranking mudam para `src/lib/ranking-shared.ts`, para que componentes client possam importá-los sem puxar o cliente Supabase de servidor. A `/ranking` ganha três componentes (abas de competição, seletor de mês, faixa de campeão), e o seletor de competição do header passa por um wrapper que o esconde nessa rota.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Postgres + RPC), lucide-react, Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-01-ranking-mensal-design.md](../specs/2026-08-01-ranking-mensal-design.md)

## Global Constraints

- **Next.js 16 tem breaking changes.** Antes de usar qualquer API do Next que você não conhece de cor, leia o guia correspondente em `node_modules/next/dist/docs/`. Não confie na memória.
- **Idioma da UI: português do Brasil.** Nomes de variáveis, funções e testes também são em português, seguindo o código existente.
- **Fuso horário: `America/Sao_Paulo`.** `inicio_em` é UTC no banco; toda conversão para mês/data é feita com `timeZone: "America/Sao_Paulo"` (TS) ou `at time zone 'America/Sao_Paulo'` (SQL). Nunca use o fuso local do servidor.
- **Ícones são SVG do lucide-react.** Nunca emoji.
- **Todo clicável leva `cursor-pointer`**, foco visível (`focus-visible:ring`), e precisa funcionar em tema claro **e** escuro.
- **TDD:** escreva o teste, veja falhar, implemente o mínimo, veja passar, commite. Um commit por unidade.
- **Toda mensagem de commit termina com:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Rodar a suíte inteira** (`npm test`) antes do commit de cada task, não só o arquivo novo. A baseline desta branch (saída de `master`) é **239 testes passando**. O NEXT_STEPS.md fala em 271: aquele número é da branch `feat/listagens-jogos`, que não está aqui.
- **Nunca remova** o pré-filtro `exists` de `predictions` (migration 0024) nem o `and mm.status <> 'cancelado'` dentro dele (migration 0025) ao reescrever `ranking()`. Cada um conserta um bug real: vazamento de pontos entre competições e jogo cancelado estragando o aproveitamento.

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/0026_ranking_mensal.sql` | Criar | `ranking()` com ramo mensal + cascata de desempate; nova `ranking_meses()` |
| `src/lib/ranking-shared.ts` | Criar | Tipos e funções puras do ranking, sem dependência de servidor |
| `src/lib/__tests__/ranking-shared.test.ts` | Criar | Testes das funções puras |
| `src/lib/ranking.ts` | Modificar | Re-exporta o shared; ganha `listarMesesRanking` |
| `src/app/ranking/actions.ts` | Modificar | Validação do período via `normalizarPeriodo` |
| `src/components/ranking/mes-selector.tsx` | Criar | `<select>` com Geral + meses |
| `src/components/ranking/faixa-campeao.tsx` | Criar | Faixa de campeão / líder do mês |
| `src/components/ranking/competicao-tabs.tsx` | Criar | Abas de competição + "Temporadas anteriores" |
| `src/components/ranking/ranking-content.tsx` | Modificar | Orquestra abas, sub-controle por formato, faixa e estado vazio |
| `src/app/ranking/page.tsx` | Modificar | Busca meses, decide o período inicial |
| `src/components/competicao/competicao-selector-slot.tsx` | Criar | Esconde o seletor do header em `/ranking` |
| `src/components/site-header.tsx` | Modificar | Passa a renderizar o slot |
| `src/components/regras/criterios-desempate.tsx` | Criar | Bloco de critérios de desempate |
| `src/app/regras/page.tsx` | Modificar | Renderiza o bloco |

Ordem de execução: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8, com 9 e 10 independentes (podem sair em qualquer ponto).

---

### Task 1: Migration 0026 — ranking mensal e cascata de desempate

**Files:**
- Create: `supabase/migrations/0026_ranking_mensal.sql`
- Aplicar: via MCP `mcp__supabase-cravou__apply_migration` (Supabase CLI e Deno **não** estão instalados nesta máquina)

**Interfaces:**
- Consumes: nada.
- Produces: RPC `ranking(p_competicao_id uuid, p_periodo text)` aceitando `'YYYY-MM'`; RPC `ranking_meses(p_competicao_id uuid)` retornando `mes text, jogos bigint, pendentes bigint, palpites bigint, fechado boolean`.

Não há harness de teste para SQL neste projeto. O ciclo aqui é: capturar o estado atual → aplicar → conferir que nada regrediu e que o novo funciona.

- [ ] **Step 1: Capturar a baseline antes de mexer**

Rode via MCP `execute_sql` e **guarde a saída** — o Step 5 compara contra ela:

```sql
select 'bra-geral' as onde, apelido, pontos, cravadas from public.ranking('95c30703-b92b-4086-82b2-a8ccfc005d11','geral')
union all select 'copa-geral', apelido, pontos, cravadas from public.ranking('44e62908-b9cb-4f67-9eff-0b7a1b6a800c','geral')
union all select 'copa-t1', apelido, pontos, cravadas from public.ranking('44e62908-b9cb-4f67-9eff-0b7a1b6a800c','temporada_1')
union all select 'copa-t2', apelido, pontos, cravadas from public.ranking('44e62908-b9cb-4f67-9eff-0b7a1b6a800c','temporada_2');
```

- [ ] **Step 2: Escrever a migration**

Crie `supabase/migrations/0026_ranking_mensal.sql` com exatamente este conteúdo:

```sql
-- supabase/migrations/0026_ranking_mensal.sql
-- 0026 — Ranking mensal e cascata de desempate.
--
-- Duas mudanças em ranking() e uma função nova:
--   1. p_periodo passa a aceitar 'YYYY-MM' (mês em horário de Brasília). O `case p_periodo
--      when ...` (forma simples) vira `case when ...` (forma pesquisada) porque a comparação
--      por regex não cabe na forma simples.
--   2. o order by desce por toda a hierarquia da pontuação em vez de parar em cravadas.
--      Antes, dois usuários empatados em pontos e cravadas saíam em ordem indefinida — a
--      mesma tabela podia aparecer em ordens diferentes em dois acessos.
--   3. ranking_meses() lista os meses de uma competição e diz quais já fecharam.
--
-- O corpo da ranking() é o da 0025 com essas duas mudanças e nada mais. Os dois trechos
-- abaixo são consertos de bugs reais e NÃO podem ser perdidos na reescrita:
--   - o pré-filtro de predictions via `exists` (0024), que impede pontos de vazarem entre
--     competições (filtro no ON de LEFT JOIN não filtra agregados);
--   - o `and mm.status <> 'cancelado'` dentro desse exists (0025).

-- 1. ranking() ──────────────────────────────────────────────────────────────────────────
create or replace function public.ranking(p_competicao_id uuid, p_periodo text default 'geral')
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
  -- Só os palpites DESTA competição, e nunca os de jogo cancelado. (0024 + 0025)
  left join public.predictions p
    on p.user_id = pr.id
   and exists (
     select 1 from public.matches mm
     where mm.id = p.match_id
       and mm.competicao_id = p_competicao_id
       and mm.status <> 'cancelado'
   )
  left join public.matches m
    on m.id = p.match_id
   and m.competicao_id = p_competicao_id
  where case
    when p_periodo = 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
    when p_periodo = 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
    when p_periodo ~ '^\d{4}-\d{2}$' then
      to_char(m.inicio_em at time zone 'America/Sao_Paulo', 'YYYY-MM') = p_periodo
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  -- Seis critérios de mérito; apelido e id só para a ordem ser estável entre acessos.
  order by pontos desc, cravadas desc, acertos_saldo desc, acertos_resultado desc,
           acertos_gols desc, erros asc, pr.apelido asc nulls last, pr.id asc;
$$;

revoke execute on function public.ranking(uuid, text) from public, anon;
grant  execute on function public.ranking(uuid, text) to authenticated;

-- 2. ranking_meses() ────────────────────────────────────────────────────────────────────
-- `fechado` = nenhum jogo do mês pendente. 'adiado' e 'cancelado' contam como resolvidos:
-- senão um adiamento sem data nova seguraria o mês aberto para sempre. A segunda condição
-- (finalizado com palpite sem pontos) evita anunciar campeão na janela entre a sync
-- finalizar o jogo e o recalcular_pontos rodar.
create or replace function public.ranking_meses(p_competicao_id uuid)
returns table (mes text, jogos bigint, pendentes bigint, palpites bigint, fechado boolean)
language sql stable security definer set search_path = '' as $$
  with jogos as (
    select to_char(m.inicio_em at time zone 'America/Sao_Paulo','YYYY-MM') as mes,
           m.id,
           (m.status in ('agendado','ao_vivo')
            or (m.status = 'finalizado' and exists (
                  select 1 from public.predictions p
                   where p.match_id = m.id and p.pontos is null))) as pendente
      from public.matches m
     where m.competicao_id = p_competicao_id
       and m.status <> 'cancelado'
  ), palpites as (
    select j.mes, count(p.id) as total
      from jogos j
      join public.predictions p on p.match_id = j.id
     group by j.mes
  )
  select j.mes,
         count(*)::bigint,
         count(*) filter (where j.pendente)::bigint,
         coalesce(pl.total, 0)::bigint,
         count(*) filter (where j.pendente) = 0
    from jogos j
    left join palpites pl on pl.mes = j.mes
   group by j.mes, pl.total
   order by j.mes;
$$;

revoke execute on function public.ranking_meses(uuid) from public, anon;
grant  execute on function public.ranking_meses(uuid) to authenticated;
```

- [ ] **Step 3: Aplicar a migration**

Use o MCP `mcp__supabase-cravou__apply_migration` com `name: "0026_ranking_mensal"` e o conteúdo do arquivo.

- [ ] **Step 4: Conferir a `ranking_meses`**

```sql
select * from public.ranking_meses('95c30703-b92b-4086-82b2-a8ccfc005d11');
```

Esperado (medido em 2026-08-01 — os números de agosto em diante mudam conforme os jogos acontecem, os de março a julho não):

| mes | jogos | pendentes | palpites | fechado |
|---|---|---|---|---|
| 2026-03 | 9 | 0 | 0 | `true` |
| 2026-04 | 50 | 0 | 0 | `true` |
| 2026-05 | 50 | 0 | 0 | `true` |
| 2026-07 | 32 | 0 | 160 | `true` |
| 2026-08 | 40 | 40 | 0 | `false` |
| 2026-09 | 30 | 30 | 0 | `false` |
| 2026-10 | 50 | 50 | 0 | `false` |

Se **julho** vier com `fechado = false`, pare e investigue antes de seguir — a regra de fechamento é o coração da feature.

- [ ] **Step 5: Conferir que nada regrediu**

Rode de novo a query do Step 1 e compare **linha por linha** com a saída guardada: mesmos apelidos, mesmos pontos, **na mesma ordem**. Em 2026-08-01 nenhum dos quatro rankings tem empate em pontos, então a cascata nova não pode mudar a ordem. Se mudar, a reescrita perdeu algum trecho do corpo da 0025.

- [ ] **Step 6: Conferir o ramo mensal**

```sql
select apelido, pontos, cravadas from public.ranking('95c30703-b92b-4086-82b2-a8ccfc005d11','2026-07');
select apelido, pontos, cravadas from public.ranking('95c30703-b92b-4086-82b2-a8ccfc005d11','2026-04');
```

Esperado: julho devolve exatamente as mesmas linhas que o `geral` do Brasileirão (hoje só julho tem palpite, então os dois coincidem — é esperado e está documentado na spec). Abril devolve **zero linhas** (tem jogo, não tem palpite).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0026_ranking_mensal.sql
git commit -m "$(cat <<'EOF'
feat: ranking por mes e cascata de desempate no SQL

ranking() aceita p_periodo no formato YYYY-MM (mes em horario de Brasilia) e
desempata por saldo, resultado, gols e menos erros antes de cair em apelido/id.
Nova ranking_meses() lista os meses da competicao e marca quais fecharam.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `ranking-shared.ts` — tipos e funções puras

**Files:**
- Create: `src/lib/ranking-shared.ts`
- Test: `src/lib/__tests__/ranking-shared.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type RankingRow` (campos idênticos aos de hoje em `lib/ranking.ts`)
  - `type RankingPeriodo = PeriodoFixo | \`${number}-${number}\``
  - `type MesRanking = { mes: string; jogos: number; pendentes: number; palpites: number; fechado: boolean }`
  - `type Campeao = { nomes: string[]; pontos: number }`
  - `ehPeriodoMensal(periodo: string): periodo is PeriodoMensal`
  - `normalizarPeriodo(periodo: string): RankingPeriodo`
  - `mesCorrenteBRT(agora: Date): string`
  - `mesesVisiveis(meses: MesRanking[], mesCorrente: string): MesRanking[]`
  - `rotuloMes(mes: string, anoCorrente: number): string`
  - `campeaoDoMes(linhas: RankingRow[]): Campeao | null`
  - `CRITERIOS_DESEMPATE: readonly string[]`

O template literal type `` `${number}-${number}` `` aceita `"2026-08"` — verificado com `tsc --strict` em 2026-08-01. A garantia de verdade é o regex em runtime; o tipo é conveniência.

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/lib/__tests__/ranking-shared.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizarPeriodo,
  ehPeriodoMensal,
  mesCorrenteBRT,
  mesesVisiveis,
  rotuloMes,
  campeaoDoMes,
  CRITERIOS_DESEMPATE,
  type MesRanking,
  type RankingRow,
} from "@/lib/ranking-shared";

function mes(m: string, extra: Partial<MesRanking> = {}): MesRanking {
  return { mes: m, jogos: 10, pendentes: 0, palpites: 0, fechado: true, ...extra };
}

function linha(apelido: string, extra: Partial<RankingRow> = {}): RankingRow {
  return {
    user_id: apelido, apelido, avatar_url: null,
    pontos: 0, cravadas: 0, acertos_saldo: 0, acertos_resultado: 0,
    acertos_gols: 0, erros: 0, palpites_pontuados: 0, total_palpites: 0,
    pontos_max_total: 0, ...extra,
  };
}

describe("ehPeriodoMensal", () => {
  it("aceita YYYY-MM válido", () => {
    expect(ehPeriodoMensal("2026-08")).toBe(true);
    expect(ehPeriodoMensal("2026-01")).toBe(true);
    expect(ehPeriodoMensal("2026-12")).toBe(true);
  });
  it("rejeita mês fora de 01..12 e formatos errados", () => {
    expect(ehPeriodoMensal("2026-00")).toBe(false);
    expect(ehPeriodoMensal("2026-13")).toBe(false);
    expect(ehPeriodoMensal("2026-8")).toBe(false);
    expect(ehPeriodoMensal("geral")).toBe(false);
    expect(ehPeriodoMensal("2026-08-01")).toBe(false);
  });
});

describe("normalizarPeriodo", () => {
  it("mantém os períodos fixos", () => {
    expect(normalizarPeriodo("geral")).toBe("geral");
    expect(normalizarPeriodo("temporada_1")).toBe("temporada_1");
    expect(normalizarPeriodo("temporada_2")).toBe("temporada_2");
  });
  it("mantém um mês válido", () => {
    expect(normalizarPeriodo("2026-08")).toBe("2026-08");
  });
  it("cai em geral para qualquer outra coisa", () => {
    expect(normalizarPeriodo("temporada_9")).toBe("geral");
    expect(normalizarPeriodo("2026-13")).toBe("geral");
    expect(normalizarPeriodo("")).toBe("geral");
  });
});

describe("mesCorrenteBRT", () => {
  it("usa o fuso de Brasília, não o do servidor", () => {
    // 2026-08-01T02:00:00Z ainda é 31/07 às 23h em Brasília (UTC−3).
    expect(mesCorrenteBRT(new Date("2026-08-01T02:00:00Z"))).toBe("2026-07");
  });
  it("vira o mês depois das 03:00 UTC", () => {
    expect(mesCorrenteBRT(new Date("2026-08-01T03:30:00Z"))).toBe("2026-08");
  });
});

describe("mesesVisiveis", () => {
  it("descarta mês com jogo e zero palpite", () => {
    const r = mesesVisiveis([mes("2026-04"), mes("2026-07", { palpites: 160 })], "2026-08");
    expect(r.map((m) => m.mes)).toEqual(["2026-07"]);
  });
  it("mantém o mês corrente mesmo sem palpite", () => {
    const r = mesesVisiveis([mes("2026-07", { palpites: 160 }), mes("2026-08")], "2026-08");
    expect(r.map((m) => m.mes)).toEqual(["2026-08", "2026-07"]);
  });
  it("ordena do mais recente para o mais antigo e não preenche buracos", () => {
    const entrada = [
      mes("2026-05", { palpites: 3 }),
      mes("2026-07", { palpites: 160 }),
      mes("2026-03", { palpites: 1 }),
    ];
    expect(mesesVisiveis(entrada, "2026-08").map((m) => m.mes)).toEqual([
      "2026-07", "2026-05", "2026-03",
    ]);
  });
  it("não inventa um mês corrente que não veio do banco", () => {
    expect(mesesVisiveis([mes("2026-07", { palpites: 1 })], "2026-06").map((m) => m.mes))
      .toEqual(["2026-07"]);
  });
});

describe("rotuloMes", () => {
  it("mostra só o nome dentro do ano corrente", () => {
    expect(rotuloMes("2026-08", 2026)).toBe("Agosto");
    expect(rotuloMes("2026-03", 2026)).toBe("Março");
  });
  it("acrescenta o ano fora dele", () => {
    expect(rotuloMes("2025-12", 2026)).toBe("Dezembro/2025");
  });
});

describe("campeaoDoMes", () => {
  it("devolve null para lista vazia", () => {
    expect(campeaoDoMes([])).toBeNull();
  });
  it("devolve null quando o topo tem zero pontos", () => {
    expect(campeaoDoMes([linha("Zé"), linha("Ana")])).toBeNull();
  });
  it("devolve o líder isolado", () => {
    const r = campeaoDoMes([linha("Ana", { pontos: 87 }), linha("Zé", { pontos: 40 })]);
    expect(r).toEqual({ nomes: ["Ana"], pontos: 87 });
  });
  it("desempata por cravadas", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3 }),
      linha("Zé", { pontos: 87, cravadas: 2 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de saldo", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3, acertos_saldo: 2 }),
      linha("Zé", { pontos: 87, cravadas: 3, acertos_saldo: 1 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de resultado", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5 }),
      linha("Zé", { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 4 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de gols", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5 };
    const r = campeaoDoMes([
      linha("Ana", { ...base, acertos_gols: 4 }),
      linha("Zé", { ...base, acertos_gols: 3 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por menos erros", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5, acertos_gols: 4 };
    const r = campeaoDoMes([
      linha("Ana", { ...base, erros: 1 }),
      linha("Zé", { ...base, erros: 5 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("devolve co-campeões quando empatam nos seis critérios", () => {
    const base = {
      pontos: 87, cravadas: 3, acertos_saldo: 2,
      acertos_resultado: 5, acertos_gols: 4, erros: 1,
    };
    const r = campeaoDoMes([linha("Ana", base), linha("Zé", base), linha("Bia", { pontos: 40 })]);
    expect(r).toEqual({ nomes: ["Ana", "Zé"], pontos: 87 });
  });
  it("usa 'Sem apelido' quando o apelido é nulo", () => {
    const r = campeaoDoMes([linha("x", { apelido: null, pontos: 10 })]);
    expect(r?.nomes).toEqual(["Sem apelido"]);
  });
});

describe("CRITERIOS_DESEMPATE", () => {
  it("tem os seis critérios de mérito, na ordem do order by", () => {
    expect(CRITERIOS_DESEMPATE).toHaveLength(6);
    expect(CRITERIOS_DESEMPATE[0]).toMatch(/pontos/i);
    expect(CRITERIOS_DESEMPATE[5]).toMatch(/erros/i);
  });
});
```

Atenção ao teste de desempate por cravadas: `campeaoDoMes` **não** ordena — ele confia na ordem que a `ranking()` já devolveu. Por isso os casos acima entregam a lista já ordenada, como o banco faria.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- ranking-shared
```
Esperado: FAIL — `Failed to resolve import "@/lib/ranking-shared"`.

- [ ] **Step 3: Implementar**

Crie `src/lib/ranking-shared.ts`:

```ts
// Tipos e funções puras do ranking, sem dependência de "next/headers".
// Isolados aqui para poderem ser importados por componentes client (MesSelector,
// FaixaCampeao) sem puxar `@/lib/supabase/server` para o bundle do browser —
// mesmo motivo que criou o competicoes-shared.ts.

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
  pontos_max_total: number;
};

export const PERIODOS_FIXOS = ["geral", "temporada_1", "temporada_2"] as const;
export type PeriodoFixo = (typeof PERIODOS_FIXOS)[number];
/** Mês em horário de Brasília, `YYYY-MM`. Quem garante o formato é `ehPeriodoMensal`. */
export type PeriodoMensal = `${number}-${number}`;
export type RankingPeriodo = PeriodoFixo | PeriodoMensal;

export type MesRanking = {
  mes: string;
  jogos: number;
  pendentes: number;
  palpites: number;
  fechado: boolean;
};

export type Campeao = { nomes: string[]; pontos: number };

/** Os seis critérios de mérito do `order by` da função SQL `ranking()`, nessa ordem. */
export const CRITERIOS_DESEMPATE = [
  "Mais pontos",
  "Mais cravadas — placar exato",
  "Mais acertos de saldo — vencedor e diferença de gols",
  "Mais acertos de resultado — vitória, empate ou derrota",
  "Mais acertos de gols de um dos times",
  "Menos erros",
] as const;

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ehPeriodoMensal(periodo: string): periodo is PeriodoMensal {
  return RE_MES.test(periodo);
}

// Fronteira de confiança: o que vier de fora vira um período válido ou 'geral'.
export function normalizarPeriodo(periodo: string): RankingPeriodo {
  if ((PERIODOS_FIXOS as readonly string[]).includes(periodo)) return periodo as PeriodoFixo;
  if (ehPeriodoMensal(periodo)) return periodo;
  return "geral";
}

export function mesCorrenteBRT(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === "year")?.value ?? "";
  const mes = partes.find((p) => p.type === "month")?.value ?? "";
  return `${ano}-${mes}`;
}

// Só filtra e ordena — nunca inventa um mês que não veio do banco. Os meses do
// Brasileirão não são contíguos (não há junho), então nada aqui pode assumir sequência.
export function mesesVisiveis(meses: MesRanking[], mesCorrente: string): MesRanking[] {
  return meses
    .filter((m) => m.palpites > 0 || m.mes === mesCorrente)
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function rotuloMes(mes: string, anoCorrente: number): string {
  const [ano, num] = mes.split("-");
  const nome = NOMES_MES[Number(num) - 1];
  if (!nome) return mes;
  return Number(ano) === anoCorrente ? nome : `${nome}/${ano}`;
}

// Espelha a cascata da ranking(): só divide o título quem empata nos seis critérios de
// mérito. Os dois últimos níveis do order by (apelido, id) são ordenação estável, não
// desempate, e por isso ficam de fora daqui.
export function campeaoDoMes(linhas: RankingRow[]): Campeao | null {
  const topo = linhas[0];
  if (!topo || topo.pontos <= 0) return null;
  const nomes = linhas
    .filter(
      (l) =>
        l.pontos === topo.pontos &&
        l.cravadas === topo.cravadas &&
        l.acertos_saldo === topo.acertos_saldo &&
        l.acertos_resultado === topo.acertos_resultado &&
        l.acertos_gols === topo.acertos_gols &&
        l.erros === topo.erros
    )
    .map((l) => l.apelido ?? "Sem apelido");
  return { nomes, pontos: topo.pontos };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- ranking-shared
```
Esperado: PASS, 24 testes.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm test
```
Esperado: 239 + 24 = **263 passando**, nenhum falhando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ranking-shared.ts src/lib/__tests__/ranking-shared.test.ts
git commit -m "$(cat <<'EOF'
feat: modulo compartilhado com os tipos e as funcoes puras do ranking

lib/ranking.ts importa o cliente Supabase de servidor, entao componentes client
nao podem importar dele. Tipos, validacao de periodo, rotulo de mes, filtro de
meses visiveis e apuracao do campeao passam a viver num modulo sem essa
dependencia, seguindo o precedente do competicoes-shared.ts.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `listarMesesRanking` e validação do período

**Files:**
- Modify: `src/lib/ranking.ts` (arquivo inteiro — hoje tem 35 linhas)
- Modify: `src/app/ranking/actions.ts` (arquivo inteiro — hoje tem 15 linhas)

**Interfaces:**
- Consumes: `MesRanking`, `RankingPeriodo`, `RankingRow`, `normalizarPeriodo` da Task 2; RPC `ranking_meses` da Task 1.
- Produces: `listarMesesRanking(competicaoId: string): Promise<MesRanking[]>`; `buscarRanking(competicaoId: string, periodo: string): Promise<RankingRow[]>` (assinatura inalterada, comportamento novo para meses).

Não há teste novo aqui: `listarMesesRanking` é I/O puro (o mesmo padrão de `listarRanking`, que também não tem teste), e a lógica de validação já foi testada na Task 2. A verificação é de tipo — `npm run build`.

- [ ] **Step 1: Reescrever `src/lib/ranking.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { MesRanking, RankingPeriodo, RankingRow } from "@/lib/ranking-shared";

// Os tipos e as funções puras moraram aqui até a 0026; foram para o módulo shared para
// serem importáveis por componentes client. Re-exportados para não quebrar imports.
export * from "@/lib/ranking-shared";

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

// Meses de uma competição, com jogos/palpites e se já fecharam. Falha aberta: [] em erro.
export async function listarMesesRanking(competicaoId: string): Promise<MesRanking[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ranking_meses", {
      p_competicao_id: competicaoId,
    });
    return (data as MesRanking[]) ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Reescrever `src/app/ranking/actions.ts`**

```ts
"use server";

import { listarRanking } from "@/lib/ranking";
import { normalizarPeriodo, type RankingRow } from "@/lib/ranking-shared";

export async function buscarRanking(
  competicaoId: string,
  periodo: string
): Promise<RankingRow[]> {
  return listarRanking(competicaoId, normalizarPeriodo(periodo));
}
```

- [ ] **Step 3: Verificar tipos e suíte**

```bash
npm run build && npm test
```
Esperado: build sem erro de tipo; 263 testes passando. Se o build reclamar de importação duplicada em `lib/ranking.ts`, é porque um `export type` local sobrou junto do `export *` — remova o local.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ranking.ts src/app/ranking/actions.ts
git commit -m "$(cat <<'EOF'
feat: listarMesesRanking e validacao de periodo mensal na server action

buscarRanking passa a aceitar YYYY-MM alem dos tres periodos fixos, caindo em
'geral' para qualquer outra entrada.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `MesSelector`

**Files:**
- Create: `src/components/ranking/mes-selector.tsx`
- Test: `src/components/ranking/__tests__/mes-selector.test.tsx`

**Interfaces:**
- Consumes: `MesRanking`, `RankingPeriodo`, `rotuloMes` da Task 2.
- Produces: `<MesSelector meses={MesRanking[]} periodo={string} onChange={(p: RankingPeriodo) => void} anoCorrente={number} />`

Espelha o visual do `SeasonSelector`, **sem** o botão de info — aquele popover explica os dois modelos de pontuação da Copa e não faz sentido no Brasileirão. O `SeasonSelector` fica intocado.

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/components/ranking/__tests__/mes-selector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MesSelector } from "@/components/ranking/mes-selector";
import type { MesRanking } from "@/lib/ranking-shared";

const meses: MesRanking[] = [
  { mes: "2026-08", jogos: 40, pendentes: 40, palpites: 0, fechado: false },
  { mes: "2026-07", jogos: 32, pendentes: 0, palpites: 160, fechado: true },
];

describe("MesSelector", () => {
  it("lista Ranking Geral e um item por mês, com o nome do mês", () => {
    render(<MesSelector meses={meses} periodo="2026-08" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.getByRole("option", { name: "Ranking Geral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agosto" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Julho" })).toBeInTheDocument();
  });

  it("acrescenta o ano em mês de outro ano", () => {
    const antigos: MesRanking[] = [
      { mes: "2025-12", jogos: 5, pendentes: 0, palpites: 3, fechado: true },
    ];
    render(<MesSelector meses={antigos} periodo="geral" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.getByRole("option", { name: "Dezembro/2025" })).toBeInTheDocument();
  });

  it("dispara onChange com o mês escolhido", () => {
    const onChange = vi.fn();
    render(<MesSelector meses={meses} periodo="geral" onChange={onChange} anoCorrente={2026} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-07" } });
    expect(onChange).toHaveBeenCalledWith("2026-07");
  });

  it("não renderiza nada quando não há mês", () => {
    const { container } = render(
      <MesSelector meses={[]} periodo="geral" onChange={() => {}} anoCorrente={2026} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não mostra o botão de info das temporadas da Copa", () => {
    render(<MesSelector meses={meses} periodo="geral" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- mes-selector
```
Esperado: FAIL — `Failed to resolve import "@/components/ranking/mes-selector"`.

- [ ] **Step 3: Implementar**

Crie `src/components/ranking/mes-selector.tsx`:

```tsx
"use client";

import { rotuloMes, type MesRanking, type RankingPeriodo } from "@/lib/ranking-shared";

export function MesSelector({
  meses,
  periodo,
  onChange,
  anoCorrente,
}: {
  meses: MesRanking[];
  periodo: string;
  onChange: (p: RankingPeriodo) => void;
  anoCorrente: number;
}) {
  if (meses.length === 0) return null;

  return (
    <div className="mb-6 flex items-center gap-2">
      <label htmlFor="mes-selector" className="shrink-0 text-sm text-muted-foreground">
        Ver ranking de:
      </label>
      <select
        id="mes-selector"
        value={periodo}
        onChange={(e) => onChange(e.target.value as RankingPeriodo)}
        className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="geral">Ranking Geral</option>
        {meses.map((m) => (
          <option key={m.mes} value={m.mes}>
            {rotuloMes(m.mes, anoCorrente)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- mes-selector
```
Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ranking/mes-selector.tsx src/components/ranking/__tests__/mes-selector.test.tsx
git commit -m "$(cat <<'EOF'
feat: seletor de mes do ranking

Espelha o SeasonSelector sem o botao de info, que explica os modelos de
pontuacao da Copa e nao faz sentido em pontos corridos.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `FaixaCampeao`

**Files:**
- Create: `src/components/ranking/faixa-campeao.tsx`
- Test: `src/components/ranking/__tests__/faixa-campeao.test.tsx`

**Interfaces:**
- Consumes: `campeaoDoMes`, `RankingRow` da Task 2.
- Produces: `<FaixaCampeao rotulo={string} fechado={boolean} linhas={RankingRow[]} />`

Três estados renderizam, um não renderiza. O componente **não** tem hooks — não leva `"use client"`; herda do pai.

| Situação | Saída |
|---|---|
| Fechado, um campeão | **Campeão de Julho** — Ana · 87 pts |
| Fechado, empate nos seis critérios | **Campeões de Julho** — Ana e Zé · 87 pts |
| Em andamento, alguém pontuou | **Agosto em disputa** — liderança de Ana · 12 pts |
| Em andamento, ninguém pontuou | **Agosto em disputa** — ninguém pontuou ainda |
| Fechado, ninguém pontuou | não renderiza |

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/components/ranking/__tests__/faixa-campeao.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaixaCampeao } from "@/components/ranking/faixa-campeao";
import type { RankingRow } from "@/lib/ranking-shared";

function linha(apelido: string, extra: Partial<RankingRow> = {}): RankingRow {
  return {
    user_id: apelido, apelido, avatar_url: null,
    pontos: 0, cravadas: 0, acertos_saldo: 0, acertos_resultado: 0,
    acertos_gols: 0, erros: 0, palpites_pontuados: 0, total_palpites: 0,
    pontos_max_total: 0, ...extra,
  };
}

describe("FaixaCampeao", () => {
  it("anuncia o campeão de um mês fechado", () => {
    render(<FaixaCampeao rotulo="Julho" fechado linhas={[linha("Ana", { pontos: 87 })]} />);
    expect(screen.getByText("Campeão de Julho")).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/87 pts/)).toBeInTheDocument();
  });

  it("usa o plural e junta os nomes quando há co-campeões", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5, acertos_gols: 4, erros: 1 };
    render(<FaixaCampeao rotulo="Julho" fechado linhas={[linha("Ana", base), linha("Zé", base)]} />);
    expect(screen.getByText("Campeões de Julho")).toBeInTheDocument();
    expect(screen.getByText(/Ana e Zé/)).toBeInTheDocument();
  });

  it("mostra a liderança de um mês em andamento", () => {
    render(<FaixaCampeao rotulo="Agosto" fechado={false} linhas={[linha("Ana", { pontos: 12 })]} />);
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
    expect(screen.getByText(/liderança de Ana/)).toBeInTheDocument();
    expect(screen.getByText(/12 pts/)).toBeInTheDocument();
  });

  it("diz que ninguém pontuou num mês em andamento sem pontos", () => {
    render(<FaixaCampeao rotulo="Agosto" fechado={false} linhas={[linha("Ana")]} />);
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
    expect(screen.getByText(/ninguém pontuou ainda/)).toBeInTheDocument();
  });

  it("não renderiza num mês fechado em que ninguém pontuou", () => {
    const { container } = render(<FaixaCampeao rotulo="Abril" fechado linhas={[linha("Ana")]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- faixa-campeao
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Crie `src/components/ranking/faixa-campeao.tsx`:

```tsx
import { Trophy } from "lucide-react";
import { campeaoDoMes, type RankingRow } from "@/lib/ranking-shared";

function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function FaixaCampeao({
  rotulo,
  fechado,
  linhas,
}: {
  rotulo: string;
  fechado: boolean;
  linhas: RankingRow[];
}) {
  const campeao = campeaoDoMes(linhas);

  // Mês encerrado sem ninguém pontuando não ganha faixa anunciando isso.
  if (fechado && !campeao) return null;

  let titulo: string;
  let detalhe: string;

  if (fechado && campeao) {
    titulo = campeao.nomes.length > 1 ? `Campeões de ${rotulo}` : `Campeão de ${rotulo}`;
    detalhe = `${juntarNomes(campeao.nomes)} · ${campeao.pontos} pts`;
  } else {
    titulo = `${rotulo} em disputa`;
    detalhe = campeao
      ? `liderança de ${juntarNomes(campeao.nomes)} · ${campeao.pontos} pts`
      : "ninguém pontuou ainda";
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <Trophy
        className={`h-6 w-6 shrink-0 ${fechado ? "text-accent" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-display text-base font-bold uppercase tracking-tight">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- faixa-campeao
```
Esperado: PASS, 5 testes.

- [ ] **Step 5: Conferir os dois temas**

O `bg-muted/40` + `border-border` já são tokens que existem nos dois temas (o bloco "Corte de palpites" da `/regras` usa os mesmos). Nenhuma cor literal foi usada — nada a ajustar, só confirme que não escapou nenhum `text-gray-*` ou `bg-white`.

- [ ] **Step 6: Commit**

```bash
git add src/components/ranking/faixa-campeao.tsx src/components/ranking/__tests__/faixa-campeao.test.tsx
git commit -m "$(cat <<'EOF'
feat: faixa de campeao do mes no ranking

Mes fechado anuncia campeao (ou campeoes, no empate dos seis criterios); mes em
andamento mostra a lideranca. Mes fechado sem ninguem pontuando nao renderiza.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `CompeticaoTabs`

**Files:**
- Create: `src/components/ranking/competicao-tabs.tsx`
- Test: `src/components/ranking/__tests__/competicao-tabs.test.tsx`

**Interfaces:**
- Consumes: `Competicao` e `COOKIE_COMPETICAO` de `@/lib/competicoes-shared`.
- Produces: `<CompeticaoTabs competicoes={Competicao[]} selecionadaId={string} />`

Trocar de aba escreve o cookie e chama `router.refresh()` — exatamente o que o `CompeticaoSelector` do header já faz (`src/components/competicao/competicao-selector.tsx:17-23`). Copie o formato do cookie de lá, sem inventar outro.

Casos de borda: uma competição só → não renderiza; nenhuma **ativa** → todas viram abas (senão quem tem opt-in só na Copa fica sem controle nenhum).

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/components/ranking/__tests__/competicao-tabs.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompeticaoTabs } from "@/components/ranking/competicao-tabs";
import type { Competicao } from "@/lib/competicoes-shared";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const copa: Competicao = { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 };
const bra: Competicao = { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 };

describe("CompeticaoTabs", () => {
  beforeEach(() => {
    refresh.mockReset();
    document.cookie = "competicao=; path=/; max-age=0";
  });

  it("põe as ativas como aba e as inativas em Temporadas anteriores", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    expect(screen.getByRole("tab", { name: "Brasileirão Série A 2026" })).toBeInTheDocument();
    expect(screen.getByText("Temporadas anteriores")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Copa do Mundo 2026" })).toBeInTheDocument();
  });

  it("marca a selecionada com aria-selected", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    expect(screen.getByRole("tab", { name: "Brasileirão Série A 2026" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Copa do Mundo 2026" })).toHaveAttribute("aria-selected", "false");
  });

  it("ao clicar, grava o slug no cookie e dá refresh", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    fireEvent.click(screen.getByRole("tab", { name: "Copa do Mundo 2026" }));
    expect(document.cookie).toContain("competicao=copa-mundo-2026");
    expect(refresh).toHaveBeenCalled();
  });

  it("não renderiza nada com uma competição só", () => {
    const { container } = render(<CompeticaoTabs competicoes={[bra]} selecionadaId="c2" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sem nenhuma ativa, todas viram aba e não há seção de anteriores", () => {
    const outra: Competicao = { ...bra, ativa: false };
    render(<CompeticaoTabs competicoes={[copa, outra]} selecionadaId="c2" />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByText("Temporadas anteriores")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- competicao-tabs
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Crie `src/components/ranking/competicao-tabs.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { COOKIE_COMPETICAO, type Competicao } from "@/lib/competicoes-shared";

export function CompeticaoTabs({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const router = useRouter();

  if (competicoes.length <= 1) return null;

  const ativas = competicoes.filter((c) => c.ativa);
  // Sem nenhuma ativa visível, todas viram aba: um usuário com opt-in só numa
  // competição encerrada ficaria sem controle nenhum.
  const abas = ativas.length > 0 ? ativas : competicoes;
  const anteriores = competicoes.filter((c) => !abas.includes(c));

  function selecionar(comp: Competicao) {
    // Mesmo formato de cookie do seletor do header — 1 ano, escopo raiz.
    document.cookie = `${COOKIE_COMPETICAO}=${comp.slug}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  function classes(selecionada: boolean) {
    return `cursor-pointer rounded-xl px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      selecionada
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    }`;
  }

  return (
    <div className="mb-6">
      <div role="tablist" aria-label="Competição" className="flex flex-wrap gap-1">
        {abas.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === selecionadaId}
            onClick={() => selecionar(c)}
            className={classes(c.id === selecionadaId)}
          >
            {c.nome}
          </button>
        ))}
      </div>
      {anteriores.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Temporadas anteriores
          </span>
          {anteriores.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === selecionadaId}
              onClick={() => selecionar(c)}
              className={`cursor-pointer rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                c.id === selecionadaId
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- competicao-tabs
```
Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ranking/competicao-tabs.tsx src/components/ranking/__tests__/competicao-tabs.test.tsx
git commit -m "$(cat <<'EOF'
feat: abas de competicao na pagina de ranking

Competicoes ativas viram abas; as encerradas ficam numa linha discreta de
Temporadas anteriores. Trocar grava o mesmo cookie do seletor do header.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `RankingContent` — orquestração

**Files:**
- Modify: `src/components/ranking/ranking-content.tsx` (arquivo inteiro — hoje tem 83 linhas)
- Test: `src/components/ranking/__tests__/ranking-content.test.tsx` (arquivo inteiro — os 4 testes existentes precisam das props novas)

**Interfaces:**
- Consumes: `CompeticaoTabs` (Task 6), `MesSelector` (Task 4), `FaixaCampeao` (Task 5), `rotuloMes`/`MesRanking`/`RankingPeriodo` (Task 2), `buscarRanking` (Task 3), `SeasonSelector`/`Podium`/`RankingTable`/`RankingListaMobile` (já existem).
- Produces: `<RankingContent linhasIniciais={RankingRow[]} meuId={string} competicao={Competicao} competicoes={Competicao[]} meses={MesRanking[]} periodoInicial={RankingPeriodo} anoCorrente={number} />`

As quatro props novas são **obrigatórias** — os testes existentes vão quebrar até serem atualizados, e é isso que queremos: nenhum chamador esquecido.

Duas regras de composição que o teste cobre:

1. **O formato decide o sub-controle:** `fases` → `SeasonSelector`; `pontos-corridos` → `MesSelector`.
2. **Lista vazia mostra só a mensagem, sem faixa.** Se `linhas` está vazia, ninguém palpitou — a faixa não acrescenta nada e "ninguém pontuou ainda" duplicaria a mensagem. Se `linhas` tem gente com 0 pontos, a lista **não** está vazia e a faixa mostra corretamente "ninguém pontuou ainda".

- [ ] **Step 1: Reescrever o teste**

Substitua `src/components/ranking/__tests__/ranking-content.test.tsx` inteiro:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RankingContent } from "@/components/ranking/ranking-content";
import type { MesRanking, RankingRow } from "@/lib/ranking";
import { buscarRanking } from "@/app/ranking/actions";
import type { Competicao } from "@/lib/competicoes";

vi.mock("@/app/ranking/actions", () => ({ buscarRanking: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const competicao: Competicao = {
  id: "comp1", slug: "copa-2026", nome: "Copa 2026",
  formato: "fases", ativa: true, ordem: 1,
};

const brasileirao: Competicao = {
  id: "comp2", slug: "brasileirao-2026", nome: "Brasileirão 2026",
  formato: "pontos-corridos", ativa: true, ordem: 2,
};

const meses: MesRanking[] = [
  { mes: "2026-08", jogos: 40, pendentes: 40, palpites: 5, fechado: false },
  { mes: "2026-07", jogos: 32, pendentes: 0, palpites: 160, fechado: true },
];

const linhasIniciais: RankingRow[] = [
  {
    user_id: "u1", apelido: "Abacatão", avatar_url: null,
    pontos: 15, cravadas: 1, acertos_saldo: 0, acertos_resultado: 1,
    acertos_gols: 0, erros: 2, palpites_pontuados: 4, total_palpites: 5,
    pontos_max_total: 40,
  },
];

const linhasTemporada2: RankingRow[] = [
  {
    user_id: "u2", apelido: "Dannilo", avatar_url: null,
    pontos: 20, cravadas: 0, acertos_saldo: 1, acertos_resultado: 2,
    acertos_gols: 0, erros: 1, palpites_pontuados: 4, total_palpites: 4,
    pontos_max_total: 40,
  },
];

function renderCopa(props: Partial<ComponentProps<typeof RankingContent>> = {}) {
  return render(
    <RankingContent
      linhasIniciais={linhasIniciais}
      meuId="u1"
      competicao={competicao}
      competicoes={[competicao]}
      meses={[]}
      periodoInicial="geral"
      anoCorrente={2026}
      {...props}
    />
  );
}

function renderBrasileirao(props: Partial<ComponentProps<typeof RankingContent>> = {}) {
  return render(
    <RankingContent
      linhasIniciais={linhasIniciais}
      meuId="u1"
      competicao={brasileirao}
      competicoes={[brasileirao]}
      meses={meses}
      periodoInicial="2026-08"
      anoCorrente={2026}
      {...props}
    />
  );
}

describe("RankingContent", () => {
  beforeEach(() => {
    vi.mocked(buscarRanking).mockReset();
  });

  it("renderiza com linhasIniciais sem chamar a action", () => {
    renderCopa();
    expect(screen.getAllByText("Abacatão").length).toBeGreaterThan(0);
    expect(buscarRanking).not.toHaveBeenCalled();
  });

  it("ao trocar para temporada_2, chama buscarRanking e renderiza as novas linhas", async () => {
    vi.mocked(buscarRanking).mockResolvedValue(linhasTemporada2);
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    expect(buscarRanking).toHaveBeenCalledWith("comp1", "temporada_2");
    await waitFor(() => {
      expect(screen.getAllByText("Dannilo").length).toBeGreaterThan(0);
    });
  });

  it("em erro da action, some o skeleton e mantém as linhas anteriores", async () => {
    vi.mocked(buscarRanking).mockRejectedValue(new Error("conexão caiu"));
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Abacatão").length).toBeGreaterThan(0);
  });

  it("mostra o estado vazio de período não-mensal", async () => {
    vi.mocked(buscarRanking).mockResolvedValue([]);
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_1" } });
    await waitFor(() => {
      expect(screen.getByText("Nenhum palpite pontuado neste período ainda.")).toBeInTheDocument();
    });
  });

  it("em formato 'fases' usa o SeasonSelector, não o seletor de mês", () => {
    renderCopa();
    expect(screen.getByRole("option", { name: "Temporada 1" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Julho" })).not.toBeInTheDocument();
  });

  it("em formato 'pontos-corridos' usa o seletor de mês, não o SeasonSelector", () => {
    renderBrasileirao();
    expect(screen.getByRole("option", { name: "Julho" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Temporada 1" })).not.toBeInTheDocument();
  });

  it("mostra a faixa do mês selecionado", () => {
    renderBrasileirao();
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
  });

  it("não mostra faixa quando o período é geral", () => {
    renderBrasileirao({ periodoInicial: "geral" });
    expect(screen.queryByText(/em disputa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Campeão de/)).not.toBeInTheDocument();
  });

  it("no estado vazio de um mês, nomeia o mês e não mostra a faixa", async () => {
    vi.mocked(buscarRanking).mockResolvedValue([]);
    renderBrasileirao();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-07" } });
    await waitFor(() => {
      expect(screen.getByText("Ninguém palpitou em Julho ainda.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Campeão de Julho/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- ranking-content
```
Esperado: FAIL — erros de tipo nas props novas e os quatro testes de composição sem o comportamento correspondente.

- [ ] **Step 3: Reescrever o componente**

Substitua `src/components/ranking/ranking-content.tsx` inteiro:

```tsx
"use client";

import { useRef, useState } from "react";
import { Podium } from "@/components/ranking/podium";
import { RankingTable } from "@/components/ranking/ranking-table";
import { RankingListaMobile } from "@/components/ranking/ranking-lista-mobile";
import { SeasonSelector } from "@/components/ranking/season-selector";
import { MesSelector } from "@/components/ranking/mes-selector";
import { FaixaCampeao } from "@/components/ranking/faixa-campeao";
import { CompeticaoTabs } from "@/components/ranking/competicao-tabs";
import { buscarRanking } from "@/app/ranking/actions";
import { rotuloMes, type MesRanking, type RankingPeriodo, type RankingRow } from "@/lib/ranking-shared";
import type { Competicao } from "@/lib/competicoes-shared";

function PodiumSkeleton() {
  return (
    <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6" aria-hidden="true">
      <div className="h-24 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
      <div className="h-32 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
      <div className="h-20 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
    </div>
  );
}

function TableSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
}

export function RankingContent({
  linhasIniciais,
  meuId,
  competicao,
  competicoes,
  meses,
  periodoInicial,
  anoCorrente,
}: {
  linhasIniciais: RankingRow[];
  meuId: string;
  competicao: Competicao;
  competicoes: Competicao[];
  meses: MesRanking[];
  periodoInicial: RankingPeriodo;
  anoCorrente: number;
}) {
  const [periodo, setPeriodo] = useState<RankingPeriodo>(periodoInicial);
  const [linhas, setLinhas] = useState<RankingRow[]>(linhasIniciais);
  const [carregando, setCarregando] = useState(false);
  const periodoAtualRef = useRef<RankingPeriodo>(periodoInicial);

  async function aoTrocarPeriodo(novoPeriodo: RankingPeriodo) {
    setPeriodo(novoPeriodo);
    periodoAtualRef.current = novoPeriodo;
    setCarregando(true);
    try {
      const resultado = await buscarRanking(competicao.id, novoPeriodo);
      if (periodoAtualRef.current === novoPeriodo) {
        setLinhas(resultado);
      }
    } catch {
      // Falha aberta: mantém as linhas anteriores.
    } finally {
      if (periodoAtualRef.current === novoPeriodo) {
        setCarregando(false);
      }
    }
  }

  // Só é mês se o período casar com um mês que a competição realmente tem.
  const mesSelecionado = meses.find((m) => m.mes === periodo);
  const rotulo = mesSelecionado ? rotuloMes(mesSelecionado.mes, anoCorrente) : "";

  return (
    <div>
      <CompeticaoTabs competicoes={competicoes} selecionadaId={competicao.id} />
      {competicao.formato === "fases" ? (
        <SeasonSelector periodo={periodo} onChange={aoTrocarPeriodo} />
      ) : (
        <MesSelector
          meses={meses}
          periodo={periodo}
          onChange={aoTrocarPeriodo}
          anoCorrente={anoCorrente}
        />
      )}
      {carregando ? (
        <>
          <PodiumSkeleton />
          <TableSkeleton />
        </>
      ) : linhas.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          {mesSelecionado
            ? `Ninguém palpitou em ${rotulo} ainda.`
            : "Nenhum palpite pontuado neste período ainda."}
        </p>
      ) : (
        <>
          {mesSelecionado && (
            <FaixaCampeao rotulo={rotulo} fechado={mesSelecionado.fechado} linhas={linhas} />
          )}
          <Podium linhas={linhas} />
          <RankingTable linhas={linhas} meuId={meuId} />
          <RankingListaMobile linhas={linhas} meuId={meuId} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- ranking-content
```
Esperado: PASS, 9 testes.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm test
```
Esperado: tudo verde. Se algo mais quebrar, é um chamador de `RankingContent` que ainda não passa as props novas — o único é `src/app/ranking/page.tsx`, que a Task 8 conserta. Se o teste que quebrar for de página, adiante a Task 8 e volte.

- [ ] **Step 6: Commit**

```bash
git add src/components/ranking/ranking-content.tsx src/components/ranking/__tests__/ranking-content.test.tsx
git commit -m "$(cat <<'EOF'
feat: ranking-content orquestra abas, sub-controle por formato e faixa do mes

O formato da competicao decide o sub-controle: 'fases' segue com o
SeasonSelector, 'pontos-corridos' ganha o seletor de mes. Periodo mensal com
resultado mostra a faixa; lista vazia mostra so a mensagem, nomeando o mes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `page.tsx` — busca dos meses e período inicial

**Files:**
- Modify: `src/app/ranking/page.tsx` (arquivo inteiro — hoje tem 51 linhas)

**Interfaces:**
- Consumes: `listarMesesRanking` (Task 3), `mesCorrenteBRT`/`mesesVisiveis` (Task 2), `RankingContent` com as props novas (Task 7).
- Produces: nada para tasks seguintes.

Server Component com `cookies()` — a página já é dinâmica, nada a mudar nisso. Não há teste de página no projeto; a verificação é `npm run build` mais conferência no navegador.

Dois detalhes que é fácil errar:

- **`anoCorrente` sai do mês em BRT**, não de `new Date().getFullYear()`. Em 31/12 às 22h de Brasília o servidor em UTC já está em 1º/01 — usar o ano local do servidor daria o rótulo errado.
- **A busca do ranking usa `periodoInicial`**, não `"geral"`. Se continuar buscando `"geral"`, a página abre no mês mas mostra os números do acumulado até o primeiro clique.

- [ ] **Step 1: Reescrever a página**

Substitua `src/app/ranking/page.tsx` inteiro:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RankingContent } from "@/components/ranking/ranking-content";
import { getSessao } from "@/lib/auth/profile";
import {
  listarRanking,
  listarMesesRanking,
  mesCorrenteBRT,
  mesesVisiveis,
  type RankingPeriodo,
} from "@/lib/ranking";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

export default async function RankingPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);

  // O ano vem do mês em Brasília: em 31/12 às 22h BRT o servidor em UTC já virou o ano.
  const mesCorrente = mesCorrenteBRT(new Date());
  const anoCorrente = Number(mesCorrente.slice(0, 4));

  const meses =
    atual?.formato === "pontos-corridos"
      ? mesesVisiveis(await listarMesesRanking(atual.id), mesCorrente)
      : [];

  // Pontos corridos abre no mês corrente; se ele não tem jogo, cai no acumulado.
  const periodoInicial: RankingPeriodo = meses.some((m) => m.mes === mesCorrente)
    ? (mesCorrente as RankingPeriodo)
    : "geral";

  const linhas = atual ? await listarRanking(atual.id, periodoInicial) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Ranking
        </h1>
        {atual ? (
          <RankingContent
            key={atual.id}
            linhasIniciais={linhas}
            meuId={sessao.userId}
            competicao={atual}
            competicoes={visiveis}
            meses={meses}
            periodoInicial={periodoInicial}
            anoCorrente={anoCorrente}
          />
        ) : (
          <p className="text-muted-foreground">Nenhuma competição disponível.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Build e suíte**

```bash
npm run build && npm test && npm run lint
```
Esperado: build sem erro, testes verdes, lint sem novidade.

- [ ] **Step 3: Conferir no navegador**

```bash
npm run dev
```

Logado, em `http://localhost:3000/ranking`:

- Brasileirão abre no **mês corrente** com a faixa "… em disputa" (ou, se ninguém palpitou, a mensagem "Ninguém palpitou em … ainda.");
- o seletor lista **Ranking Geral, Agosto e Julho** — sem março, abril nem maio;
- escolher **Julho** mostra a faixa **"Campeão de Julho"**;
- as abas de competição aparecem, com a Copa em "Temporadas anteriores";
- clicar na Copa troca para o `SeasonSelector` (Geral / Temporada 1 / Temporada 2), sem seletor de mês.

Confira nos dois temas.

- [ ] **Step 4: Commit**

```bash
git add src/app/ranking/page.tsx
git commit -m "$(cat <<'EOF'
feat: /ranking busca os meses e abre no mes corrente

Pontos corridos abre na disputa do mes que esta rolando; se o mes corrente nao
tem jogo, cai no acumulado. O ano do rotulo vem do mes em horario de Brasilia.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Esconder o seletor de competição do header em `/ranking`

**Files:**
- Create: `src/components/competicao/competicao-selector-slot.tsx`
- Test: `src/components/competicao/__tests__/competicao-selector-slot.test.tsx`
- Modify: `src/components/site-header.tsx:11` (import) e `:61` (uso)

**Interfaces:**
- Consumes: `CompeticaoSelector` (já existe), `Competicao` de `@/lib/competicoes-shared`.
- Produces: `<CompeticaoSelectorSlot competicoes={Competicao[]} selecionadaId={string} />`

Independente das tasks 1–8; pode rodar a qualquer momento.

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/components/competicao/__tests__/competicao-selector-slot.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Competicao } from "@/lib/competicoes-shared";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { CompeticaoSelectorSlot } = await import(
  "@/components/competicao/competicao-selector-slot"
);

const comps: Competicao[] = [
  { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 },
  { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 },
];

describe("CompeticaoSelectorSlot", () => {
  it("não renderiza em /ranking, onde as abas fazem esse papel", () => {
    mockUsePathname.mockReturnValue("/ranking");
    const { container } = render(<CompeticaoSelectorSlot competicoes={comps} selecionadaId="c2" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o seletor nas outras rotas", () => {
    mockUsePathname.mockReturnValue("/jogos");
    render(<CompeticaoSelectorSlot competicoes={comps} selecionadaId="c2" />);
    expect(screen.getByRole("combobox", { name: "Selecionar competição" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- competicao-selector-slot
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Crie `src/components/competicao/competicao-selector-slot.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { CompeticaoSelector } from "@/components/competicao/competicao-selector";
import type { Competicao } from "@/lib/competicoes-shared";

// Em /ranking a escolha de competição é feita pelas abas da própria página;
// manter o seletor do header ali seriam dois controles para a mesma coisa.
export function CompeticaoSelectorSlot({
  competicoes,
  selecionadaId,
}: {
  competicoes: Competicao[];
  selecionadaId: string;
}) {
  const pathname = usePathname();
  if (pathname === "/ranking") return null;
  return <CompeticaoSelector competicoes={competicoes} selecionadaId={selecionadaId} />;
}
```

- [ ] **Step 4: Ligar no header**

Em `src/components/site-header.tsx`, troque o import da linha 11:

```tsx
import { CompeticaoSelectorSlot } from "@/components/competicao/competicao-selector-slot";
```

e o uso na linha 61:

```tsx
{atual && <CompeticaoSelectorSlot competicoes={visiveis} selecionadaId={atual.id} />}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test && npm run build
```
Esperado: testes verdes (2 novos), build limpo.

- [ ] **Step 6: Commit**

```bash
git add src/components/competicao/competicao-selector-slot.tsx src/components/competicao/__tests__/competicao-selector-slot.test.tsx src/components/site-header.tsx
git commit -m "$(cat <<'EOF'
feat: seletor de competicao do header some em /ranking

A pagina de ranking passou a ter abas proprias; dois controles para a mesma
escolha na mesma tela confundem.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Critérios de desempate na `/regras`

**Files:**
- Create: `src/components/regras/criterios-desempate.tsx`
- Test: `src/components/regras/__tests__/criterios-desempate.test.tsx`
- Modify: `src/app/regras/page.tsx` (inserir o bloco depois do card "Corte de palpites", hoje nas linhas 121-127)

**Interfaces:**
- Consumes: `CRITERIOS_DESEMPATE` da Task 2.
- Produces: `<CriteriosDesempate />` (sem props).

O desempate não depende do formato da competição — o bloco é o mesmo nas duas. Depende da Task 2; independente do resto.

- [ ] **Step 1: Escrever o teste falhando**

Crie `src/components/regras/__tests__/criterios-desempate.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CriteriosDesempate } from "@/components/regras/criterios-desempate";
import { CRITERIOS_DESEMPATE } from "@/lib/ranking-shared";

describe("CriteriosDesempate", () => {
  it("lista os seis critérios, na ordem", () => {
    render(<CriteriosDesempate />);
    const itens = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(itens).toHaveLength(6);
    CRITERIOS_DESEMPATE.forEach((c, i) => {
      expect(itens[i]).toContain(c);
    });
  });

  it("explica o que acontece no empate total", () => {
    render(<CriteriosDesempate />);
    expect(screen.getByText(/divide a posição/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- criterios-desempate
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Crie `src/components/regras/criterios-desempate.tsx`:

```tsx
import { CRITERIOS_DESEMPATE } from "@/lib/ranking-shared";

export function CriteriosDesempate() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
      <p className="mb-2 font-semibold text-foreground">Critérios de desempate</p>
      <p className="mb-3">
        Quando dois palpiteiros terminam com a mesma pontuação, o ranking desce por
        estes critérios, na ordem:
      </p>
      <ol className="ml-5 list-decimal space-y-1">
        {CRITERIOS_DESEMPATE.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <p className="mt-3">
        Quem empatar nos seis divide a posição — inclusive o título de campeão do mês.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Inserir na página**

Em `src/app/regras/page.tsx`, acrescente o import junto dos outros:

```tsx
import { CriteriosDesempate } from "@/components/regras/criterios-desempate";
```

e renderize logo **depois** do card "Corte de palpites" (o `</div>` da linha 127), antes do bloco `{ehFases && (`:

```tsx
        <CriteriosDesempate />
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test && npm run build
```
Esperado: testes verdes (2 novos), build limpo.

- [ ] **Step 6: Conferir no navegador**

Em `/regras`, o bloco aparece abaixo de "Corte de palpites", nos dois temas, nas duas competições.

- [ ] **Step 7: Commit**

```bash
git add src/components/regras/criterios-desempate.tsx src/components/regras/__tests__/criterios-desempate.test.tsx src/app/regras/page.tsx
git commit -m "$(cat <<'EOF'
docs: criterios de desempate na pagina de regras

A cascata de seis niveis passou a valer em todos os rankings; sem estar escrita
em algum lugar, e regra invisivel.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Verificação final

Depois da última task, antes de considerar a branch pronta:

- [ ] `npm test` — todos verdes (esperado: 239 da baseline + 48 líquidos = **287**; são 52 casos novos, dos quais 4 substituem os que já existiam em `ranking-content.test.tsx`)
- [ ] `npm run build` — sem erro de tipo
- [ ] `npm run lint` — sem problema novo
- [ ] `/ranking` do Brasileirão abre no mês corrente, com abas e faixa
- [ ] `/ranking` da Copa mantém Geral / Temporada 1 / Temporada 2, sem seletor de mês
- [ ] O seletor de competição do header sumiu em `/ranking` e continua em `/jogos`, `/historico`, `/feed`, `/pessoas` e `/regras`
- [ ] Tema claro e tema escuro conferidos nas duas telas
- [ ] Mobile: as abas quebram em duas linhas sem estourar a largura
