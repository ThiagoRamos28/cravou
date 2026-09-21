# Próximos passos — Cravou!

Última atualização: **2026-09-21**, branch `master`. Sem branches de trabalho abertas —
`feat/sugestoes-telegram` foi mergeada e publicada nesta sessão.

## Estado atual

| Onde | O quê | Estado |
|---|---|---|
| `master` | Spec 1 (jogos adiados), spec 2 (listagens de jogos) e spec 3 (ranking mensal) | Todas mergeadas e em produção |
| `master` | Sugestões de placar via Telegram (Edge Function `sugerir-placares`, uso pessoal do admin) | Em produção, cron ativo; teste manual recebido. **1º envio real ainda não observado** (§0) |
| — | Spec 4 (alertas de jogo sem palpite) | Não iniciada — decisões de design em aberto (§1) |
| — | Animações / "cara divertida" | Não iniciada — fora da fila numerada, fica para o fim |

Migrations aplicadas em produção até `0028` (`sugestoes_placar`). A `0029` (cron) **não** foi
aplicada como migration: o job `sugerir-placares` foi criado por SQL copiando o comando do job
`sync-matches` com `replace()` da URL, para não expor o `CRON_SECRET` — o arquivo `0029` fica
como documentação, com placeholder `<CRON_SECRET>`. Deploy `sync-matches` em `v28`,
`sugerir-placares` em `v1`.

`.gitignore` tem uma alteração local **não commitada** (`/.agents/`, `/skills-lock.json`),
anterior a esta sessão e não mexida por ela — decidir se entra no repo.

## 0. Conferir o 1º envio real das sugestões ← começar por aqui

O próximo jogo agendado é **São Paulo x Santos, 02/10 às 20:00 (Brasília)**. A mensagem deve
chegar no Telegram entre ~18:00 e 18:15, **uma vez só**. Conferir depois:

- `select * from sugestoes_placar;` — 1 linha para o jogo, `fonte = 'odds+forma'` (se vier
  `'forma'`, o sync não capturou as odds a tempo — investigar a janela de 2h do `sync-matches`);
- `select status_code, content from net._http_response order by id desc limit 5;` — respostas
  das runs (`{"ok":true,"enviados":1,...}` na run que enviou);
- se não chegou nada: logs da função (`query_logs` filtrando `sugestao`). Erro
  `Telegram 400 chat not found` = bot sem `/start` ou `TELEGRAM_CHAT_ID` errado.

Teste manual a qualquer hora, sem gravar: `POST .../functions/v1/sugerir-placares?forcar=<api_fixture_id>`
com o header `x-cron-secret` (dá para montar em SQL lendo o segredo do `cron.job` do sync via
`regexp_match`, como foi feito nesta sessão).

## 0.1 Avaliar e calibrar o modelo (depois de algumas rodadas)

Cruzar `sugestoes_placar.sugestoes` (jsonb com as 3 opções) com `matches.placar_casa/fora` e
calcular os pontos de cada opção por `pontos_palpite`. Constantes ajustáveis no topo de
`supabase/functions/_shared/palpite-modelo.ts`: mistura odds/forma (70/30), ρ Dixon-Coles
(−0,10), fatores de mando (1,1/0,9), janela de forma (10 jogos). Ideia extra: usar a escalação
confirmada (`matches/lineups`, +1 chamada de API por jogo).

## 1. Spec 4 — Alertas de jogo sem palpite ← próximo passo maior

Avisar quem optar por receber que tem jogo perto do corte e ainda sem palpite. Também deve
cobrir avisar quando um jogo é **adiado ou remarcado** (ficou explicitamente fora da spec 1).
Absorve o item antigo "notificações push (pré-corte do palpite)".

Decisões ainda abertas, a resolver num brainstorming antes de especificar:
- **Canal** — e-mail? push? in-app?
- **Opt-in** — por usuário, desligado por padrão ou ligado por padrão?
- **Agendamento** — o `pg_cron` já existe para o sync, dá para reaproveitar o mesmo mecanismo
- **Deduplicação** — para não virar spam a cada corrida do cron

Comece com `superpowers:brainstorming` — não há spec nem plano escritos ainda para isso.

## 2. Revisão final pendente da spec 1 (jogos adiados)

Ainda não rodou. Os *minors* adiados ao longo das 5 tasks da spec 1 nunca foram triados.
Lista em `.superpowers/sdd/2026-07-31-jogos-adiados/progress.md` (**não apagar** antes disso).
Rodar `superpowers:requesting-code-review` sobre `213abcc..84455c5`.

(Specs 2 e 3 já passaram por revisão nesta e em sessões anteriores — spec 2 revisada e
corrigida em 2026-08-04, spec 3 revisada em sessão anterior com 10 revisões por task + revisão
de branch inteira.)

## 3. Fumaça visual da spec 1 em produção

Nunca feita ao vivo. Logado como `thiagorc85@gmail.com` (rate limit de link mágico por hora —
por isso não foi automatizada; combine com outras conferências pendentes na mesma sessão de
login), conferir:

- `/jogos` do Brasileirão **não** mostra os 4 jogos de 29/07 (Atlético-MG×Bragantino,
  Chapecoense×Vasco, São Paulo×Santos, Botafogo×Grêmio);
