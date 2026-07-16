# Próximos passos — Cravou!

Última atualização: 2026-07-16 (branch `feat/multi-competicao`)

Tudo abaixo está na branch `feat/multi-competicao`, **ainda não mergeada** em `master`. O
merge foi combinado para só acontecer quando terminarmos as specs futuras (odds + últimos 5
jogos). Migrations e Edge Functions já foram aplicadas em produção via MCP (banco/edge estão
à frente do `master`).

## Estado atual

- **Multi-competição** (Copa arquivada + Brasileirão ativo): ✅ completo e validado em prod.
  12 tasks feitas (seletor no header, ranking/jogos/histórico/regras por competição, opt-in
  em `/perfil/competicoes`, sync em loop). Brasileirão populado (221 jogos). Migrations
  0019–0021 aplicadas.
- **Escudos no Storage**: ✅ bucket público `escudos` (migration 0022) + espelhamento inline
  no `sync-matches`. 325 escudos servidos do nosso storage (FlashScore dá 403 em hotlink).
- **Odds nos jogos** (1ª spec futura): ✅ código 100% (Tasks 1–6 + fix da revisão). Migration
  0023 (`matches.odds jsonb`) aplicada. Suíte 217 verde. **Falta redeploy do sync (ver §1) e
  demo de UI.**
- **Últimos 5 jogos por equipe (V-E-D)** (2ª spec futura): ❌ não iniciada.

## 1. Redeploy do `sync-matches` com o fix das odds (CRÍTICO, rápido)

A revisão final da feature de odds achou 1 bug Critical, já **corrigido no código** (commit
`ca9a807`): o upsert em lote do PostgREST zerava `odds` das linhas que não carregavam a chave
(união de chaves). Fix = carry-forward antes do upsert.

**Mas a Edge Function deployada (v26) ainda tem o bug.** Está dormente (nenhuma odds em prod
ainda; só populam ~2h antes de um jogo), mas precisa ser redeployada ANTES das odds irem ao ar.

- Como: MCP `deploy_edge_function` (server `supabase-cravou`), `name: sync-matches`,
  `entrypoint_path: source/index.ts`, `import_map_path: source/deno.json`, `verify_jwt: false`.
- 5 arquivos: `source/index.ts`, `_shared/fixtures.ts`, `_shared/escudos.ts`, `_shared/odds.ts`,
  `source/deno.json` (o `_shared` fica um nível acima do entrypoint).
- Gerar o payload sem transcrever à mão: rodar `scratchpad/build_deploy.py` (lê os arquivos do
  disco e monta o JSON) — mesmo processo usado nos deploys v25/v26.

## 2. Ver as odds funcionando na UI (demo)

As odds só populam naturalmente ~2h antes de um jogo do Brasileirão (por design, quota-friendly).
Para ver antes disso, duas opções:
- Esperar um jogo entrar na janela de 2h e conferir `/jogos` (o card mostra "ver odds" recolhível).
- Semear um snapshot num jogo para teste. Valores reais bet365 de `80AlZsl4` (Vitória×Vasco),
  já validados contra o payload real: `{casa 2.32, empate 3.0, fora 3.3, over25 2.05,
  under25 1.8, ambas_sim 1.8, ambas_nao 1.95, bookmaker bet365}`. **Obs:** o UPDATE direto em
  `matches` foi bloqueado pelo classificador (dado de produção que usuários veem) — requer
  autorização explícita do Thiago para semear.

## 3. Segunda spec futura — "Últimos 5 jogos por equipe (V-E-D)"

Ainda não desenhada. Seguir o mesmo fluxo das odds: `superpowers:brainstorming` → spec em
`docs/superpowers/specs/` → `superpowers:writing-plans` → execução subagent-driven. A FlashScore
tem endpoints de forma/resultados por time (ver ferramentas MCP `Get_Team_Results` /
`Get_Match_Standings_Form`) — a decisão de arquitetura (de onde puxar a forma, como armazenar,
custo de quota) está toda em aberto.

## 4. Merge final

Quando odds + últimos 5 jogos estiverem prontos: `superpowers:finishing-a-development-branch`
→ push para `master` (Vercel faz deploy automático) → registrar no Obsidian Vault
(`registrar-no-vault`). Rodar `npm test` e `npm run build` antes.

## Referências úteis para retomar

- `.superpowers/sdd/progress.md` — ledger detalhado (commits por task, decisões, notas).
- `docs/superpowers/specs/2026-07-16-odds-jogos-design.md` — spec das odds.
- `docs/superpowers/plans/2026-07-16-odds-jogos.md` — plano das odds (6 tasks).
- `docs/superpowers/specs/2026-07-16-multi-competicao.md` — spec multi-competição; seção "Fora
  de escopo" lista as specs futuras (odds ✅ em andamento, últimos 5 jogos pendente).
- `scratchpad/build_deploy.py` — gera o payload de deploy do `sync-matches` a partir dos
  arquivos do disco.
- `CLAUDE.md` / `AGENTS.md` — convenções do projeto (Next.js 16 com breaking changes, fuso BRT,
  regras de negócio).
