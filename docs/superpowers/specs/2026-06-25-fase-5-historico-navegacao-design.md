# Cravou! — Fase 5 — Histórico & Navegação — Design / Spec

- **Data:** 2026-06-25
- **Status:** Aprovado (design)
- **Fase do roadmap:** 5 (Histórico & navegação) — ver [PRD](2026-06-24-bolao-copa-design.md) §10
- **Depende de:** Fases 3 (palpites) e 4 (pontuação & ranking), já em produção.

## 1. Contexto e objetivo

Com as Fases 0–4 no ar, o usuário já cadastra, palpita, é pontuado e vê o ranking.
Falta dar a ele duas formas de **acompanhar e navegar**:

1. **Filtros por fase/rodada** na tela de jogos — hoje os 73 jogos vivem numa lista única,
   o que fica insustentável conforme a Copa avança.
2. **Tela "Meu histórico"** — visão consolidada dos palpites passados, com placar real,
   pontos por jogo e um resumo de desempenho.

**Entrega:** o usuário filtra os jogos por fase e rodada e acompanha o próprio
desempenho ao longo da Copa numa tela dedicada.

## 2. Problema de dados (descoberto na exploração)

Todos os 73 jogos no banco estão com `fase='grupos'` e `rodada=''` (vazio). A
Edge Function `sync-matches` **não popula** esses campos: `MatchRow` /
`fixtureToRow` / `resultToRow` (em `supabase/functions/_shared/fixtures.ts`)
mapeiam só times, bandeiras, horário, status e placar — `fase`/`rodada` caem no
default do schema. O payload da API (FlashScore via RapidAPI) tem campos extras
não modelados; **não está confirmado** se há um campo de rodada.

Decisão (com o usuário): **enriquecer a sync via API**, com spike de confirmação
e fallback por data.

## 3. Arquitetura da solução

Três blocos, na ordem de implementação:

### 3.1 Enriquecimento de fase/rodada

1. **Spike de confirmação (descartável):** instrumentar a `sync-matches` para
   logar **um** objeto fixture cru e a estrutura da resposta; disparar a sync pelo
   admin (`dispararSync`); ler via `get_logs` no Supabase. Objetivo: descobrir
   quais campos carregam rodada/estágio. O log é removido depois.
2. **Ingestão enriquecida:** estender `MatchRow` com `fase` e `rodada`, e
   `fixtureToRow`/`resultToRow` para preenchê-los:
   - `fase` vem do stage consultado (hoje só `'grupos'`; quando o mata-mata
     começar, novos `tournament_stage_id` são consultados, cada um com sua fase).
   - `rodada` vem do campo da API **se o spike confirmar que existe**.
3. **Fallback de rodada (se a API não expõe):** função pura
   `rodadaPorData(inicioEm: string, blocos: { rodada: string; ate: string }[]): string`
   — na fase de grupos cada matchday é um bloco de datas; classifica o jogo pela
   primeira fronteira de data que o contém. Testável isoladamente.
4. **Backfill:** popular `fase`/`rodada` dos 73 jogos atuais. Preferência:
   re-sync após o enriquecimento (a sync faz upsert por `api_fixture_id`); se a
   rodada vier do fallback por data, um UPDATE SQL pontual (migration `0007_*`)
   resolve.

> Nota: a sync hoje pula jogos com `placar_manual=true` (override admin). O
> enriquecimento de fase/rodada deve respeitar isso — não sobrescrever placares
> manuais, só completar fase/rodada quando aplicável.

### 3.2 Filtros na tela de jogos (`/jogos`)

- **Dois níveis de chips** no topo: **fase** (Grupos · Oitavas · Quartas · Semi ·
  Final) e, dentro da fase, **rodada**. Só aparecem as fases/rodadas que
  **existem** no banco (hoje só "Grupos").
- **Estado na URL** via search params (`?fase=grupos&rodada=1`): deep-link,
  botão voltar funciona, página segue **server component** (lê os params, busca
  só o recorte). Descartada a alternativa client-side (carregar 73 e esconder no
  browser) por não escalar e perder o deep-link.
