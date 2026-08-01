# Próximos passos — Cravou!

Última atualização: **2026-07-31**, fim de sessão. Retomar em **2026-08-01**.

> **O pedido principal do Thiago ainda não foi feito: o RANKING POR MÊS.** Ele veio primeiro na
> conversa e acabou em terceiro na fila de specs. É o §1 abaixo e deve ser a primeira coisa
> amanhã.

## Estado atual

- **Spec 1 — jogos adiados/cancelados/órfãos:** ✅ mergeada em `master` (`84455c5`) e em
  produção. Edge function `sync-matches` **v28**. Migration **0025** aplicada.
- **Spec 2 — listagens (data, ordenação, paginação):** ✅ código completo na branch
  **`feat/listagens-jogos`** (6 commits, `b75e83e`..`b4e66d3`), 271 testes verdes, build e lint
  sem problema novo. **NÃO mergeada** — o Thiago pediu para segurar até a revisão final.
- **`master` tem 3 commits de docs não enviados** (`ecdea3a`, `369fa09`, `84ade22` — a spec e o
  plano das listagens). Só documentação; nada de código.
- **Spec 3 — ranking mensal:** ⬜ não iniciada. É o §1.
- **Spec 4 — alertas:** ⬜ não iniciada. §5.
- **Animações / "cara divertida":** ⬜ fora da fila, para o fim (§6).
- Branches antigas que sobraram no repo e podem ser apagadas: `feat/multi-competicao`,
  `feat/visual-ux-adjustments` (trabalho já mergeado há sessões).

---

## 1. RANKING POR MÊS do Brasileirão ← começar por aqui

O que o Thiago quer: além do ranking Geral, um ranking por mês. Não é bug, é feature nova.

### Por que é barato

A função SQL **já aceita o parâmetro**: `ranking(p_competicao_id uuid, p_periodo text default
'geral')`. Hoje o `case p_periodo` conhece só três valores:

```sql
where case p_periodo
  when 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
  when 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
  else true
end
```

Estender para períodos mensais (ex.: `p_periodo = '2026-08'`) é acrescentar um ramo que filtra
`m.inicio_em` pelo mês em BRT. Versão vigente: `supabase/migrations/0025_jogos_adiados.sql`.

⚠️ **Ao reescrever `ranking()`, preserve duas coisas** — cada uma conserta um bug real:
1. o pré-filtro de `predictions` via `exists` (migration **0024**), que impede pontos vazarem
   entre competições;
2. o `and mm.status <> 'cancelado'` dentro desse `exists` (migration **0025**).

### O achado que muda o desenho (levantado em 2026-07-31)

Distribuição real dos jogos do Brasileirão por mês:

| Mês | Jogos | Finalizados | Usuários com palpite |
|---|---|---|---|
| 2026-03 | 9 | 9 | **0** |
| 2026-04 | 50 | 50 | **0** |
| 2026-05 | 50 | 50 | **0** |
| 2026-07 | 160 | 149 | **7** |
| 2026-08 | 40 | 0 | 0 |
| 2026-09 | 30 | 0 | 0 |
| 2026-10 | 50 | 0 | 0 |

**O bolão só entrou no Brasileirão em julho.** Consequências para o design:

- O seletor de meses **não pode** listar "meses que têm jogo" — março, abril e maio têm jogo
  finalizado e **zero palpite**, então a galera abriria Março e veria um ranking vazio. Liste
  meses que têm **palpite** (ou jogo finalizado *e* palpite).
- **Junho não existe** na lista: os meses não são contíguos, o seletor não pode assumir
  sequência nem preencher buracos.
- Hoje, na prática, o ranking mensal de julho **é igual ao geral**, porque só julho tem palpite.
  O valor real aparece quando agosto fechar. Vale dizer isso ao Thiago para a expectativa não
  se descolar — a feature vai parecer "não fazer nada" no dia em que subir.

### Onde mexer no frontend

