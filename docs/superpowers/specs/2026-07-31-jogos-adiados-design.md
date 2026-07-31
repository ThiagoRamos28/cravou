# Spec — Jogos adiados, cancelados e órfãos

**Data:** 2026-07-31
**Status:** aprovada, aguardando plano de implementação

## Problema

Três sintomas com a mesma aparência — um jogo preso em `status = 'agendado'` com
`inicio_em` no passado — e três causas diferentes:

1. **Adiados.** Quatro jogos do Brasileirão marcados para 2026-07-29 17:00 BRT foram
   adiados. Continuam aparecendo em `/jogos` com o palpite fechado, porque
   [`listarJogos`](../../../src/lib/matches.ts) mantém na aba de abertos qualquer jogo cujo
   horário já passou (`inicio_em <= agora`). Como não existe estado "adiado", eles nunca saem
   da lista.

2. **Órfãos de competição arquivada.** Dois jogos da Copa (final Espanha × Argentina e
   disputa de 3º lugar França × Inglaterra) **aconteceram** e nunca foram pontuados. O sync
   itera apenas competições com `ativa = true`
   ([`index.ts:554`](../../../supabase/functions/sync-matches/index.ts)); quando a Copa foi
   arquivada esses dois jogos ainda não tinham resultado e ficaram fora do alcance do sync
   para sempre. Onze palpites nunca pontuaram e o ranking da Copa ficou incompleto.
   **Corrigido manualmente em 2026-07-31** (ver "Backfill"); falta impedir a recorrência.

3. **Vazamento de palpites.** A política `predictions_select_started_matches` libera os
   palpites alheios quando `inicio_em <= now()`. Para um jogo adiado a data original já
   passou, então os 11 palpites dos 4 jogos ficaram visíveis a qualquer usuário logado, num
   jogo que ainda não aconteceu. Quem ainda não palpitou pode ler os palpites dos outros e
   palpitar informado quando o jogo for remarcado.

## Decisões de produto

- **Adiado some da listagem, sem exceção** — inclusive para quem já palpitou.
- **Palpite de jogo adiado é preservado e volta a ser editável** quando o jogo for remarcado,
  até o novo corte. Ninguém perde o palpite por não voltar ao site; ninguém sai em vantagem
  por ter demorado a palpitar.
- **Cancelado é estado próprio e terminal.** Os palpites permanecem gravados, nunca pontuam e
  não entram no aproveitamento de ninguém. Nenhum dado é apagado.

## Arquitetura

### Estados

`matches_status_check` passa a aceitar `adiado` e `cancelado`, além de
`agendado | ao_vivo | finalizado`.

`adiado` é **reversível**: quando a API devolver o jogo com data nova, o upsert normal do sync
o traz de volta a `agendado` com o novo `inicio_em`. `cancelado` é terminal.

### Detecção — varredura de pendências no sync

Todo jogo ainda `agendado` cujo `inicio_em` passou há mais de 4 horas ganha uma consulta a
`matches/details`, **em qualquer competição, ativa ou não**. O `match_status` da resposta
decide o destino:

| Campo da API | Destino |
|---|---|
| `is_finished` | `finalizado` com placar de 90 min (lógica já existente) |
| `is_postponed` | `adiado` |
| `is_cancelled` | `cancelado` |
| nenhum dos três | permanece `agendado` (jogo atrasado, em andamento) |

Isso resolve os três problemas com um mecanismo só. Funciona em competição arquivada porque
`matches/details` precisa apenas do `api_fixture_id` — não depende de `fs_tournament_url`,
que é `null` na Copa.

**Alternativas descartadas.** Ler `is_postponed` da lista de fixtures da competição seria mais
barato, mas não alcança competição arquivada — não teria evitado a órfã — e a lista pode não
trazer o campo que `details` traz. Correção manual pelo admin já existe como fallback, mas
depender de alguém perceber foi exatamente o que produziu a final não pontuada.

**Custo de quota.** Uma chamada por jogo pendente por run, e cada jogo sai da varredura assim
que é resolvido (deixa de ser `agendado`). Hoje seriam 4.

**Base existente.** A varredura já existe em espírito no resgate de jogos "no limbo"
([`index.ts:398-440`](../../../supabase/functions/sync-matches/index.ts)). O trabalho é
estendê-la para cobrir competições inativas e gravar os estados novos, não criá-la do zero.

### Reabertura ao remarcar — sem código novo

