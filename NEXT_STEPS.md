# Próximos passos — Cravou!

Última atualização: 2026-07-17 fim de sessão (branch `master` — tudo mergeado e deployado)

**Nesta sessão (pós-forma-recente):** corrigimos **dois bugs de ranking** relatados pelo
Thiago e limpamos a identidade da Copa. Antes: `feat/multi-competicao` (commit `fb8b86f`),
forma recente (`3d518e6`), sync-matches v27, migrations 0019–0024, bucket `escudos`. 228 testes
verdes + build ok.

- **BUG CORRIGIDO — ranking vazava entre competições** (commit `afc37ab`, migration **0024**
  aplicada em prod). O `/ranking` do Brasileirão mostrava 211 pts em 2 jogos porque
  `ranking(competicao)` somava Copa+Brasileirão no período `'geral'` (filtro no ON do LEFT JOIN
  não filtra os agregados de `predictions`). Corrigido com pré-filtro via `exists`; teste de
  regressão pgTAP em `supabase/tests/ranking_isolacao_competicao.test.sql` (3/3 ok). Ver
  memória `project_ranking_vazamento_competicao`.
- **BUG CORRIGIDO — trocar competição exigia F5** (commit `59c2f38`). `RankingContent` usava
  `useState(linhasIniciais)` que ignora novo valor inicial após montado. Fix: `key={atual.id}`
  remonta ao trocar competição.
- **Identidade neutralizada** (commit `59c2f38`): metadata, footer, hero e features não falam
  mais "Bolão da Copa" — agora é bolão de futebol multi-competição. Regras de mata-mata em
  `/regras` e no popover de temporadas ficaram (só aparecem no contexto da Copa arquivada).

> **Login de teste:** a conta certa do Cravou! é **`thiagorc85@gmail.com`** (NÃO
> `informatica@disdal.com.br`, que veio do bloco `# userEmail` e é de outro contexto). Login por
> **link mágico** via `agent-browser`, mas atenção ao **rate limit por hora** do Supabase (vários
> envios seguidos travam com "Não foi possível enviar o link"). Nesta sessão não deu pra verificar
> ao vivo por causa disso — o Thiago confirmou os fixes no próprio navegador logado.

## Estado atual

- **Multi-competição** (Copa arquivada + Brasileirão ativo): ✅ em prod. Seletor no header,
  ranking/jogos/histórico/regras por competição, opt-in em `/perfil/competicoes`, sync em loop.
  Brasileirão populado (221 jogos).
- **Escudos no Storage**: ✅ bucket público `escudos` + espelhamento inline no `sync-matches`.
  325 escudos servidos do nosso storage (FlashScore dá 403 em hotlink).
- **Odds nos jogos** (1ª spec futura): ✅ código completo + fix + `sync-matches` v27 deployado.
  Migration 0023 (`matches.odds jsonb`) aplicada. Ainda **sem dados de odds** em prod (só
  populam ~2h antes de um jogo) — falta só ver funcionando (§2).
- **Últimos 5 jogos por equipe (V-E-D)** (2ª spec futura): ✅ **concluída e deployada**.
  Forma calculada do nosso próprio banco (zero quota, sem migration, sem tocar no sync).
  Badges V/E/D com letra (acessível) + detalhe recolhível no card de jogos não finalizados.
  Spec `docs/superpowers/specs/2026-07-17-forma-recente-design.md`, plano
  `docs/superpowers/plans/2026-07-17-forma-recente.md`.
- **Palpites vazados no Brasileirão** (janela em que o site esteve quebrado): ✅ investigado.
  15 palpites de 3 usuários feitos antes do opt-in, mas todos com corte respeitado (sem
  vantagem) e os 3 acabaram entrando no Brasileirão. **Decisão: manter todos** — nada foi
  alterado no banco.

## 1. UX do ranking — abas por competição (opcional, era design, não bug)

**A dor central ("211 pts em 2 jogos") era o BUG de vazamento — já corrigido acima.** O que
sobra aqui é **polimento de UX**, não urgência. No brainstorm desta sessão fechamos um design
(não implementado):

- Abas por competição **na própria página** do ranking (estilo `FeedTabs`), com as competições
  **ativas**; Copa (arquivada) numa seção discreta "Temporadas anteriores".
- T1/T2/Geral vira **sub-controle** que só aparece quando a competição é a Copa (`formato='fases'`).
- Seletor de competição do header **oculto só na rota `/ranking`** (wrapper client com `usePathname`).
- **Escopo:** só o ranking, por ora (jogos/histórico/regras seguem com o seletor do header).
- É **frontend puro** — a server action `buscarRanking(competicaoId, periodo)` já existe.

Arquivos: `src/app/ranking/page.tsx`, `src/components/ranking/ranking-content.tsx`,
`src/components/ranking/season-selector.tsx`, `src/components/competicao/competicao-selector.tsx`.
Retomar via `superpowers:writing-plans` (o design já está acordado) → execução.

