# Próximos passos — Cravou!

Última atualização: 2026-07-16 noite (branch `master` — já mergeado e deployado)

**A `feat/multi-competicao` foi MERGEADA em `master` (commit `fb8b86f`) e pushada — a Vercel
deploya automático.** O sync-matches foi redeployado (v27, com o fix das odds). Migrations
0019–0023 e o bucket `escudos` já estão em produção. O merge foi feito porque produção estava
num estado quebrado (banco à frente do código antigo). Retomar à noite.

## Estado atual

- **Multi-competição** (Copa arquivada + Brasileirão ativo): ✅ em prod. Seletor no header,
  ranking/jogos/histórico/regras por competição, opt-in em `/perfil/competicoes`, sync em loop.
  Brasileirão populado (221 jogos).
- **Escudos no Storage**: ✅ bucket público `escudos` + espelhamento inline no `sync-matches`.
  325 escudos servidos do nosso storage (FlashScore dá 403 em hotlink).
- **Odds nos jogos** (1ª spec futura): ✅ código completo + fix + `sync-matches` v27 deployado.
  Migration 0023 (`matches.odds jsonb`) aplicada. Ainda **sem dados de odds** em prod (só
  populam ~2h antes de um jogo) — falta só ver funcionando (§2).
- **Últimos 5 jogos por equipe (V-E-D)** (2ª spec futura): ❌ não iniciada.

## 1. Fumaça no site publicado + checar palpites vazados (PRIMEIRO)

Assim que o deploy da Vercel terminar, abrir o site em produção e conferir:
- Header mostra o **seletor de competição**.
- `/ranking` voltou a mostrar dados (não mais vazio).
- `/jogos` **não** mostra o Brasileirão para quem não fez opt-in em "Minhas competições".

Depois, **checar se algum usuário palpitou em jogo do Brasileirão** na janela em que o site
ficou quebrado (código antigo mostrava todos os jogos na home). Query de leitura:

```sql
select p.user_id, count(*)
from predictions p
join matches m on m.id = p.match_id
where m.competicao_id = (select id from competicoes where slug='brasileirao-2026')
group by p.user_id;
```
Se houver, decidir limpeza (esses palpites não deviam existir antes do opt-in).

## 2. Ver as odds funcionando na UI (demo)

Odds só populam ~2h antes de um jogo do Brasileirão (por design, quota-friendly). Para ver antes:
- Esperar um jogo entrar na janela de 2h e conferir `/jogos` (card mostra "ver odds" recolhível).
- OU semear um snapshot. Valores reais bet365 de `80AlZsl4` (Vitória×Vasco), já validados:
  `{casa 2.32, empate 3.0, fora 3.3, over25 2.05, under25 1.8, ambas_sim 1.8, ambas_nao 1.95,
  bookmaker bet365}`. **O UPDATE direto em `matches` foi bloqueado pelo classificador** (dado
  de produção) — precisa de autorização explícita do Thiago para semear.

## 3. Segunda spec futura — "Últimos 5 jogos por equipe (V-E-D)"

Ainda não desenhada. Fluxo: `superpowers:brainstorming` → spec em `docs/superpowers/specs/` →
`superpowers:writing-plans` → execução subagent-driven. A FlashScore tem endpoints de forma/
resultados por time (ferramentas MCP `Get_Team_Results` / `Get_Match_Standings_Form`) — a
decisão de arquitetura (de onde puxar a forma, como armazenar, custo de quota) está em aberto.

## 4. Encerramento

Ao concluir a 2ª spec: rodar `npm test` + `npm run build`, e **registrar no Obsidian Vault**
(`registrar-no-vault`) — protocolo de encerramento do projeto documenta o que foi entregue.

## Referências úteis para retomar

- `.superpowers/sdd/progress.md` — ledger detalhado (commits por task, decisões, notas).
- `docs/superpowers/specs/2026-07-16-odds-jogos-design.md` — spec das odds.
- `docs/superpowers/plans/2026-07-16-odds-jogos.md` — plano das odds (6 tasks).
- `docs/superpowers/specs/2026-07-16-multi-competicao.md` — spec multi-competição; seção "Fora
  de escopo" lista as specs futuras (odds ✅ feita, últimos 5 jogos pendente).
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