`palpite_aberto(match_id)` calcula o corte exclusivamente a partir de `inicio_em`, sem olhar
`status`. Basta o sync gravar a data nova e a RLS reabre a edição sozinha, com os palpites
antigos preservados. A regra de produto acordada não custa nenhuma linha de código.

### RLS — fechar o vazamento

`predictions_select_started_matches` passa a exigir, além de `inicio_em <= now()`, que o jogo
**não** esteja `adiado` nem `cancelado`. A mudança fecha a exposição retroativamente.

### Onde cada estado aparece

| Lugar | Comportamento |
|---|---|
| `/jogos` | `adiado` e `cancelado` nunca aparecem — nem para quem palpitou |
| `/historico` | já filtra `finalizado`; nada a fazer |
| Composer do feed (`listarJogosParaComposer`) | passa a excluir os dois estados |
| `/admin` | continua vendo todos os jogos, com selo do estado |

### Ranking

- Palpite de jogo **cancelado** sai do `total_palpites` da função `ranking()` — o jogo deixou
  de existir e não pode estragar o aproveitamento de ninguém.
- Pontos já ficam `null` automaticamente: `recalcular_pontos` só pontua `status = 'finalizado'`.
- Palpite de jogo **adiado** continua contando como palpite pendente, igual a qualquer jogo
  futuro.

## Componentes

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `_shared/fixtures.ts` — `estadoDePendencia(details)` | função pura: `FsMatchDetails` → `'finalizado' \| 'adiado' \| 'cancelado' \| null` | tipos da API |
| `_shared/fixtures.ts` — `FsMatchStatus` | ganha `stage`, `is_postponed`, `is_cancelled` | — |
| `sync-matches/index.ts` — varredura | seleciona pendentes de **todas** as competições e grava o estado | `estadoDePendencia` |
| migration 0025 | check constraint, política RLS, `ranking()`, backfill | — |
| `src/lib/matches.ts` — `listarJogos` | exclui `adiado` e `cancelado` | — |
| `src/lib/feed.ts` — `listarJogosParaComposer` | exclui `adiado` e `cancelado` | — |

## Backfill

- Os 4 jogos do Brasileirão viram `adiado` — a API confirmou `is_postponed: true` em todos.
- Os 2 jogos da Copa **já foram corrigidos em 2026-07-31**: final Espanha × Argentina gravada
  como 0×0 com `decisao = 'prorrogacao'` (regra dos 90 minutos; 1×0 veio na prorrogação) e
  3º lugar França × Inglaterra como 4×6, `decisao = 'normal'`. O gatilho repontuou os 11
  palpites com o modelo mata-mata (15/7/4/1): ASVEZVEM +4 e Luiz +1 na final; ninguém pontuou
  no 3º lugar.

## Testes

- **Unitários (Vitest):** `estadoDePendencia` para cada combinação de `match_status` —
  finalizado, adiado, cancelado, em andamento, e o caso degenerado de `match_status` ausente.
- **Regressão de RLS (pgTAP):** um jogo `adiado` com `inicio_em` no passado **não** expõe os
  palpites a outro usuário; o mesmo jogo em `agendado` expõe. Protege o vazamento de voltar.
- **Listagem:** `/jogos` não devolve jogo `adiado` nem `cancelado`, inclusive para o dono do
  palpite.
- **Ranking:** palpite de jogo cancelado não entra em `total_palpites`.

## Limitação assumida

Jogo de competição **arquivada** que seja adiado e depois remarcado não volta sozinho: sem
lista de fixtures, o sync não enxerga a data nova, e o jogo fica `adiado` até correção manual.
É o cruzamento de dois casos raros — aceito conscientemente.

## Fora de escopo

- Avisar a galera que um jogo foi adiado ou remarcado → spec de alertas (4ª da fila).
- Paginação, filtro de data e ordenação em `/jogos` e `/historico` → spec de listagens (2ª da fila).
- A regra `soAbertos` que segura jogos vencidos na aba de abertos: o backfill resolve os 4
  casos de hoje; a limpeza da regra pertence à spec de listagens.

## Contexto

Primeira de quatro specs derivadas da sessão de 2026-07-31, na ordem acordada: **adiados** →
listagens (data/ordenação/paginação) → ranking mensal → alerta de jogo sem palpite. Animações
e "cara divertida" ficam por último, fora da fila, para não animar telas que ainda vão mudar
de estrutura.
