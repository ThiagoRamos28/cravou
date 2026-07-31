# Jogos Adiados, Cancelados e Órfãos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o sistema reconhecer jogos adiados e cancelados, tirá-los da listagem até serem remarcados, fechar o vazamento de palpites desses jogos e impedir que competições arquivadas voltem a deixar jogos órfãos sem pontuação.

**Architecture:** Uma varredura de pendências no `sync-matches` passa a consultar `matches/details` para todo jogo ainda `agendado` cujo horário passou há mais de ~100 min, **em qualquer competição, ativa ou não**, e grava `finalizado`, `adiado` ou `cancelado` conforme o `match_status` da API. Uma migration adiciona os dois estados ao check constraint, fecha a política de RLS que expunha palpites de jogo adiado e tira palpites de jogo cancelado do aproveitamento. A camada de listagem passa a esconder os dois estados, com opt-in explícito para o `/admin`.

**Tech Stack:** Deno (Edge Function) · TypeScript · Vitest · Supabase Postgres + RLS · pgTAP · Next.js 16 (App Router)

## Global Constraints

- **Nome de exibição:** `Cravou!` — sempre com ponto de exclamação, verbatim.
- **Idioma da UI e dos identificadores de domínio:** Português do Brasil (`adiado`, `cancelado`, `varrerPendencias`).
- **Fuso horário:** `America/Sao_Paulo` (BRT, UTC−3) em toda exibição ao usuário. `inicio_em` é UTC no banco.
- **TDD obrigatório:** escreva o teste, veja falhar, implemente, veja passar, commit. Um commit por unidade.
- **Mensagens de commit** terminam com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Segredos nunca no client.** Service role e chave da RapidAPI só em Edge Functions.
- **Deno e Supabase CLI não estão disponíveis nesta máquina.** Migrations e deploy da Edge Function vão pelo MCP `supabase-cravou` (`apply_migration`, `deploy_edge_function`). Os testes das funções `_shared/` rodam no Vitest do projeto, não no Deno.
- **Ícones:** `lucide-react`. Nunca emoji como ícone.
- **Estados de `matches.status` após esta entrega:** `agendado`, `ao_vivo`, `finalizado`, `adiado`, `cancelado`.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `supabase/functions/_shared/fixtures.ts` | tipos da API + funções puras de tradução API → linha do banco. Ganha `estadoDePendencia`. | Modificar |
| `supabase/functions/_shared/__tests__/fixtures.test.ts` | testes das funções puras | Modificar |
| `supabase/migrations/0025_jogos_adiados.sql` | check constraint, política RLS, `ranking()`, backfill | Criar |
| `supabase/tests/rls_palpites_adiados.test.sql` | regressão pgTAP do vazamento | Criar |
| `src/lib/matches.ts` | camada de leitura de jogos. `listarJogos` passa a esconder não-jogáveis. | Modificar |
| `src/lib/__tests__/matches-listagem.test.ts` | testes da nova regra de filtro | Criar |
| `src/lib/feed.ts` | `listarJogosParaComposer` exclui não-jogáveis | Modificar |
| `src/app/admin/page.tsx` | opta por ver todos os estados | Modificar |
| `src/components/admin/match-admin-row.tsx` | selo do estado do jogo | Modificar |
| `src/components/admin/__tests__/match-admin-row.test.tsx` | teste do selo | Criar ou modificar |
| `supabase/functions/sync-matches/index.ts` | varredura global de pendências substitui o resgate por competição | Modificar |

---

### Task 1: `estadoDePendencia` — traduzir `match_status` em destino

**Files:**
- Modify: `supabase/functions/_shared/fixtures.ts:20-24` (tipo `FsMatchStatus`)
- Test: `supabase/functions/_shared/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `type EstadoPendencia = "finalizado" | "adiado" | "cancelado"` e
  `estadoDePendencia(details: FsMatchDetails): EstadoPendencia | null`. A Task 4 consome ambos.

**Contexto:** payload real de um jogo adiado, confirmado na API em 2026-07-31 (`match_id=U3fuDcW8`, São Paulo × Santos):

```json
"match_status": { "stage": "Postponed", "is_cancelled": false, "is_postponed": true,
                  "is_started": false, "is_in_progress": false, "is_finished": false,
                  "is_finished_after_extra_time": false, "is_finished_after_penalties": false }