| Arquivo | O que é hoje |
|---|---|
| `src/lib/ranking.ts` | `listarRanking(competicaoId, periodo)`; o tipo `RankingPeriodo` só tem `"geral" \| "temporada_1" \| "temporada_2"` — precisa acomodar os meses |
| `src/components/ranking/season-selector.tsx` | `OPCOES` fixas com os 3 períodos + popover explicando os **dois modelos de pontuação da Copa** (conteúdo específico da Copa, não faz sentido no Brasileirão) |
| `src/components/ranking/ranking-content.tsx` | só renderiza o `SeasonSelector` quando `competicao.formato === "fases"` — por isso o Brasileirão hoje **não tem sub-seletor nenhum** |
| `src/app/ranking/page.tsx` | busca `listarRanking(atual.id, "geral")` e passa `key={atual.id}` ao `RankingContent` |

O sub-controle precisa ser **por formato**: `'fases'` (Copa) → T1/T2/Geral; `'pontos-corridos'`
(Brasileirão) → Geral + um por mês.

### Design vizinho, já acordado e nunca implementado

Na sessão de 2026-07-17 fechamos (sem implementar) o redesenho de **abas por competição na
própria página do ranking**: abas com as competições ativas, Copa numa seção discreta
"Temporadas anteriores", o T1/T2/Geral virando sub-controle só da Copa, e o seletor de
competição do header **oculto na rota `/ranking`** (wrapper client com `usePathname`). É
frontend puro — `buscarRanking(competicaoId, periodo)` já existe como server action.
**Desenhar as duas coisas juntas**, já que ambas mexem no mesmo sub-controle.

### Como começar

Brainstorming → spec em `docs/superpowers/specs/2026-08-01-ranking-mensal-design.md` → plano em
`docs/superpowers/plans/`. A tabela acima já responde a maior parte das perguntas de dados.

---

## 2. Mergear a spec 2 (`feat/listagens-jogos`)

Decisão do Thiago em 2026-07-31: **segurar o merge** até a revisão final. O código está pronto e
verificado (271 testes, build, lint sem novidade), só não foi revisado por outro agente.

Quando for mergear, seguir o que foi feito na spec 1: `git merge --no-ff`, rodar `npm test` **no
resultado mergeado**, e só então `git push origin master` (a Vercel deploya no push).

**Mudanças de comportamento que a galera vai notar** — vale avisar no grupo:
- O chip "Abertos" virou **"A fazer"**, e agora significa "não encerrados"
  (`status in ('agendado','ao_vivo')`): inclui jogo ao vivo e jogo aguardando resultado. De
  quebra fecha um buraco em que um jogo a 10 min do apito desaparecia da aba.
- O **resumo do `/historico` passou a refletir o filtro**: filtrar julho mostra os pontos de
  julho, não o total de sempre.

---

## 3. Revisão final das duas branches — não rodou

O **limite mensal de gasto da conta** derrubou os subagentes no fim da sessão de 31/07. Isso
atingiu:

- **Spec 1:** a revisão final da branch não aconteceu. Rodei testes, build e leitura manual do
  trecho sem cobertura, mas os *minors* adiados ao longo das 5 tasks **nunca foram triados por
  um revisor**. Lista completa em `.superpowers/sdd/2026-07-31-jogos-adiados/progress.md`
  (preservado de propósito — não apagar antes da revisão). Rodar sobre `213abcc..84455c5`.
- **Spec 2:** executada **inline**, sem o ciclo implementador → revisor. Três tropeços foram
  achados por mim durante a execução (tipo `Palpite` inventado onde o certo era `Prediction`,
  dois mocks faltando, asserção assumindo texto único num card que repete o nome do time).
  Rodar sobre `master..feat/listagens-jogos`.

Quando o limite renovar, essa é a primeira coisa depois do §1.

---

## 4. Fumaça visual em produção (spec 1)

Nunca feita ao vivo. Logado como **`thiagorc85@gmail.com`** (NÃO `informatica@disdal.com.br`,
que vem do bloco `# userEmail` e é de outro contexto), conferir:

- `/jogos` do Brasileirão **não** mostra os 4 jogos de 29/07 (Atlético-MG×Bragantino,
  Chapecoense×Vasco, São Paulo×Santos, Botafogo×Grêmio);
- `/admin` mostra os 4 com o selo **Adiado**;
- `/ranking` da Copa tem a final pontuada (ASVEZVEM +4, Luiz +1).

