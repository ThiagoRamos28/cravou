# Próximos passos — Cravou!

Última atualização: 2026-07-17 fim de sessão (branch `master` — tudo mergeado e deployado)

**Feature "forma recente" (2ª spec futura) CONCLUÍDA e mergeada em `master` (commit `3d518e6`,
push `1b9eebc..3d518e6`) — a Vercel deploya automático.** 228 testes verdes + build ok.
Antes disso, a `feat/multi-competicao` já estava em prod (commit `fb8b86f`), sync-matches v27,
migrations 0019–0023 e bucket `escudos`.

> ⚠️ **Novo trabalho identificado (prioridade da próxima sessão): a UX do `/ranking` ficou
> confusa depois da adição da nova competição.** É o item §1 abaixo — provavelmente precisa de
> `superpowers:brainstorming` antes de mexer. Ainda **não diagnosticado ao vivo**: a fumaça
> visual parou porque o login de teste foi feito com a **conta errada** (usei
> `informatica@disdal.com.br`, tirado do bloco `# userEmail` do contexto — NÃO é
> necessariamente a conta do Cravou!). Próxima sessão: confirmar com o Thiago qual conta usar
> antes de logar em produção.

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

## 1. Redesenhar a UX do ranking com múltiplas competições (PRIORIDADE)

**Problema relatado pelo Thiago:** com a nova competição (Brasileirão) somada à Copa, a
experiência do `/ranking` **ficou confusa**. Não chegamos a olhar ao vivo (bloqueado pela
conta errada — ver aviso no topo), então o diagnóstico ainda está aberto.

Pontos de partida para investigar (ler o código antes de propor):
- `src/app/ranking/page.tsx` + `src/app/ranking/actions.ts`
- `src/components/ranking/ranking-content.tsx` — orquestra período + skeleton + estado vazio
- `src/components/ranking/*` — `SeasonSelector` (T1/T2/Geral, só para `formato='fases'`),
  colunas, lista mobile
- `src/components/competicao/competicao-selector.tsx` — seletor de competição (cookie)
- Hipótese a validar: a combinação **seletor de competição** (no header) + **sub-seletor de
  temporada T1/T2/Geral** (dentro do ranking, só para a Copa) cria dois níveis de filtro que
  se confundem; para o Brasileirão o sub-seletor some, mudando o layout entre competições.

Fluxo sugerido: `superpowers:brainstorming` (entender o que está confuso, com o Thiago olhando
a tela junto — talvez usar o companion visual) → spec em `docs/superpowers/specs/` → plano →
execução. **Não** partir direto para código; é problema de design de UX, não de bug.

## 2. Ver as odds funcionando na UI (demo)

Odds só populam ~2h antes de um jogo do Brasileirão (por design, quota-friendly). Para ver antes:
- Esperar um jogo entrar na janela de 2h e conferir `/jogos` (card mostra "ver odds" recolhível).
- OU semear um snapshot. Valores reais bet365 de `80AlZsl4` (Vitória×Vasco), já validados:
  `{casa 2.32, empate 3.0, fora 3.3, over25 2.05, under25 1.8, ambas_sim 1.8, ambas_nao 1.95,
  bookmaker bet365}`. **O UPDATE direto em `matches` foi bloqueado pelo classificador** (dado
  de produção) — precisa de autorização explícita do Thiago para semear.

## 3. Fumaça visual do site publicado (opcional)

Ainda não feita visualmente — **login travou na conta errada** (ver aviso no topo; confirmar
com o Thiago a conta certa do Cravou! antes de logar). Depois, abrir o site em produção e
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