```

- [ ] **Step 1: Escreva os testes que falham**

Acrescente ao fim de `supabase/functions/_shared/__tests__/fixtures.test.ts`:

```ts
describe("estadoDePendencia", () => {
  const base = {
    match_id: "m1",
    scores: {
      home: 0, away: 0,
      home_1st_half: 0, away_1st_half: 0,
      home_2nd_half: 0, away_2nd_half: 0,
      home_extra_time: 0, away_extra_time: 0,
      home_penalties: null, away_penalties: null,
    },
  };

  function comStatus(status: Partial<FsMatchDetails["match_status"]>): FsMatchDetails {
    return {
      ...base,
      match_status: {
        is_finished_after_extra_time: false,
        is_finished_after_penalties: false,
        ...status,
      },
    } as FsMatchDetails;
  }

  it("jogo encerrado vira finalizado", () => {
    expect(estadoDePendencia(comStatus({ is_finished: true }))).toBe("finalizado");
  });

  it("jogo adiado vira adiado", () => {
    expect(
      estadoDePendencia(comStatus({ stage: "Postponed", is_postponed: true }))
    ).toBe("adiado");
  });

  it("jogo cancelado vira cancelado", () => {
    expect(
      estadoDePendencia(comStatus({ stage: "Cancelled", is_cancelled: true }))
    ).toBe("cancelado");
  });

  it("encerrado tem precedência sobre adiado (jogo remarcado que já aconteceu)", () => {
    expect(
      estadoDePendencia(comStatus({ is_finished: true, is_postponed: true }))
    ).toBe("finalizado");
  });

  it("cancelado tem precedência sobre adiado (adiado e depois cancelado de vez)", () => {
    expect(
      estadoDePendencia(comStatus({ is_postponed: true, is_cancelled: true }))
    ).toBe("cancelado");
  });

  it("jogo em andamento ou apenas atrasado não muda de estado", () => {
    expect(estadoDePendencia(comStatus({ is_in_progress: true }))).toBeNull();
    expect(estadoDePendencia(comStatus({}))).toBeNull();
  });

  it("payload sem match_status não muda de estado", () => {
    expect(estadoDePendencia({ ...base } as FsMatchDetails)).toBeNull();
  });
});
```

Acrescente `estadoDePendencia` ao `import` no topo do arquivo (o import de `../fixtures` já existe e já traz `type FsMatchDetails`).

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npm test -- fixtures`
Expected: FAIL — `estadoDePendencia is not a function` / erro de import.

- [ ] **Step 3: Estenda o tipo `FsMatchStatus`**

Em `supabase/functions/_shared/fixtures.ts`, substitua o tipo existente (linhas 20-24):

```ts
export type FsMatchStatus = {
  stage?: string;
  is_finished?: boolean;
  is_postponed?: boolean;
  is_cancelled?: boolean;
  is_in_progress?: boolean;
  is_finished_after_extra_time: boolean;
  is_finished_after_penalties: boolean;
};
```

- [ ] **Step 4: Implemente `estadoDePendencia`**

Acrescente logo depois de `resgateDeDetalhes` em `supabase/functions/_shared/fixtures.ts`:

```ts
export type EstadoPendencia = "finalizado" | "adiado" | "cancelado";

// Destino de um jogo que continua `agendado` muito depois do horário marcado.
// A ordem das checagens importa: um jogo remarcado que já aconteceu chega com
// `is_finished` e pode carregar `is_postponed` antigo — encerrado vence. E um jogo
// adiado que depois foi cancelado de vez carrega os dois — cancelado vence, porque
// é terminal e `adiado` ficaria esperando para sempre uma remarcação que não vem.
// `null` = nada a fazer: jogo atrasado ou em andamento, que a próxima run reavalia.
export function estadoDePendencia(details: FsMatchDetails): EstadoPendencia | null {
  const s = details.match_status;
  if (!s) return null;
  if (s.is_finished) return "finalizado";
  if (s.is_cancelled) return "cancelado";
  if (s.is_postponed) return "adiado";
  return null;
}
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `npm test -- fixtures`
Expected: PASS — todos, inclusive os que já existiam.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/__tests__/fixtures.test.ts
git commit -m "feat: estadoDePendencia traduz match_status em adiado/cancelado/finalizado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration 0025 — estados, RLS e ranking

**Files:**
- Create: `supabase/migrations/0025_jogos_adiados.sql`
- Test: `supabase/tests/rls_palpites_adiados.test.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `matches.status` aceita `adiado` e `cancelado`; a política `predictions_select_started_matches` deixa de expor palpites desses jogos; `ranking(uuid, text)` ignora palpites de jogo cancelado. As Tasks 3 e 4 dependem do check constraint aceitar os valores novos.

**Contexto que não pode ser perdido:**
- A política atual é `to public` (não `to authenticated`) e carrega `auth.uid() is not null` inline. **Preserve as duas coisas** — trocar o papel mudaria o alcance da política.
- A `ranking()` vigente é a da migration 0024, que pré-filtra `predictions` por competição via `exists` para não vazar pontos entre competições. **Esse `exists` não pode ser removido** — ele conserta um bug real ([memória `project_ranking_vazamento_competicao`](../../../NEXT_STEPS.md)). A mudança aqui é somar `and mm.status <> 'cancelado'` a ele.

- [ ] **Step 1: Escreva o teste de regressão pgTAP**

Crie `supabase/tests/rls_palpites_adiados.test.sql`:

