# Próximos passos — Cravou!

Última atualização: **2026-08-01**, fim de sessão. Branch de trabalho: `feat/ranking-mensal`.

> ⚠️ **O banco de produção já está à frente do código.** As migrations **0026** e **0027** foram
> aplicadas no Supabase, mas o código que as usa **não** foi mergeado nem deployado. Isso é
> seguro hoje (leia o §0), mas é a primeira coisa que uma sessão nova precisa saber.

## §0 — O estado do banco, antes de qualquer coisa

Não existe ambiente de staging do Supabase neste projeto: aplicar a migration é a única forma de
verificá-la. Então a `ranking()` em produção **já é a versão nova**, com o ramo mensal e a
cascata de desempate de seis níveis, e a `ranking_meses()` **já existe**.

Por que isso não quebrou nada: o frontend que está no ar chama `ranking()` só com `'geral'`,
`'temporada_1'` e `'temporada_2'`, e nesses três a função nova responde igualzinho à antiga —
verificado linha a linha contra a saída de antes. A cascata nova também não move ninguém: todos
os `pontos` são distintos nos cinco rankings vivos, então nenhum par chega sequer ao segundo
critério.

**Consequência prática:** se um dia você reverter o código, **não** reverta as migrations junto —
o banco pode ficar na frente sem problema, mas não pode ficar atrás.

## Estado atual

Três frentes abertas, nenhuma mergeada:

| Onde | O quê | Testes | Estado |
|---|---|---|---|
| `master` | 6 commits de docs sem push (specs, planos, este arquivo) | 239 | só documentação, nada de código |
| `feat/listagens-jogos` | Spec 2 — listagens de jogos (data, ordenação, paginação) | 271 | código completo, **nunca revisado** |
| `feat/ranking-mensal` | Spec 3 — ranking mensal + abas de competição | 287 | código completo, **revisado e verificado** |

**As duas branches não tocam nenhum arquivo-fonte em comum** — conferido com
`git diff --name-only`. A única colisão é este `NEXT_STEPS.md`, que existe nas duas: ao mergear a
`feat/listagens-jogos`, resolva o conflito ficando com a versão de `master` (esta, que é a mais
nova). A ordem de merge, portanto, tanto faz.

Spec 1 (jogos adiados) está mergeada e em produção desde 2026-07-31 — `sync-matches` v28,
migration 0025.

## 1. Conferência visual do ranking mensal ← começar por aqui

É a **única coisa que faltou** na spec 3. Exige login, e o link mágico do Supabase tem rate limit
por hora — por isso ficou de fora da automação.

Logado como **`thiagorc85@gmail.com`** (NÃO `informatica@disdal.com.br`, que vem do bloco
`# userEmail` e é de outro contexto), com `npm run dev` na branch `feat/ranking-mensal`:

**Em `/ranking`, Brasileirão:**
- abre no **mês corrente** (Agosto). Hoje isso significa **tela vazia**: "Ninguém palpitou em
  Agosto ainda.", sem pódio e sem tabela. **É o comportamento decidido**, não um bug — mas é o
  maior efeito visível do deploy, então olhe com calma e decida se ainda concorda. Se mudar de
  ideia, é uma linha em `src/app/ranking/page.tsx:44` (cair no mês mais recente com palpite, ou
  no geral, quando o mês corrente não tem nenhum);
- o seletor lista **Ranking Geral, Agosto e Julho** — e **não** março, abril nem maio (têm jogo,
  não têm palpite);
- escolher **Julho** mostra a faixa **"Campeão de Julho"** com o Mandioca (137 pts);
- as abas de competição aparecem no topo, com a Copa numa linha "Temporadas anteriores";
- o **seletor de competição do header sumiu** nessa rota (e só nela — confira que continua em
  `/jogos`, `/historico`, `/feed`, `/pessoas` e `/regras`).

**Clicando na aba da Copa:** volta o `SeasonSelector` (Geral / Temporada 1 / Temporada 2), sem
seletor de mês, com o popover de pontuação das temporadas.

**Em `/regras`:** bloco novo "Critérios de desempate" abaixo de "Corte de palpites", igual nas
duas competições.

