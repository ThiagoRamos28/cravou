# Suporte a Múltiplas Competições (Brasileirão Série A entra no bolão)

## Contexto

A Copa do Mundo 2026 terminou. Hoje volta o Brasileirão Série A, e a plataforma precisa
agregar uma **nova competição** com **ranking próprio, zerado**, mantendo as mesmas regras
de pontuação da Copa (Modelo A: 15/7/4/1, corte de 10 min).

Hoje o sistema é hardcoded para uma única competição: não existe tabela `competicoes`, o
`sync-matches` busca uma URL fixa da Flashscore (`FS_TOURNAMENT_URL`), e `app_config` é uma
tabela global de chave/valor sem noção de qual competição ela rege.

Esta spec cobre **apenas a base estrutural multi-competição** (schema, ranking, sync,
seletor de UI, opt-in de participação). Odds (1x2 / over 2.5 / BTTS) e "últimos 5 jogos
(V-E-D)" são funcionalidades separadas, tratadas em specs futuras — ficam **fora de
escopo** aqui.

---

## Design

### 1. Schema: `competicoes`

```sql
create table public.competicoes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- 'copa-mundo-2026', 'brasileirao-2026'
  nome text not null,                     -- 'Copa do Mundo 2026', 'Brasileirão Série A 2026'
  formato text not null default 'pontos-corridos'
    check (formato in ('fases', 'pontos-corridos')),
  ativa boolean not null default true,
  fs_tournament_url text,                 -- URL Flashscore usada pelo sync (substitui o secret fixo)
  ordem int not null default 0,           -- ordem de exibição no seletor
  created_at timestamptz not null default now()
);
```

- `formato = 'fases'`: competição com grupos + mata-mata (caso da Copa). Sync roda a
  detecção de stages atual.
- `formato = 'pontos-corridos'`: competição de rodadas simples (caso do Brasileirão).
  Sync usa `fase = 'pontos-corridos'` fixo e `rodada = <número da rodada>` vindo direto do
  endpoint de fixtures/results, sem detecção de stage.

`matches` ganha:

```sql
alter table public.matches add column competicao_id uuid references public.competicoes (id);
-- backfill: todos os jogos existentes apontam para a Copa
update public.matches set competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026');
alter table public.matches alter column competicao_id set not null;
create index matches_competicao_id_idx on public.matches (competicao_id);
```

Seed inicial:

```sql
insert into public.competicoes (slug, nome, formato, ativa, ordem) values
  ('copa-mundo-2026', 'Copa do Mundo 2026', 'fases', false, 1),
  ('brasileirao-2026', 'Brasileirão Série A 2026', 'pontos-corridos', true, 2);
```

(Copa marcada `ativa = false` pois terminou — não entra mais na sync automática, mas
continua consultável no ranking/histórico.)

### 2. `app_config` permanece global (decisão revisada — YAGNI)

**Nada muda em `app_config`.** O usuário confirmou que o Brasileirão usa **as mesmas
regras** da Copa (Modelo A: 15/7/4/1, corte 10 min). A função `recalcular_pontos`
(migration 0018) já escolhe o modelo **pela data do jogo**: tudo em/após `2026-07-04`
usa o `app_config` global vigente = 15/7/4/1. Como **todos os jogos do Brasileirão são
posteriores a 04/07**, eles já recebem o Modelo A automaticamente, sem qualquer alteração
em `app_config`, `recalcular_pontos`, o trigger ou `pontos_palpite`.

Tornar `app_config` por-competição agora quebraria os leitores existentes (`select valor
from app_config where chave='...'` sem filtro passaria a retornar múltiplas linhas → erro
"more than one row"). Fica **fora de escopo** — só se algum dia as competições precisarem
divergir. `palpite_aberto(match_id)` e `getMinutosCorte()` continuam lendo o
`minutos_corte` global, inalterados.

### 3. Participação opt-in

```sql
create table public.profiles_competicoes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  competicao_id uuid not null references public.competicoes (id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, competicao_id)
);
```

Sem linha = usuário **não participa** daquela competição (não aparece no ranking dela, e a
UI de palpites daquela competição fica bloqueada/avisa que precisa ativar primeiro). Nova
tela **"Minhas competições"** (`/perfil/competicoes` ou seção dentro do perfil existente)
lista as competições ativas com toggle ligar/desligar. Ativar uma competição faz upsert
`ativo = true`; desativar faz upsert `ativo = false` (não deleta, preserva palpites já
registrados — desativar só tira do ranking daquele momento em diante, pontos passados
continuam contando enquanto a linha existir, mas fora do ranking se `ativo = false`... na
prática: `ranking()` filtra `where pc.ativo = true`).