```sql
-- rls_palpites_adiados.test.sql
-- Regressão: o palpite de um jogo ADIADO não pode ficar visível para outro usuário.
-- A política predictions_select_started_matches libera palpites alheios quando
-- inicio_em <= now(). Num jogo adiado a data original já passou e o jogo NÃO aconteceu,
-- então quem ainda não palpitou enxergaria os palpites dos outros e palpitaria informado
-- quando o jogo fosse remarcado.
-- Execução: cole no execute_sql do MCP Supabase (roda em transação e faz ROLLBACK).

CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(5);

-- autor  = quem palpitou   'c1c1c1c1-0000-0000-0000-0000000000a1'
-- bisbi  = quem quer olhar 'c2c2c2c2-0000-0000-0000-0000000000a2'
DELETE FROM auth.users WHERE id IN
  ('c1c1c1c1-0000-0000-0000-0000000000a1', 'c2c2c2c2-0000-0000-0000-0000000000a2');
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('c1c1c1c1-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'autor-adiado@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}'),
  ('c2c2c2c2-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'bisbilhoteiro@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');

DELETE FROM public.competicoes WHERE id = 'cc000000-0000-0000-0000-0000000000cc';
INSERT INTO public.competicoes (id, slug, nome, formato, ativa, ordem) VALUES
  ('cc000000-0000-0000-0000-0000000000cc', 'test-adiado', 'Comp Adiado',
   'pontos-corridos', true, 92);

DELETE FROM public.matches WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
INSERT INTO public.matches
  (id, api_fixture_id, competicao_id, time_casa, time_fora, inicio_em, status)
VALUES
  ('dd000000-0000-0000-0000-0000000000dd', 'adiado-test-1',
   'cc000000-0000-0000-0000-0000000000cc', 'Time1', 'Time2',
   NOW() - INTERVAL '2 days', 'agendado');

DELETE FROM public.predictions WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd';
INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora) VALUES
  ('c1c1c1c1-0000-0000-0000-0000000000a1', 'dd000000-0000-0000-0000-0000000000dd', 3, 1);

-- Vira o bisbilhoteiro (authenticated).
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 1) Jogo AGENDADO com horário vencido: o palpite alheio é visível (comportamento atual,
--    correto — o jogo começou).
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  1,
  'jogo agendado que ja comecou: palpite alheio visivel'
);

RESET role;
UPDATE public.matches SET status = 'adiado'
  WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 2) Jogo ADIADO: o palpite alheio some.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo adiado: palpite alheio NAO vaza'
);

RESET role;
UPDATE public.matches SET status = 'cancelado'
  WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 3) Jogo CANCELADO: idem.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo cancelado: palpite alheio NAO vaza'
);

-- Remarcação: o jogo volta a 'agendado' com data no futuro, como o upsert do sync faria.
RESET role;
UPDATE public.matches
   SET status = 'agendado', inicio_em = NOW() + INTERVAL '2 days'
 WHERE id = 'dd000000-0000-0000-0000-0000000000dd';

-- 4) O palpite feito antes do adiamento foi PRESERVADO e voltou a ser editável.
--    palpite_aberto() olha só inicio_em, então a remarcação reabre a edição sozinha —
--    é o que torna a regra de produto gratuita. Este teste protege essa premissa.
SELECT ok(
  public.palpite_aberto('dd000000-0000-0000-0000-0000000000dd'),
  'jogo remarcado: palpite volta a ser editavel'
);

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 5) E o palpite alheio volta a ficar escondido, porque a nova data ainda não chegou.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo remarcado para o futuro: palpite alheio segue escondido'
);

SELECT * FROM finish();
ROLLBACK;
```

O teste 4 é a única verificação automatizada de que "preservar e reabrir para edição" funciona.
Não existe código implementando essa regra — ela cai de graça do fato de `palpite_aberto()`
depender só de `inicio_em`. Se alguém um dia acrescentar uma checagem de `status` a essa
função, este teste quebra e explica o porquê.

- [ ] **Step 2: Rode o teste e confirme que falha**

Cole o arquivo inteiro no `execute_sql` do MCP `supabase-cravou`.
Expected: a execução **aborta** no primeiro `UPDATE ... SET status = 'adiado'`, com
`new row for relation "matches" violates check constraint "matches_status_check"` — o estado
`adiado` ainda não existe. Esse erro é o sinal de que a migration não foi aplicada; só os
testes 1 chegam a rodar. Depois da migration os 5 devem passar.

- [ ] **Step 3: Escreva a migration**

Crie `supabase/migrations/0025_jogos_adiados.sql`:

```sql
-- supabase/migrations/0025_jogos_adiados.sql
-- 0025 — Jogos adiados e cancelados.
--
-- Contexto: `matches.status` só tinha agendado/ao_vivo/finalizado. Um jogo adiado ficava
-- `agendado` com `inicio_em` no passado e nunca saía da listagem (aparecia com o palpite
-- fechado, para sempre). Pior: a política predictions_select_started_matches libera os
-- palpites alheios quando `inicio_em <= now()`, então os palpites de um jogo que NÃO
-- aconteceu ficavam expostos a todo usuário logado.
--
-- Três mudanças:
--   1. status aceita 'adiado' (reversível — volta a 'agendado' quando remarcado) e
--      'cancelado' (terminal).
--   2. a política de leitura de palpites alheios passa a exigir que o jogo não esteja
--      adiado nem cancelado.
--   3. ranking() ignora palpites de jogo cancelado: o jogo deixou de existir e não pode
--      estragar o aproveitamento de ninguém.

-- 1. Estados ────────────────────────────────────────────────────────────────────────────
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status = any (array['agendado', 'ao_vivo', 'finalizado', 'adiado', 'cancelado']));

-- 2. RLS ────────────────────────────────────────────────────────────────────────────────
-- Mantém `to public` + `auth.uid() is not null` inline, exatamente como estava: trocar o
-- papel mudaria o alcance da política.
drop policy if exists predictions_select_started_matches on public.predictions;
create policy predictions_select_started_matches on public.predictions
  for select to public
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.inicio_em <= now()
        and m.status not in ('adiado', 'cancelado')
    )
  );

-- 3. Ranking ────────────────────────────────────────────────────────────────────────────
-- Idêntica à 0024, com uma única diferença: o pré-filtro de `predictions` (que conserta o
-- vazamento entre competições e NÃO pode ser removido) passa a descartar também os jogos
-- cancelados, tirando-os de todos os agregados — inclusive de `total_palpites`.
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
  -- Só os palpites DESTA competição, e nunca os de jogo cancelado.
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

-- 4. Backfill ───────────────────────────────────────────────────────────────────────────
-- Os 4 jogos do Brasileirão marcados para 2026-07-29 17:00 BRT. A API confirmou
-- `is_postponed: true` nos quatro em 2026-07-31.
update public.matches
   set status = 'adiado', atualizado_em = now()
 where api_fixture_id in ('dKNS3gge', 'ARJ356Ua', 'U3fuDcW8', '2c2gkfv2')
   and status = 'agendado';
```

- [ ] **Step 4: Aplique a migration**

Use o MCP `supabase-cravou` → `apply_migration`, `name: "0025_jogos_adiados"`, com o conteúdo do arquivo.
Expected: sucesso, sem erro.

- [ ] **Step 5: Rode o teste pgTAP e confirme que passa**

Cole `supabase/tests/rls_palpites_adiados.test.sql` no `execute_sql`.
Expected: `ok 1`, `ok 2`, `ok 3` — 3/3.

- [ ] **Step 6: Confirme o backfill e que nada mais ficou pendente**

Rode no `execute_sql`:

```sql
select c.slug, m.status, count(*) as qtd
from matches m join competicoes c on c.id = m.competicao_id
where m.inicio_em < now() - interval '4 hours'
  and m.status in ('agendado', 'adiado', 'cancelado')
group by 1, 2 order by 1, 2;
```

Expected: `brasileirao-2026 | adiado | 4` e **nenhuma** linha `agendado`. Se sobrar `agendado`, um jogo novo entrou em pendência desde o planejamento — investigue antes de seguir, não force o backfill.

- [ ] **Step 7: Rode a suíte inteira e o teste de isolamento entre competições**

Run: `npm test`
Expected: verde (a suíte estava em 228 no fim da última sessão).

Cole também `supabase/tests/ranking_isolacao_competicao.test.sql` no `execute_sql` — a `ranking()` foi reescrita e o isolamento entre competições não pode ter regredido.
Expected: 3/3.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0025_jogos_adiados.sql supabase/tests/rls_palpites_adiados.test.sql
git commit -m "feat: estados adiado/cancelado + fecha vazamento de palpites (migration 0025)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Esconder não-jogáveis das listagens, com opt-in para o admin

**Files:**
- Modify: `src/lib/matches.ts:72-106` (`listarJogos`)
- Modify: `src/lib/feed.ts:234-251` (`listarJogosParaComposer`)
- Modify: `src/app/admin/page.tsx:15`
- Modify: `src/components/admin/match-admin-row.tsx`
- Test: `src/lib/__tests__/matches-listagem.test.ts` (criar)

**Interfaces:**
- Consumes: os estados `adiado` e `cancelado` habilitados pela Task 2.
- Produces: `listarJogos` ganha a opção `incluirNaoJogaveis?: boolean` (default `false`). O tipo `Match["status"]` passa a incluir os dois estados novos.

**Atenção — armadilha real:** `/admin` chama `listarJogos()` **sem filtro** ([admin/page.tsx:15](../../../src/app/admin/page.tsx)). Se o filtro for incondicional, o admin perde de vista exatamente os jogos que precisa corrigir à mão. Daí o opt-in.

- [ ] **Step 1: Escreva os testes que falham**