Login por **link mágico** via `agent-browser` — atenção ao **rate limit por hora** do Supabase
(vários envios seguidos travam com "Não foi possível enviar o link").

---

## 5. Alertas de jogo sem palpite (spec 4)

A maior das quatro: sistema novo, não ajuste. Avisar quem optar por receber que tem jogo perto do
corte e ainda sem palpite. Decisões abertas: canal (e-mail? push? in-app?), opt-in por usuário,
agendamento (o `pg_cron` já existe para o sync), e deduplicação para não virar spam. Absorve o
item antigo "notificações push (pré-corte do palpite)". Inclui também avisar quando um jogo é
**adiado ou remarcado** — ficou explicitamente fora da spec 1.

---

## 6. Animações / "cara divertida"

Pedido do Thiago, deixado deliberadamente para o fim e **fora da fila numerada**: as specs 2 e 3
mudam a estrutura das telas de listagem e ranking, e animar antes é retrabalho garantido. O
projeto já usa Framer Motion respeitando `prefers-reduced-motion`, então a base existe.

---

## Dívidas técnicas conhecidas (nenhuma é bug ativo)

- **`RateLimitError` engolido no loop de `transicoes`** do `sync-matches`
  (`supabase/functions/sync-matches/index.ts`, ~linha 347): um 429 ali faz o jogo ser gravado com
  o placar **cheio** e `decisao: 'normal'` — errado para mata-mata pela regra dos 90 minutos — e
  agora, com a trava anti-reversão da spec 1, isso **não é mais sobrescrito depois**. Candidato a
  spec própria. Pré-existente.
- **`matches.rodada` vazio no Brasileirão.** A API expõe o número no `tournament.name`
  (`"Serie A Betano - Round 21"`). Sem isso não há filtro por rodada — ficou fora da spec 2.
- **Correção de horário em jogo já finalizado** seria lida como remarcação pela trava da spec 1,
  zerando o placar (e os pontos) até a varredura re-finalizar. Improvável, auto-curável em ≤15
  min, mas transitoriamente visível no ranking.
- **`app_config` é global.** `recalcular_pontos` escolhe o modelo pela **data do jogo** (corte
  04/07), não pela competição. O Brasileirão só recebe Modelo A (15/7/4/1) por coincidência de
  calendário. Quando ele precisar divergir de regras, fazer spec de config **por competição**.
  Ver memória `project_virada_modelo_sql_manual`.
- Varredura de pendências sem piso de data nem `.limit()`: jogo cujo `match_status` nunca resolve
  vira candidato permanente, 1 chamada de API por run para sempre.

---

## Referências úteis para retomar

- `docs/superpowers/specs/` e `docs/superpowers/plans/` — specs e planos por data. Os de 31/07:
  `2026-07-31-jogos-adiados-*` e `2026-07-31-listagens-jogos*`.
- `.superpowers/sdd/2026-07-31-jogos-adiados/progress.md` — ledger da spec 1: minors adiados,
  riscos residuais e desvios de processo. **Não apagar** antes da revisão final.
- Nota do vault: `D:\Obsidian\vault-thiago\Projetos\Pessoais\Cravou!.md` — o que **já foi feito e
  aprendido** (este arquivo é sobre o que **falta**).
- `CLAUDE.md` / `AGENTS.md` — convenções: Next.js 16 com breaking changes (ler
  `node_modules/next/dist/docs/` antes de usar API do Next), fuso `America/Sao_Paulo`, TDD,
  trailer de commit.
- **Deploy do `sync-matches`:** MCP `deploy_edge_function`, 5 arquivos, `entrypoint_path:
  source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`, `_shared` um nível
  acima do entrypoint. Deno e Supabase CLI **não** estão instalados nesta máquina.
- **Disparar o sync manualmente:** `do $$ declare cmd text; begin select command into cmd from
  cron.job where jobid=1; execute cmd; end $$;` — e antes, para forçar,
  `delete from sync_cache where chave='ultimo_refresh';`.
- **Brasileirão `fs_tournament_url`** = `/football/brazil/serie-a-betano/` (path em inglês).