### 4. `ranking()` por competição

```sql
create or replace function public.ranking(p_competicao_id uuid, p_periodo text default 'geral')
returns table (...) -- mesmas colunas de hoje
language sql stable security definer set search_path = '' as $$
  select ...
  from public.profiles pr
  join public.profiles_competicoes pc
    on pc.user_id = pr.id and pc.competicao_id = p_competicao_id and pc.ativo = true
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m on m.id = p.match_id and m.competicao_id = p_competicao_id
  where case p_periodo
    when 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
    when 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;
```

- `p_competicao_id` é **obrigatório** (sem default) — força o chamador a sempre passar a
  competição, evita ranking "misturado" por engano.
- `p_periodo` (T1/T2/Geral) só faz sentido para competições `formato = 'fases'`. Para o
  Brasileirão a UI sempre chama com `p_periodo = 'geral'` e **não exibe** o sub-seletor de
  temporada (a spec `2026-07-04-ranking-temporadas.md`, ainda não implementada, é
  incorporada aqui como o comportamento da Copa dentro do novo seletor de competição).

### 5. Seletor de competição na UI

Novo componente `src/components/competicao/competicao-selector.tsx`, reutilizado em:
- `/palpites` — filtra jogos exibidos
- `/historico` — filtra jogos exibidos
- `/ranking` — filtra ranking (e, se Copa selecionada, mostra o sub-seletor T1/T2/Geral)
- `/regras` — mostra a tabela de pontuação da competição selecionada (hoje já lê de
  `app_config`; passa a filtrar por `competicao_id`)

Comportamento:
- Lista só competições com `ativa = true` **ou** onde o usuário tem
  `profiles_competicoes.ativo = true` (permite ver histórico/ranking de competições
  encerradas em que participou, como a Copa).
- Seleção persiste em **cookie** (`competicao`), lido no servidor para que as páginas
  (server components) já renderizem a competição certa sem flash nem round-trip. O
  seletor (client component) grava o cookie e chama `router.refresh()`.
- Default: primeira competição com `ativa = true` e maior `ordem` (Brasileirão).
- Se o usuário seleciona uma competição em que ainda não fez opt-in, a página de
  palpites mostra um card "Você ainda não está participando do Brasileirão — Ativar" em
  vez da lista de jogos.

### 6. `sync-matches` multi-competição

A Edge Function passa a:
1. Buscar `select id, slug, fs_tournament_url, formato from competicoes where ativa = true`.
2. Iterar cada competição, usando `fs_tournament_url` no lugar do secret
   `FS_TOURNAMENT_URL` fixo (o secret continua existindo só como fallback/config antiga,
   pode ser removido depois).
3. Para `formato = 'fases'`: mantém a lógica atual de detecção de stages
   (`tournament_stages`, filtro "Main"/mata-mata).
4. Para `formato = 'pontos-corridos'`: pula detecção de stage, usa
   `fase = 'pontos-corridos'` e lê o número da rodada direto do campo de rodada do
   endpoint de fixtures/results da Flashscore (a determinar o campo exato ao implementar —
   Flashscore normalmente expõe isso em `round`/`stage_name` dos fixtures).
5. Toda linha upsertada em `matches` grava `competicao_id` da competição da iteração
   atual. O cache (`sync_cache`, cuja PK é `chave text`) é namespaced **prefixando a
   chave** com o id/slug da competição (`${competicaoId}:tournament_stages`) — sem
   alteração de schema, já que a chave é texto livre.
6. Cron continua no mesmo intervalo — agora uma execução cobre todas as competições ativas
   em sequência (mesmo tratamento de 429/timeout já existente, por competição).

---

## Componentes afetados

### Novos
- `supabase/migrations/0019_competicoes.sql` — tabela `competicoes`, `matches.competicao_id`, seed
- `supabase/migrations/0020_profiles_competicoes.sql` — tabela de opt-in + opt-in retroativo Copa
- `supabase/migrations/0021_ranking_por_competicao.sql` — `ranking(p_competicao_id, p_periodo)`
- `src/lib/competicoes.ts` — tipo `Competicao`, `listarCompeticoes()`, `getCompeticaoAtiva(cookie)`, helper de cookie
- `src/components/competicao/competicao-selector.tsx` — client, grava cookie + `router.refresh()`
- `src/app/perfil/competicoes/page.tsx` + `actions.ts` — tela "Minhas competições" (opt-in)