Crie `src/lib/__tests__/matches-listagem.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpcData: { data: unknown } = { data: [] };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      const encadeia = () => q;
      q.select = encadeia;
      q.order = encadeia;
      q.eq = encadeia;
      q.in = encadeia;
      q.not = encadeia;
      q.then = (resolve: (v: unknown) => unknown) => resolve(mockRpcData);
      return q;
    },
  }),
}));

import { listarJogos } from "@/lib/matches";

const jogoBase = {
  fase: "grupos",
  rodada: "",
  time_casa: "Sao Paulo",
  time_fora: "Santos",
  bandeira_casa: null,
  bandeira_fora: null,
  placar_casa: null,
  placar_fora: null,
  odds: null,
};

describe("listarJogos — jogos não-jogáveis", () => {
  beforeEach(() => {
    mockRpcData.data = [
      { ...jogoBase, id: "1", status: "agendado", inicio_em: "2026-09-01T20:00:00Z" },
      { ...jogoBase, id: "2", status: "adiado", inicio_em: "2026-07-29T20:00:00Z" },
      { ...jogoBase, id: "3", status: "cancelado", inicio_em: "2026-07-29T20:00:00Z" },
      { ...jogoBase, id: "4", status: "finalizado", inicio_em: "2026-07-01T20:00:00Z" },
    ];
  });

  it("por padrão esconde adiado e cancelado", async () => {
    const jogos = await listarJogos();
    expect(jogos.map((j) => j.id)).toEqual(["1", "4"]);
  });

  it("esconde adiado mesmo quando o jogo tem palpite (some para todos)", async () => {
    const jogos = await listarJogos();
    expect(jogos.some((j) => j.status === "adiado")).toBe(false);
  });

  it("incluirNaoJogaveis devolve todos os estados (visão do admin)", async () => {
    const jogos = await listarJogos({ incluirNaoJogaveis: true });
    expect(jogos.map((j) => j.id)).toEqual(["1", "2", "3", "4"]);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npm test -- matches-listagem`
Expected: FAIL — o primeiro teste devolve os 4 ids, porque nada é filtrado ainda.

- [ ] **Step 3: Implemente o filtro em `listarJogos`**

Em `src/lib/matches.ts`, no tipo `Match` (linha 25), troque:

```ts
  status: "agendado" | "ao_vivo" | "finalizado" | "adiado" | "cancelado";
```

Na assinatura de `listarJogos` (linha 72), acrescente a opção:

```ts
export async function listarJogos(filtro?: {
  fase?: string;
  rodada?: string;
  soAbertos?: boolean;
  soEncerrados?: boolean;
  minutosCorte?: number;
  limite?: number;
  competicaoId?: string;
  // Jogo adiado ou cancelado some da listagem: adiado não aconteceu e cancelado nunca vai
  // acontecer, então nenhum dos dois é palpitável nem faz sentido no histórico. O /admin
  // opta por vê-los para poder corrigir à mão.
  incluirNaoJogaveis?: boolean;
}): Promise<Match[]> {
```

E, logo depois de `let resultado = (data as Match[]) ?? [];` (linha 89), antes do bloco `if (filtro?.soAbertos)`:

```ts
    if (!filtro?.incluirNaoJogaveis) {
      resultado = resultado.filter(
        (m) => m.status !== "adiado" && m.status !== "cancelado"
      );
    }
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npm test -- matches-listagem`
Expected: PASS — 3/3.

- [ ] **Step 5: Dê ao admin a visão completa**

Em `src/app/admin/page.tsx`, linha 15:

```ts
  const jogos = await listarJogos({ incluirNaoJogaveis: true });
```

- [ ] **Step 6: Exclua os não-jogáveis do composer do feed**

Em `src/lib/feed.ts`, dentro de `listarJogosParaComposer`, acrescente o filtro à query — logo depois de `.gte("inicio_em", limite.toISOString())`:

```ts
      .not("status", "in", '("adiado","cancelado")')
```

- [ ] **Step 7: Escreva o teste do selo (falhando)**

`MatchAdminRow` é client component e usa `useActionState` com a server action `salvarPlacar`,
que precisa ser mockada. Crie `src/components/admin/__tests__/match-admin-row.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match } from "@/lib/matches";

vi.mock("@/app/admin/actions", () => ({
  salvarPlacar: vi.fn(async () => ({})),
}));

import { MatchAdminRow } from "@/components/admin/match-admin-row";

function jogo(status: Match["status"]): Match {
  return {
    id: "m1",
    fase: "grupos",
    rodada: "",
    time_casa: "Sao Paulo",
    time_fora: "Santos",
    bandeira_casa: null,
    bandeira_fora: null,
    inicio_em: "2026-07-29T20:00:00Z",
    status,
    placar_casa: null,
    placar_fora: null,
    odds: null,
  };
}

describe("MatchAdminRow — selo de estado", () => {
  it("mostra o selo Adiado", () => {
    render(<MatchAdminRow match={jogo("adiado")} />);
    expect(screen.getByText("Adiado")).toBeInTheDocument();
  });

  it("mostra o selo Cancelado", () => {
    render(<MatchAdminRow match={jogo("cancelado")} />);
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("não mostra selo em jogo agendado", () => {
    render(<MatchAdminRow match={jogo("agendado")} />);
    expect(screen.queryByText("Adiado")).toBeNull();
    expect(screen.queryByText("Cancelado")).toBeNull();
  });
});
```