**Nos dois temas**, claro e escuro. No mobile, conferir que as abas quebram em duas linhas sem
estourar a largura.

Se estiver tudo certo: `superpowers:finishing-a-development-branch` na `feat/ranking-mensal`. O
merge para `master` dispara deploy automático na Vercel.

## 2. Mergear a spec 2 (`feat/listagens-jogos`)

Decisão do Thiago em 2026-07-31: segurar o merge até a revisão final (§3). O código está pronto e
verificado (271 testes, build, lint sem novidade), só nunca passou por revisor.

Quando for mergear: `git merge --no-ff`, rodar `npm test` **no resultado mergeado**, e só então
`git push origin master`.

**Mudanças de comportamento que a galera vai notar** — vale avisar no grupo:
- o chip "Abertos" virou **"A fazer"** e agora significa "não encerrados"
  (`status in ('agendado','ao_vivo')`): inclui jogo ao vivo e jogo aguardando resultado. De
  quebra fecha um buraco em que um jogo a 10 min do apito sumia da aba;
- o **resumo do `/historico` passou a refletir o filtro**: filtrar julho mostra os pontos de
  julho, não o total de sempre.

## 3. Revisão final da spec 1 e da spec 2

A spec 3 já foi revisada — 10 revisões por task mais uma revisão de branch inteira, com uma leva
de correções aplicada e verificada. Sobra:

- **Spec 1 (jogos adiados, já em produção):** os *minors* adiados ao longo das 5 tasks nunca
  foram triados. Lista em `.superpowers/sdd/2026-07-31-jogos-adiados/progress.md` (**não apagar**
  antes disso). Rodar sobre `213abcc..84455c5`.
- **Spec 2:** executada inline, sem ciclo implementador → revisor. Três tropeços foram achados
  durante a própria execução (tipo `Palpite` inventado onde o certo era `Prediction`, dois mocks
  faltando, asserção assumindo texto único num card que repete o nome do time). Rodar sobre
  `master..feat/listagens-jogos`.

## 4. Fumaça visual da spec 1 em produção

Nunca feita ao vivo. Logado como `thiagorc85@gmail.com`, conferir:

- `/jogos` do Brasileirão **não** mostra os 4 jogos de 29/07 (Atlético-MG×Bragantino,
  Chapecoense×Vasco, São Paulo×Santos, Botafogo×Grêmio);
- `/admin` mostra os 4 com o selo **Adiado**;
- `/ranking` da Copa tem a final pontuada (ASVEZVEM +4, Luiz +1).

Dá para juntar com o §1 na mesma sessão de login, aproveitando o rate limit.

## 5. Alertas de jogo sem palpite (spec 4)

A maior das quatro: sistema novo, não ajuste. Avisar quem optar por receber que tem jogo perto do
corte e ainda sem palpite. Decisões abertas: canal (e-mail? push? in-app?), opt-in por usuário,
agendamento (o `pg_cron` já existe para o sync), e deduplicação para não virar spam. Absorve o
item antigo "notificações push (pré-corte do palpite)". Inclui também avisar quando um jogo é
**adiado ou remarcado** — ficou explicitamente fora da spec 1.

## 6. Animações / "cara divertida"

Pedido do Thiago, deixado para o fim e fora da fila numerada. As specs 2 e 3 mudaram a estrutura
das telas de listagem e de ranking; agora que ambas estão escritas, animar deixou de ser
retrabalho garantido. O projeto já usa Framer Motion respeitando `prefers-reduced-motion`.

## Dívidas técnicas conhecidas (nenhuma é bug ativo)

- **`ranking()` devolve o geral para período inválido.** Com o regex estrito da 0027, uma string
  como `'2026-99'` não casa com nenhum ramo do `case` e cai no `else true`, que não filtra nada.
  Foi **avaliado e deixado de propósito**: a função devolve exatamente esse mesmo conjunto para
  qualquer usuário autenticado que passe `'geral'`, então o caminho não revela nada novo, e só é
  alcançável por SQL/MCP direto (o único call site da RPC é `listarRanking`, e os dois chamadores
  dela passam por `normalizarPeriodo` ou por constante). Correção, se um dia incomodar: ramo
  explícito para `'geral'` e `else false`.
