# Odds nos jogos — Design

**Data:** 2026-07-16
**Contexto:** feature futura listada em "Fora de escopo" da spec `2026-07-16-multi-competicao.md`.

## Objetivo

Exibir, no card de cada jogo **agendado**, as odds pré-jogo de três mercados — **1x2**
(casa/empate/fora), **Over/Under 2.5** e **Ambas marcam** — como informação de apoio ao palpite.
As odds vêm da FlashScore API e são um **snapshot único** capturado perto do início do jogo,
minimizando o consumo da quota da RapidAPI.

## Decisões de design

- **Estratégia de busca:** 1x por jogo, perto do início. Busca as odds uma única vez, quando o
  jogo agendado entra na janela do sync (~2h antes) e ainda não tem odds. Nunca reatualiza.
- **Fonte da odd:** um bookmaker de referência — **bet365** se presente na resposta, senão a
  primeira casa disponível. Não é média nem melhor odd.
- **Mercados:** apenas `FULL_TIME` — `HOME_DRAW_AWAY` (1x2), `OVER_UNDER` com
  `handicap.value == "2.5"` (over/under 2.5) e `BOTH_TEAMS_TO_SCORE` (ambas marcam).
- **Exibição:** recolhível ("ver odds") no card, só para jogos com `status !== 'finalizado'` e
  que tenham odds capturadas.

## Formato da API (`matches/odds`)

Endpoint: `GET /api/flashscore/v2/matches/odds?match_id=<id>&geo_ip_code=BR` (via `fsFetch`).

A resposta é uma **lista de bookmakers** (~26), cada um:

```
{ "name": "bet365", "image": "...", "odds": [ <mercado>, ... ] }
```

Cada `<mercado>` tem `bettingType`, `bettingScope` e `odds` (lista de seleções). Seleções
relevantes:

- **`HOME_DRAW_AWAY` / `FULL_TIME`** — 3 entradas, ordem `[casa, empate, fora]`. `value` = odd
  decimal (string). Casa/fora identificáveis por `eventParticipantId` (empate tem id nulo).
- **`OVER_UNDER` / `FULL_TIME`** — várias linhas de handicap; filtrar `handicap.value == "2.5"`,
  com `selection` `"OVER"`/`"UNDER"`.
- **`BOTH_TEAMS_TO_SCORE` / `FULL_TIME`** — 2 entradas, `bothTeamsToScore` `true`/`false`.

> O payload é grande (~880 KB/jogo). Extraímos só o bookmaker de referência e esses 3 mercados;
> nada do restante é persistido.

## Armazenamento

Nova coluna `matches.odds jsonb` (nullable). Migration `0023_matches_odds.sql`:

```sql
alter table public.matches add column if not exists odds jsonb;
```

Shape do JSON (odds como string, preservando a formatação decimal da API):

```json
{
  "casa": "2.32", "empate": "3.10", "fora": "3.00",
  "over25": "1.95", "under25": "1.85",
  "ambas_sim": "1.80", "ambas_nao": "1.95",
  "bookmaker": "bet365",
  "capturado_em": "2026-07-16T18:00:00.000Z"
}
```

Campos individuais podem ser `null` se aquele mercado não vier na resposta; o objeto só é gravado
se ao menos o 1x2 existir (senão `odds` fica `null` e o card não mostra nada).

## Componentes

### `supabase/functions/_shared/odds.ts` (novo — puro, testável)

- Tipos `FsBookmaker`/`OddsSnapshot`.
- `extrairOdds(payload: unknown): OddsSnapshot | null` — recebe o JSON da API, escolhe o
  bookmaker de referência (bet365 → 1ª), extrai os 3 mercados e devolve os 7 valores +
  `bookmaker` + `capturado_em`. Retorna `null` se não houver bookmaker ou se faltar o 1x2.
  Sem I/O — testável com fixture pequeno.

### `supabase/functions/sync-matches/index.ts` (modificar)

Dentro de `syncCompeticao`, após montar `rows` e antes/junto do upsert:

- Selecionar de `rows` os jogos `status === 'agendado'` cujo `inicio_em` está dentro da janela
  (`agora + JANELA_ANTES_MS`) e que ainda não têm odds no banco (consulta `matches` por
  `api_fixture_id` com `odds IS NULL`, ou reaproveita `mapaExistentes`).
- Para cada um, em **lotes de 5** com delay de 250ms (mesmo padrão do fetch de detalhes),
  chamar `fsFetch('/api/flashscore/v2/matches/odds?match_id=...&geo_ip_code=BR')`, passar por
  `extrairOdds` e, se não-nulo, setar `r.odds`.
- `RateLimitError` (429) propaga e aborta a run inteira, como no restante do sync.
- O upsert de `matches` já grava a coluna `odds` (incluída no row).

`MatchRow` (em `_shared/fixtures.ts`) ganha `odds?: OddsSnapshot | null`.

### `src/lib/matches.ts` (modificar)

- Tipo `Odds` exportado (mesmo shape do JSON).
- `Match` ganha `odds: Odds | null`.
- `COLS` inclui `odds`.

### `src/components/jogos/odds-jogo.tsx` (novo — client)

- `"use client"`. Props: `odds: Odds`.
- Toggle "▾ ver odds" (`ChevronDown` do lucide, rotaciona ao abrir). Recolhido por padrão.
- Expandido: linha 1x2 (Casa/Empate/Fora com os valores) + linha "Over 2.5 · Ambas marcam".
  Campos ausentes (null) são omitidos.
- Tailwind, dark+light, `cursor-pointer`, foco visível.

### `src/components/jogos/match-card.tsx` (modificar)

- Renderizar `<OddsJogo odds={match.odds} />` **só quando** `match.odds != null` e
  `match.status !== 'finalizado'`. Posição: após o `PalpiteForm` (conforme layout recolhível).

## Fluxo de dados

```
sync-matches (janela ~2h antes)
  → fsFetch matches/odds  → extrairOdds → matches.odds (jsonb)
listarJogos (server) → Match.odds
  → MatchCard → OddsJogo (client, recolhível)
```

## Tratamento de erros

- Falha ao buscar/parsear odds de um jogo: loga e segue (não grava odds; card sem odds). Não
  derruba o sync.
- 429: aborta a run (quota global), igual ao resto do sync.
- `listarJogos`/UI: `odds` nulo → card sem a seção de odds (comportamento atual preservado).

## Testes

- `extrairOdds`: bet365 presente; bet365 ausente (usa 1ª casa); mercado 1x2 faltando → `null`;
  over/under sem linha 2.5 → `over25/under25` nulos mas objeto válido; ambas marcam ausente →
  campos nulos.
- `OddsJogo`: renderiza recolhido (odds não visíveis); expande ao clicar; não quebra com `odds`
  parcial (campos nulos omitidos).
- `npm test` e `npm run build` passam.

## Fora de escopo

- Outros mercados (handicap asiático/europeu, correct score, HT/FT, ímpar/par).
- Histórico/variação de odds ao longo do tempo (só snapshot).
- Média entre bookmakers ou "melhor odd".
- Odds ao vivo (in-play).
- Refetch/atualização das odds após a captura inicial.
