# Design: Sincronização de mata-mata e placar de 90 minutos

## Contexto

A pontuação do bolão deve considerar apenas o placar dos 90 minutos (tempo normal),
desconsiderando gols da prorrogação. Hoje o `sync-matches` (Edge Function) grava em
`matches.placar_casa/placar_fora` o campo `scores.home/away` retornado pelo endpoint
`tournaments/results` da FlashScore API (RapidAPI). Investigação com o jogo real
Holanda 1×1 Marrocos (decidido nos pênaltis) mostrou dois problemas:

1. **Sem quebra de período.** `tournaments/results` só devolve `scores: {home, away}` —
   não dá pra saber se inclui gols de prorrogação. Já o endpoint
   `matches/details?match_id=...` devolve o detalhamento completo:
   ```json
   "scores": {
     "home": 1, "away": 1,
     "home_1st_half": 0, "away_1st_half": 0,
     "home_2nd_half": 1, "away_2nd_half": 1,
     "home_extra_time": 0, "away_extra_time": 0,
     "home_penalties": 2, "away_penalties": 3
   },
   "match_status": {
     "is_finished_after_extra_time": false,
     "is_finished_after_penalties": true,
     "winner": "draw",
     "final_winner": "away"
   }
   ```
   `home_1st_half + home_2nd_half` = placar dos 90 minutos — é isso que deve virar
   `placar_casa`/`placar_fora`, ignorando `home_extra_time`/`home_penalties`.

2. **Stage do mata-mata não é sincronizado.** `sync-matches` usa um único
   `FS_STAGE_ID` fixo (secret), que hoje aponta pra apenas 1 dos 4 stages "Main"
   (grupos) do torneio. O endpoint `tournaments/ids?tournament_url=...` mostrou que
   o torneio tem **4 stages "Main"** (grupos) + 1 stage **"Play Offs"** (todo o
   mata-mata, diferenciado só pelo texto em `tournament.name`, ex.:
   `"World Championship - Play Offs - 1/16-finals"`). Ou seja: hoje só 1 dos 4
   grupos está sendo sincronizado, e o mata-mata não está sendo sincronizado
   de jeito nenhum.

## Abordagem

Substituir a configuração fixa de um único `FS_STAGE_ID` por **descoberta dinâmica
de stages** via `tournaments/ids`, e sempre calcular o placar de 90 min via
`matches/details` no momento em que um jogo passa a `finalizado` pela primeira vez.
Isso corrige o bug dos 4 "Main" e resolve o mata-mata na mesma mudança — além de
deixar o sync reutilizável para outra competição no futuro (só troca a URL).

### Configuração

- Nova secret única: `FS_TOURNAMENT_URL` (ex.: `/football/world/world-cup/`),
  substitui `FS_TEMPLATE_ID` + `FS_SEASON_ID` + `FS_STAGE_ID`.
- A cada execução do cron, `sync-matches` chama
  `GET /tournaments/ids?tournament_url=<FS_TOURNAMENT_URL>` para obter
  `tournament_template_id`, `season_id` e a lista `tournament_stages[]`
  (cada um com `tournament_stage_id` + `name`).
- Itera **todos** os stages retornados, chamando `fixtures` e `results` para
  cada um (como hoje, só que em loop).

### Placar de 90 minutos

- Ao detectar (como já faz hoje) que um `api_fixture_id` mudou de placar/status
  para `finalizado` pela primeira vez, chamar
  `GET /matches/details?match_id=<id>`.
- Gravar:
  - `placar_casa = home_1st_half + home_2nd_half`
  - `placar_fora = away_1st_half + away_2nd_half`
  - novo campo `decisao`: `'normal' | 'prorrogacao' | 'penaltis'`, derivado de
    `match_status.is_finished_after_extra_time` / `is_finished_after_penalties`.
  - novos campos opcionais `placar_penaltis_casa` / `placar_penaltis_fora`
    (só quando `decisao = 'penaltis'`), puramente informativos — **não entram
    na pontuação**.
- Se a chamada a `matches/details` falhar, cai no comportamento atual (usa
  `scores.home/away` de `tournaments/results` como fallback) e loga o erro —
  não trava o sync.

### Fase / rodada

- Stages nomeados `"Main"` → `fase = 'grupos'`, `rodada` continua pelo bloco de
  data existente (`BLOCOS_GRUPOS`).
- Qualquer outro stage (ex.: `"Play Offs"`) → `fase = 'mata-mata'` por padrão.
  Quando o jogo finaliza e buscamos `matches/details`, extraímos a rodada do
  texto de `tournament.name` (parte após o último `" - "`, ex.:
  `"1/16-finals"` → mapear para rótulo em pt-BR: oitavas/quartas/semifinal/final/
  terceiro lugar). Jogos de mata-mata ainda agendados (não finalizados) ficam com
  `rodada = ''` até finalizarem — aceitável pro escopo atual.

### Migração de banco

Nova migration adicionando em `matches`:
```sql
alter table public.matches
  add column decisao text not null default 'normal'
    check (decisao in ('normal','prorrogacao','penaltis')),
  add column placar_penaltis_casa int,
  add column placar_penaltis_fora int;
```

### UI

- `/regras`: já documentado (card "Jogos com prorrogação") — sem mudança adicional
  necessária além de talvez remover a menção a correção manual se o texto atual
  sugerir isso (revisar).
- Exibição do placar em cards de jogo: opcionalmente mostrar "(pên. 3×2)" quando
  `decisao = 'penaltis'`, mas isso é incremento visual, não obrigatório neste
  escopo — fica como nice-to-have, não bloqueia a entrega.

### Fora de escopo

- Não vamos mexer no modelo de pontuação em si (`pontuacao.ts` / migration 0006).
- Não vamos re-sincronizar retroativamente jogos de grupo que já foram salvos
  com o stage errado/faltante — isso pode rodar naturalmente no próximo cron
  (upsert por `api_fixture_id`), sem necessidade de script de backfill manual.
- Função de debug `debug-fixture-lookup` usada nesta investigação deve ser
  apagada do projeto Supabase (não faz parte da aplicação).

## Testes

- `supabase/functions/_shared/__tests__/fixtures.test.ts`: cobrir o novo
  cálculo de placar 90min a partir de um `FsDetails` mockado (normal,
  prorrogação, pênaltis).
- `sync-matches`: testar (via mock de fetch) que múltiplos stages são
  percorridos e que a chamada a `matches/details` só acontece para jogos que
  transicionam para `finalizado`.