**Ideia relacionada (futura) — ranking MENSAL do Brasileirão:** além do Geral, um ranking por
mês (jan, fev, …). É o mesmo mecanismo do sub-seletor de temporada da Copa — a função
`ranking(p_competicao_id, p_periodo)` já aceita `p_periodo`; bastaria estender o `case` para
períodos mensais (filtrando `m.inicio_em` pelo mês) e o sub-controle da página oferecer
"Geral + um por mês" quando a competição é o Brasileirão (assim como oferece T1/T2/Geral para a
Copa). Encaixa naturalmente no redesenho de abas acima — desenhar junto.

## 2. Ver as odds funcionando na UI (demo)

Odds só populam ~2h antes de um jogo do Brasileirão (por design, quota-friendly). Para ver antes:
- Esperar um jogo entrar na janela de 2h e conferir `/jogos` (card mostra "ver odds" recolhível).
- OU semear um snapshot. Valores reais bet365 de `80AlZsl4` (Vitória×Vasco), já validados:
  `{casa 2.32, empate 3.0, fora 3.3, over25 2.05, under25 1.8, ambas_sim 1.8, ambas_nao 1.95,
  bookmaker bet365}`. **O UPDATE direto em `matches` foi bloqueado pelo classificador** (dado
  de produção) — precisa de autorização explícita do Thiago para semear.

## 3. Identidade multi-competição — rebrand completo (spec própria, futura)

Nesta sessão já **removemos as referências textuais à Copa** (metadata, footer, hero, features).
O que sobra é o rebrand mais profundo, se/quando quiser: ícone (hoje `Trophy` genérico), tom
visual, revisão da landing inteira para comunicar "plataforma de bolões" (não um evento único),
e talvez um nome/tagline definitivos. É trabalho de design/copy — fazer via
`superpowers:brainstorming` como projeto próprio.

## 4. Pontuação por competição — dívida técnica (backend, futura)

Hoje `app_config` é **global** e `recalcular_pontos` escolhe o modelo **pela data do jogo**
(corte 04/07). O Brasileirão só recebe Modelo A (15/7/4/1) porque todos os seus jogos são
pós-04/07 — **coincidência de calendário**, não isolamento real. Riscos: (a) impossível dar
regras diferentes por competição; (b) mexer em `/admin/config` reescreve o modelo de todas as
competições "atuais" e o trigger re-roda no sync (mecanismo que já corrompeu a T1 uma vez —
ver memória `project_virada_modelo_sql_manual`). **Não é bug ativo** (os rankings já não somam
entre si desde a 0024), mas quando o Brasileirão precisar divergir de regras, fazer spec de
`app_config` (ou tabela) **por competição** + `recalcular_pontos` escolhendo o modelo pela
COMPETIÇÃO, não pela data.

## 5. Fumaça visual do site publicado (opcional)

Ainda não feita visualmente — **login travou no rate limit por hora** do Supabase (ver aviso no
topo; conta certa é `thiagorc85@gmail.com`). Depois, abrir o site em produção e
conferir: header com **seletor de competição**; `/ranking` com dados; `/jogos` **não** mostra
Brasileirão pra quem não fez opt-in; e o novo bloco de **forma** aparecendo nos cards de jogos
agendados do Brasileirão (badges V/E/D + "ver forma"). Feito via automação de browser
(`agent-browser`). Login por **link mágico**: disparar em `/entrar` → aba "Link mágico" e o
Thiago cola o link recebido.

## 4. Encerramento (feito nesta sessão)

**Registrar a feature "forma recente" no Obsidian Vault** — ✅ FEITO. A nota
`Projetos/Pessoais/Cravou!.md` foi atualizada com a forma recente + backfill de
multi-competição, escudos e odds (que estavam faltando).

## Referências úteis para retomar

- `.superpowers/sdd/progress.md` — ledger detalhado (commits por task, decisões, notas).
- `docs/superpowers/specs/2026-07-16-odds-jogos-design.md` — spec das odds.
- `docs/superpowers/plans/2026-07-16-odds-jogos.md` — plano das odds (6 tasks).
- `docs/superpowers/specs/2026-07-17-forma-recente-design.md` + `docs/superpowers/plans/2026-07-17-forma-recente.md` — forma recente (✅ entregue).
- `docs/superpowers/specs/2026-07-16-multi-competicao.md` — spec multi-competição; seção "Fora
  de escopo" lista as specs futuras (odds ✅ e últimos 5 jogos ✅ — ambas concluídas).
- `scratchpad/build_deploy.py` — gera o payload de deploy do `sync-matches` a partir do disco.
- `CLAUDE.md` / `AGENTS.md` — convenções do projeto (Next.js 16 com breaking changes, fuso BRT).

## Notas de conhecimento (para não reaprender)

- **sync-matches deploy**: MCP `deploy_edge_function` (server `supabase-cravou`), 5 arquivos,
  `entrypoint_path: source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`,
  `_shared` um nível acima do entrypoint. Deno/CLI indisponíveis localmente — usar MCP.
- **Disparar o sync manualmente** (sem expor o secret): `do $$ declare cmd text; begin select
  command into cmd from cron.job where jobid=1; execute cmd; end $$;` — e antes, se quiser forçar,
  `delete from sync_cache where chave='ultimo_refresh';`.
- **Brasileirão fs_tournament_url** = `/football/brazil/serie-a-betano/` (path em inglês, não a
  URL .com.br).