### Modificados
- `supabase/functions/sync-matches/index.ts` — loop por competição, formato fases/pontos-corridos, cache com chave prefixada
- `src/lib/ranking.ts` — `listarRanking(competicaoId, periodo)` chama `ranking(p_competicao_id, p_periodo)`
- `src/lib/matches.ts` — `listarJogos` aceita `competicaoId` no filtro
- `src/app/ranking/page.tsx` + `actions.ts` + `src/components/ranking/ranking-content.tsx` — competição via cookie; `SeasonSelector` só quando `formato = 'fases'`
- `src/app/jogos/page.tsx` — filtra por competição; card de opt-in quando não participa
- `src/app/historico/page.tsx` — filtra por competição
- `src/app/regras/page.tsx` — nota de pontuação por competição selecionada (texto continua estático; só troca o rótulo Copa/Brasileirão)
- `src/components/site-header.tsx` — abriga o `CompeticaoSelector` e link "Minhas competições"

**Não alterados (decisão revisada):** `app_config`, `recalcular_pontos`, `pontos_palpite`, `palpite_aberto`, `getMinutosCorte` — modelo global por data já cobre o Brasileirão.

---

## Comportamento de casos extremos

- **Usuário nunca configurou nenhuma competição:** default é ficar fora de todas — ao
  acessar `/palpites` pela primeira vez após o deploy, sistema mostra prompt de opt-in
  para a competição ativa em vez de lista vazia.
- **Usuários que já palpitaram na Copa:** precisam de opt-in retroativo automático (migration
  faz `insert into profiles_competicoes` para todo `user_id` que já tem `predictions` em
  jogos da Copa, com `ativo = true`) — não pode sumir do ranking/histórico da Copa por
  causa da mudança.
- **Competição sem nenhum jogo sincronizado ainda:** `/palpites` mostra estado vazio
  ("Nenhum jogo agendado ainda").
- **Duas competições ativas ao mesmo tempo:** suportado nativamente pelo loop do sync;
  seletor lista ambas.

---

## Testes

- Migration: `ranking(competicao_copa, 'geral')` não inclui jogos do Brasileirão e vice-versa.
- Migration: usuário sem `profiles_competicoes.ativo = true` para uma competição não aparece no ranking dela.
- Migration: opt-in retroativo cobre todo usuário com predictions na Copa.
- `palpite_aberto` respeita `minutos_corte` da competição correta do jogo.
- Sync: rodar contra uma competição `formato = 'pontos-corridos'` fake/mock e confirmar `fase`/`rodada` gravados corretamente.
- UI: trocar seletor de competição atualiza jogos/ranking/histórico/regras.
- UI: opt-in/opt-out em "Minhas competições" reflete no ranking imediatamente.
- `npm test` e `npm run build` passam.

---

## Fora de escopo

- Odds (1x2, over 2.5, BTTS) na visualização dos jogos — spec futura.
- Últimos 5 jogos por equipe (V-E-D) — spec futura.
- Remover o secret `FS_TOURNAMENT_URL` (fica como legado até confirmar que `fs_tournament_url` da tabela cobre tudo).
- Implementação visual do sub-seletor T1/T2/Geral em si (spec `2026-07-04-ranking-temporadas.md` já existente) — aqui só definimos como ele se encaixa dentro do seletor de competição.

---

## Checklist de entrega

- [ ] Migration `competicoes` + `matches.competicao_id` + seed (Copa inativa, Brasileirão ativa)
- [ ] Migration `profiles_competicoes` + opt-in retroativo para participantes da Copa
- [ ] Migration `ranking(p_competicao_id, p_periodo)` + `listarRanking` atualizado
- [ ] `sync-matches` generalizado (loop por competição, formato fases/pontos-corridos, cache com chave prefixada)
- [ ] `CompeticaoSelector` (cookie + refresh) integrado no header
- [ ] `listarJogos`/páginas jogos, histórico, ranking, regras filtram por competição
- [ ] Tela "Minhas competições" (opt-in/opt-out)
- [ ] Sub-seletor T1/T2/Geral só aparece para competições `formato = 'fases'`
- [ ] `app_config`/`recalcular_pontos` **inalterados** (modelo global por data)
- [ ] Testes manuais: opt-in, troca de competição, ranking separado Copa×Brasileirão
- [ ] `npm test` passa
- [ ] `npm run build` passa