Run: `npm test -- match-admin-row`
Expected: FAIL nos dois primeiros — `Unable to find an element with the text: Adiado`.

- [ ] **Step 8: Implemente o selo**

`src/components/admin/match-admin-row.tsx` hoje não renderiza `status` em lugar nenhum — o
selo é conteúdo novo. Insira logo depois do `<span>` com os nomes dos times (linhas 17-19),
antes do primeiro `<label className="sr-only">`:

```tsx
      {(match.status === "adiado" || match.status === "cancelado") && (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          {match.status === "adiado" ? "Adiado" : "Cancelado"}
        </span>
      )}
```

Run: `npm test -- match-admin-row`
Expected: PASS — 3/3.

- [ ] **Step 9: Rode a suíte inteira e o build**

Run: `npm test`
Expected: verde.

Run: `npm run build`
Expected: sucesso (o build roda type-check — o tipo `Match["status"]` mudou e qualquer consumidor incompatível aparece aqui).

- [ ] **Step 10: Commit**

```bash
git add src/lib/matches.ts src/lib/feed.ts src/app/admin/page.tsx src/components/admin/match-admin-row.tsx src/lib/__tests__/matches-listagem.test.ts src/components/admin/__tests__/match-admin-row.test.tsx
git commit -m "feat: jogos adiados e cancelados somem das listagens (admin ve com selo)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Varredura global de pendências no sync

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts:395-480` (remover o resgate por competição)
- Modify: `supabase/functions/sync-matches/index.ts:565-597` (chamar a varredura após o loop)

**Interfaces:**
- Consumes: `estadoDePendencia` e `EstadoPendencia` da Task 1; os estados habilitados pela Task 2.
- Produces: `varrerPendencias(supabase, agora): Promise<{ finalizados: number; adiados: number; cancelados: number; pendentes: number }>`, incluída na resposta JSON da função.

**Por que substituir e não somar.** O resgate atual vive **dentro** de `syncCompeticao`, então (a) só roda para competição com `ativa = true` — foi assim que a final da Copa ficou órfã — e (b) filtra por `idsNasListas`, pulando todo jogo que veio na lista de fixtures. Um jogo adiado **continua aparecendo em `fixtures` com o horário antigo**, então esse filtro é exatamente o que impediu os 4 jogos de serem detectados. Manter os dois mecanismos gastaria duas chamadas de API para o mesmo jogo na mesma run. A varredura global faz tudo que o resgate fazia, sem os dois defeitos.

- [ ] **Step 1: Remova o bloco de resgate por competição**

Em `supabase/functions/sync-matches/index.ts`, apague o trecho que começa no comentário
`// ── Resgate ativo de jogos "no limbo" ─` e termina imediatamente antes de `return {` no fim de `syncCompeticao` (linhas 395-480). A função passa a terminar assim:

```ts
  return {
    total: rows.length,
    upserted: paraUpsert.length,
    pulados_manual: rows.length - paraUpsert.length,
  };
}
```

Se `idsNasListas` ficar sem uso após a remoção, apague também a declaração dele.

- [ ] **Step 2: Acrescente `estadoDePendencia` ao import de `_shared/fixtures.ts`**

No topo de `index.ts`, o import de `../_shared/fixtures.ts` já traz `placar90Min`, `resgateDeDetalhes` e `rodadaFromTournamentName`. Acrescente `estadoDePendencia`. Se `resgateDeDetalhes` ficar sem uso após a Task, remova-o do import (a função continua existindo em `_shared` com seus testes).

- [ ] **Step 3: Escreva a varredura**

Acrescente esta função logo antes de `Deno.serve(`:

```ts
// ── Varredura de pendências ────────────────────────────────────────────────────────────
// Todo jogo ainda `agendado` muito depois do horário marcado é uma pendência: ou terminou e
// a lista `results` do torneio ainda não o refletiu, ou foi adiado, ou foi cancelado.
// `matches/details` sabe qual dos três na hora, e precisa só do api_fixture_id — por isso a
// varredura roda sobre TODAS as competições, ativas ou não. Competição arquivada com jogo em
// aberto foi o que deixou a final da Copa sem pontuar.
// Sem filtro por "veio nas listas": um jogo adiado continua aparecendo em `fixtures` com o
// horário antigo, e era esse filtro que o escondia da detecção.
async function varrerPendencias(
  supabase: ReturnType<typeof createClient>,
  agora: number
): Promise<{ finalizados: number; adiados: number; cancelados: number; pendentes: number }> {
  const RESGATE_APOS_MS = 100 * 60 * 1000; // 90min + intervalo + folga
  const limite = new Date(agora - RESGATE_APOS_MS).toISOString();

  const { data: candidatos } = await supabase
    .from("matches")
    .select("id, api_fixture_id, placar_casa, placar_fora, time_casa, time_fora, fase, status")
    .eq("status", "agendado")
    .eq("placar_manual", false)
    .lt("inicio_em", limite)
    .order("inicio_em", { ascending: true });

  const pendentes = candidatos ?? [];
  const contagem = { finalizados: 0, adiados: 0, cancelados: 0, pendentes: pendentes.length };

  const LOTE = 5;
  for (let i = 0; i < pendentes.length; i += LOTE) {
    const lote = pendentes.slice(i, i + LOTE);
    await Promise.all(
      lote.map(async (c) => {
        try {
          const detalhes = await fsGetDetails(c.api_fixture_id as string);
          const destino = estadoDePendencia(detalhes);
          if (!destino) return; // atrasado ou em andamento: a próxima run reavalia

          if (destino === "adiado" || destino === "cancelado") {
            const { error: upErr } = await supabase
              .from("matches")
              .update({ status: destino, atualizado_em: new Date().toISOString() })
              .eq("id", c.id as string);
            if (upErr) {
              console.error(
                JSON.stringify({
                  evento: "pendencia_upsert_erro",
                  api_fixture_id: c.api_fixture_id,
                  destino,
                  mensagem: upErr.message,
                })
              );
              return;
            }
            if (destino === "adiado") contagem.adiados++;
            else contagem.cancelados++;

            await supabase.from("audit_log").insert({
              user_id: null,
              acao: `sync_jogo_${destino}`,
              tabela: "matches",
              registro_id: c.id,
              dados_anteriores: { status: c.status },
              dados_novos: {
                status: destino,
                time_casa: c.time_casa,
                time_fora: c.time_fora,
              },
            });
            return;
          }

          // destino === "finalizado": grava o placar de 90 min (regra do mata-mata).
          const placar = placar90Min(detalhes);
          const rodada =
            c.fase === "mata-mata" && detalhes.tournament?.name
              ? rodadaFromTournamentName(detalhes.tournament.name)
              : undefined;

          const { error: upErr } = await supabase
            .from("matches")
            .update({
              status: "finalizado",
              placar_casa: placar.placar_casa,
              placar_fora: placar.placar_fora,
              decisao: placar.decisao,
              placar_penaltis_casa: placar.placar_penaltis_casa,
              placar_penaltis_fora: placar.placar_penaltis_fora,
              ...(rodada !== undefined ? { rodada } : {}),
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", c.id as string);
          if (upErr) {
            console.error(
              JSON.stringify({
                evento: "pendencia_upsert_erro",
                api_fixture_id: c.api_fixture_id,
                destino,
                mensagem: upErr.message,
              })
            );
            return;
          }
          contagem.finalizados++;

          await supabase.from("audit_log").insert({
            user_id: null,
            acao: "sync_placar_resgate",
            tabela: "matches",
            registro_id: c.id,
            dados_anteriores: { placar_casa: c.placar_casa, placar_fora: c.placar_fora },
            dados_novos: {
              placar_casa: placar.placar_casa,
              placar_fora: placar.placar_fora,
              time_casa: c.time_casa,
              time_fora: c.time_fora,
            },
          });
        } catch (e) {
          if (e instanceof RateLimitError) throw e;
          console.error(
            JSON.stringify({
              evento: "pendencia_details_erro",
              api_fixture_id: c.api_fixture_id,
              mensagem: e instanceof Error ? e.message : String(e),
            })
          );
        }
      })
    );
    if (i + LOTE < pendentes.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return contagem;
}
```

- [ ] **Step 4: Chame a varredura depois do loop de competições**

Em `Deno.serve`, entre o fim do `for (const comp of ...)` e o `upsert` do `REFRESH_KEY`, insira:

```ts
  // Roda uma vez por run, sobre todas as competições (inclusive arquivadas).
  let pendencias;
  try {
    pendencias = await varrerPendencias(supabase, agora);
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn(JSON.stringify({ evento: "rate_limit", path: e.path, etapa: "pendencias" }));
      return new Response(JSON.stringify({ ok: false, motivo: "429", path: e.path }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    throw e;
  }
```

E inclua o resultado na resposta final:

```ts
  return new Response(JSON.stringify({ ok: true, competicoes: resumos, pendencias }), {
    headers: { "Content-Type": "application/json" },
  });
```

- [ ] **Step 5: Verifique que a suíte e o type-check continuam verdes**