- `/admin` mostra os 4 com o selo **Adiado**;
- `/ranking` da Copa tem a final pontuada (ASVEZVEM +4, Luiz +1).

## 4. Animações / "cara divertida"

Pedido do Thiago, deixado para o fim e fora da fila numerada. As specs 2 e 3 (agora ambas
mergeadas) mudaram a estrutura das telas de listagem e de ranking; animar deixou de ser
retrabalho garantido. O projeto já usa Framer Motion respeitando `prefers-reduced-motion`.

## Dívidas técnicas conhecidas (nenhuma é bug ativo)

- **`RateLimitError` engolido no loop de `transicoes`** do `sync-matches`
  (`supabase/functions/sync-matches/index.ts`, ~linha 347): um 429 ali faz o jogo ser gravado
  com o placar **cheio** e `decisao: 'normal'` — errado para mata-mata pela regra dos 90
  minutos — e, com a trava anti-reversão da spec 1, isso **não** é mais sobrescrito depois.
  Candidato a spec própria. Pré-existente.
- **`matches.rodada` vazio no Brasileirão.** A API expõe o número no `tournament.name`
  (`"Serie A Betano - Round 21"`). Sem isso não há filtro por rodada.
- **`app_config` é global.** `recalcular_pontos` escolhe o modelo pela **data do jogo** (corte
  04/07), não pela competição. O Brasileirão só recebe Modelo A (15/7/4/1) por coincidência de
  calendário. Ver memória `project_virada_modelo_sql_manual`.
- **Sem snapshot do campeão do mês.** Decisão explícita da spec 3: se um placar de mês fechado
  for corrigido, o campeão daquele mês muda retroativamente.
- **A regra de desempate está escrita em três lugares** que nada mantém em sincronia: o
  `order by` da `ranking()`, o filtro de `campeaoDoMes` e a prosa de `CRITERIOS_DESEMPATE`
  (ambos em `src/lib/ranking-shared.ts`). Comentários se referenciam; nenhum teste amarra.
- Varredura de pendências sem piso de data nem `.limit()`: jogo cujo `match_status` nunca
  resolve vira candidato permanente, 1 chamada de API por run para sempre.
- **`ranking()` devolve o geral para período inválido.** Com o regex estrito da 0027, uma
  string como `'2026-99'` não casa com nenhum ramo do `case` e cai no `else true`, que não
  filtra nada. Avaliado e deixado de propósito — só alcançável por SQL/MCP direto, não pela UI.
  Correção, se um dia incomodar: ramo explícito para `'geral'` e `else false`.

## Referências úteis para retomar

- **`PRODUCT.md`** (raiz) — verdade de produto do Cravou! (usuários, propósito, princípios).
  Criado em 2026-08-04 como pré-requisito do skill `impeccable`; ler antes de qualquer
  trabalho de UI.
- **Specs e planos entregues:** `docs/superpowers/specs/2026-07-31-listagens-jogos-design.md`
  e `docs/superpowers/plans/2026-07-31-listagens-jogos.md` (spec 2);
  `docs/superpowers/specs/2026-08-01-ranking-mensal-design.md` e
  `docs/superpowers/plans/2026-08-01-ranking-mensal.md` (spec 3).
- **`.superpowers/sdd/2026-08-01-ranking-mensal/progress.md`** — ledger da execução da spec 3.
- **`.superpowers/sdd/2026-07-31-jogos-adiados/progress.md`** — ledger da spec 1.
  **Não apagar** antes do item 2 acima.
- Nota do vault: `D:\Obsidian\vault-thiago\Projetos\Pessoais\Cravou!.md` — o que **já foi
  feito e aprendido** (este arquivo é sobre o que **falta**). Atualizada em 2026-09-21 com as
  sugestões de placar via Telegram.
- `CLAUDE.md` / `AGENTS.md` — convenções: Next.js 16 com breaking changes (ler
  `node_modules/next/dist/docs/` antes de usar API do Next), fuso `America/Sao_Paulo`, TDD,
  trailer de commit.
- **Deploy do `sync-matches`:** MCP `deploy_edge_function`, 5 arquivos, `entrypoint_path:
  source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`, `_shared` um
  nível acima do entrypoint. Deno e Supabase CLI **não** estão instalados nesta máquina —
  migration se aplica por MCP `apply_migration`.
- **Sugestões via Telegram:** plano em `docs/superpowers/plans/2026-09-21-sugestoes-telegram.md`.
  Deploy por MCP `deploy_edge_function` com 4 arquivos (`index.ts`, `deno.json`,
  `../_shared/palpite-modelo.ts`, `../_shared/telegram.ts`), `verify_jwt: false`. Secrets
  `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` cadastrados pelo Thiago no Dashboard (nunca pelo
  agente). O token do bot foi colado no chat desta sessão — foi recomendado `/revoke` no
  @BotFather antes de cadastrar.
- **Disparar o sync manualmente:** `do $$ declare cmd text; begin select command into cmd
  from cron.job where jobid=1; execute cmd; end $$;` — e antes, para forçar,
  `delete from sync_cache where chave='ultimo_refresh';`.
- **IDs das competições:** Brasileirão `95c30703-b92b-4086-82b2-a8ccfc005d11`, Copa
  `44e62908-b9cb-4f67-9eff-0b7a1b6a800c`. **Brasileirão `fs_tournament_url`** =
  `/football/brazil/serie-a-betano/`.