- **`RateLimitError` engolido no loop de `transicoes`** do `sync-matches`
  (`supabase/functions/sync-matches/index.ts`, ~linha 347): um 429 ali faz o jogo ser gravado com
  o placar **cheio** e `decisao: 'normal'` — errado para mata-mata pela regra dos 90 minutos — e,
  com a trava anti-reversão da spec 1, isso **não** é mais sobrescrito depois. Candidato a spec
  própria. Pré-existente.
- **`matches.rodada` vazio no Brasileirão.** A API expõe o número no `tournament.name`
  (`"Serie A Betano - Round 21"`). Sem isso não há filtro por rodada.
- **Correção de horário em jogo já finalizado** seria lida como remarcação pela trava da spec 1,
  zerando o placar (e os pontos) até a varredura re-finalizar. Improvável, auto-curável em ≤15
  min, mas transitoriamente visível no ranking.
- **`app_config` é global.** `recalcular_pontos` escolhe o modelo pela **data do jogo** (corte
  04/07), não pela competição. O Brasileirão só recebe Modelo A (15/7/4/1) por coincidência de
  calendário. Ver memória `project_virada_modelo_sql_manual`.
- **Sem snapshot do campeão do mês.** Decisão explícita da spec 3: se um placar de mês fechado
  for corrigido, o campeão daquele mês muda retroativamente.
- **A regra de desempate está escrita em três lugares** que nada mantém em sincronia: o
  `order by` da `ranking()`, o filtro de `campeaoDoMes` e a prosa de `CRITERIOS_DESEMPATE`
  (ambos em `src/lib/ranking-shared.ts`). Comentários se referenciam; nenhum teste amarra.
- Varredura de pendências sem piso de data nem `.limit()`: jogo cujo `match_status` nunca resolve
  vira candidato permanente, 1 chamada de API por run para sempre.

## Referências úteis para retomar

- **Spec e plano do ranking mensal:**
  [docs/superpowers/specs/2026-08-01-ranking-mensal-design.md](docs/superpowers/specs/2026-08-01-ranking-mensal-design.md)
  e [docs/superpowers/plans/2026-08-01-ranking-mensal.md](docs/superpowers/plans/2026-08-01-ranking-mensal.md).
- **`.superpowers/sdd/2026-08-01-ranking-mensal/progress.md`** — o ledger da execução da spec 3:
  o que cada uma das 10 tasks entregou, os minors deferidos com a triagem da revisão final, e os
  rulings. **Preservado de propósito** porque a branch não foi integrada.
- **`.superpowers/sdd/2026-07-31-jogos-adiados/progress.md`** — o mesmo, para a spec 1.
  **Não apagar** antes da revisão do §3.
- Nota do vault: `D:\Obsidian\vault-thiago\Projetos\Pessoais\Cravou!.md` — o que **já foi feito e
  aprendido** (este arquivo é sobre o que **falta**). **Ainda não registra a spec 3**: o protocolo
  do `CLAUDE.md` manda registrar depois do push, que não aconteceu.
- `CLAUDE.md` / `AGENTS.md` — convenções: Next.js 16 com breaking changes (ler
  `node_modules/next/dist/docs/` antes de usar API do Next), fuso `America/Sao_Paulo`, TDD,
  trailer de commit.
- **Deploy do `sync-matches`:** MCP `deploy_edge_function`, 5 arquivos, `entrypoint_path:
  source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`, `_shared` um nível
  acima do entrypoint. Deno e Supabase CLI **não** estão instalados nesta máquina — migration se
  aplica por MCP `apply_migration`.
- **Disparar o sync manualmente:** `do $$ declare cmd text; begin select command into cmd from
  cron.job where jobid=1; execute cmd; end $$;` — e antes, para forçar,
  `delete from sync_cache where chave='ultimo_refresh';`.
- **IDs das competições:** Brasileirão `95c30703-b92b-4086-82b2-a8ccfc005d11`, Copa
  `44e62908-b9cb-4f67-9eff-0b7a1b6a800c`. **Brasileirão `fs_tournament_url`** =
  `/football/brazil/serie-a-betano/`.