Run: `npm test`
Expected: verde. (O `index.ts` da Edge Function não é coberto por testes locais — Deno não roda aqui. A cobertura é a função pura da Task 1 mais a validação em produção da Task 5.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "feat: varredura global de pendencias detecta adiado/cancelado e alcanca competicao arquivada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Deploy e validação em produção

**Files:** nenhum arquivo novo — deploy e verificação.

**Interfaces:**
- Consumes: tudo das Tasks 1-4.

**Contexto de deploy (não redescubra):** Deno e o Supabase CLI **não** estão disponíveis nesta máquina. O deploy vai pelo MCP `supabase-cravou` → `deploy_edge_function`, com 5 arquivos: `source/index.ts`, `_shared/fixtures.ts`, `_shared/escudos.ts`, `_shared/odds.ts`, `source/deno.json`. Use `entrypoint_path: source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`, e mantenha `_shared` um nível acima do entrypoint. O script `scratchpad/build_deploy.py` gera o payload a partir do disco. A versão em produção no início desta task é a **v27**.

- [ ] **Step 1: Gere o payload e faça o deploy**

Rode `scratchpad/build_deploy.py` para montar o payload e publique via MCP `deploy_edge_function`.
Expected: nova versão ACTIVE (v28).

- [ ] **Step 2: Dispare o sync manualmente**

No `execute_sql` do MCP:

```sql
delete from sync_cache where chave = 'ultimo_refresh';
do $$ declare cmd text; begin
  select command into cmd from cron.job where jobid = 1; execute cmd;
end $$;
```

Expected: sem erro. O `delete` força o refresh completo em vez de esperar a janela de jogo.

- [ ] **Step 3: Confirme que nenhuma pendência sobrou**

Aguarde ~1 min e rode:

```sql
select c.slug, m.status, count(*) as qtd,
       max((m.inicio_em at time zone 'America/Sao_Paulo')::text) as ultimo_brt
from matches m join competicoes c on c.id = m.competicao_id
where m.inicio_em < now() - interval '4 hours'
  and m.status in ('agendado', 'adiado', 'cancelado')
group by 1, 2 order by 1, 2;
```

Expected: `brasileirao-2026 | adiado | 4` e **zero** linhas com `agendado`.

- [ ] **Step 4: Confirme que o vazamento fechou**

```sql
select count(*) as palpites_expostos
from matches m join predictions p on p.match_id = m.id
where m.inicio_em <= now() and m.status in ('adiado', 'cancelado');
```

Expected: a contagem existe (11 palpites continuam gravados — nada foi apagado), mas a política já não os libera. A prova de que a RLS fechou é o teste pgTAP da Task 2, que roda como um usuário `authenticated` de verdade; esta query roda como service role e enxerga tudo por definição.

- [ ] **Step 5: Fumaça na UI**

Abra a produção logado como `thiagorc85@gmail.com` (a conta certa do Cravou! — **não** `informatica@disdal.com.br`) e confirme:
- `/jogos` do Brasileirão **não** mostra os 4 jogos de 29/07, nem para quem palpitou neles.
- `/admin` mostra os 4 com o selo **Adiado**.
- `/ranking` do Brasileirão continua com os mesmos pontos de antes (nenhum jogo cancelado existe hoje, então nada deve mudar).
- `/ranking` da Copa mostra a pontuação já corrigida da final (ASVEZVEM e Luiz com os pontos de 2026-07-31).

Login por **link mágico** via `agent-browser`, com atenção ao **rate limit por hora** do Supabase — vários envios seguidos travam com "Não foi possível enviar o link".

- [ ] **Step 6: Atualize o ledger e o NEXT_STEPS**

Registre em `.superpowers/sdd/progress.md` o que foi entregue (tasks, commits, versão da Edge Function) e atualize `NEXT_STEPS.md`: a spec 1 sai da fila e as três seguintes (listagens, ranking mensal, alertas) continuam pendentes, com as animações fora da fila.

- [ ] **Step 7: Commit**

```bash
git add .superpowers/sdd/progress.md NEXT_STEPS.md
git commit -m "docs: jogos adiados entregues e validados em producao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notas para quem executa

- **Não mexa no `soAbertos`.** A regra que mantém jogos vencidos na aba de abertos
  ([matches.ts:90-99](../../../src/lib/matches.ts)) é feia e será limpa na spec de listagens.
  O backfill da Task 2 resolve os 4 casos de hoje; mudar a regra agora sobrepõe duas specs.
- **Não implemente aviso de adiamento.** Notificar a galera pertence à spec de alertas.
- **Efeito colateral bem-vindo:** o portão de "janela de jogo" do sync
  ([index.ts:520-530](../../../supabase/functions/sync-matches/index.ts)) força uma run sempre
  que existe um `agendado` vencido. Os 4 jogos presos vinham fazendo o sync rodar em toda
  batida do cron. Marcá-los como `adiado` devolve o comportamento econômico.
- **Limitação assumida e documentada:** jogo de competição arquivada que seja adiado e depois
  remarcado não volta sozinho — sem lista de fixtures, o sync não vê a data nova. Fica
  `adiado` até correção manual.