- **Default inteligente:** sem params, abre na fase + rodada do **próximo jogo**
  (ou a rodada corrente).
- Dentro do recorte, reusa o `MatchCard` atual (já traz palpite + pontos da Fase 4).
- **Componente novo** `JogosFiltro` (client): renderiza os chips e navega trocando
  os search params. Chips ativos/inativos reusam `buttonVariants("primary"/"ghost")`.

### 3.3 Tela "Meu histórico" (`/historico`)

- **Server component**, acessível por novo link "Histórico" no header (autenticados).
- **Cabeçalho de resumo** — 3 cards: total de pontos · nº de cravadas ·
  aproveitamento (% = pontos ganhos ÷ pontos máximos possíveis nos jogos
  palpitados e já encerrados; máximo por jogo = `pts_placar_exato`).
- **Lista detalhada** — só jogos **finalizados** que o usuário palpitou, mais
  recentes primeiro: times+bandeiras, **seu palpite × placar real**, e os
  **pontos** ganhos, reusando o destaque visual da Fase 4 ("Cravou! +10 pts" /
  "+N pts" / "0 pts").
- **Estado vazio:** mensagem amigável quando ainda não há jogos encerrados palpitados.

## 4. Camada de dados (reuso máximo)

- `listarJogos({ fase?, rodada? })` — estende a assinatura atual (em
  `src/lib/matches.ts`) com filtro opcional; hoje busca tudo.
- `listarFasesERodadas()` — fases/rodadas distintas existentes em `matches`
  (monta os chips só com o que existe).
- Histórico reusa `listarMeusPalpites()` (Fase 3, já retorna `pontos` por
  `match_id`) + `listarJogos()`; sem nova query pesada.

## 5. Funções puras (TDD)

- `rodadaPorData(inicioEm, blocos)` — fallback de rodada (§3.1).
- `resumoHistorico(itens, cfg)` — `{ totalPontos, cravadas, aproveitamento }`
  a partir dos itens do histórico; reusa a noção de "máximo possível" =
  `pts_placar_exato` por jogo.

## 6. Testes

- Unitários das funções puras `rodadaPorData` e `resumoHistorico` (incl. fronteiras
  de data e o caso sem jogos encerrados → aproveitamento 0).
- Componente `JogosFiltro`: chips ativos refletem os params; clicar troca o recorte.
- Componente do resumo do histórico: cards com os valores certos; estado vazio.

## 7. Arquivos (visão geral)

**Criar:**
- `src/lib/jogos/rodada.ts` (+ teste) — `rodadaPorData`.
- `src/lib/historico.ts` (+ teste) — `resumoHistorico` e tipo do item de histórico.
- `src/components/jogos/jogos-filtro.tsx` (+ teste).
- `src/app/historico/page.tsx` + `src/components/historico/resumo.tsx` (+ teste) +
  `src/components/historico/historico-item.tsx`.
- (se necessário) `supabase/migrations/0007_backfill_rodada.sql`.

**Modificar:**
- `supabase/functions/_shared/fixtures.ts` — `MatchRow` + mappers (fase/rodada).
- `supabase/functions/sync-matches/index.ts` — instrumentação do spike (temporária)
  e, conforme o stage, tag de fase.
- `src/lib/matches.ts` — `listarJogos({ fase?, rodada? })` + `listarFasesERodadas()`.
- `src/app/jogos/page.tsx` — ler search params, recorte, render do `JogosFiltro`.
- `src/components/site-header.tsx` — link "Histórico".

## 8. Fora de escopo (YAGNI)

- Estatísticas ricas (distribuição por tipo de acerto, gráfico de evolução) — o
  resumo fica em total/cravadas/aproveitamento.
- Filtro por status (agendado/ao vivo/encerrado) — o recorte é por fase/rodada.
- Histórico de palpites de **outros** usuários — só os próprios.
- Edição retroativa de palpites (segue a regra de corte da Fase 3).

## 9. Riscos

- **API pode não expor rodada** → mitigado pelo fallback `rodadaPorData`.
- **Datas dos matchdays** (fallback) precisam refletir o calendário real da Copa
  2026 → os blocos de data são parametrizados, não hard-coded na lógica.
