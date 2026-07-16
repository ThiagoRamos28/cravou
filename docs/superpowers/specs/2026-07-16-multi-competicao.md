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

### 2. `app_config` por competição

```sql
alter table public.app_config drop constraint app_config_pkey;
alter table public.app_config add column competicao_id uuid references public.competicoes (id);
alter table public.app_config add primary key (competicao_id, chave);
```

Linhas existentes (`minutos_corte`, `pts_placar_exato`, `pts_resultado`, e as chaves do
Modelo A já usadas pela T2 — `pts_saldo`, `pts_time_marca`, conforme migration 0018) são
copiadas para a Copa e duplicadas com os mesmos valores para o Brasileirão (mesma regra,
"mesmas regras" conforme pedido). `palpite_aberto(match_id)` passa a resolver
`competicao_id` a partir do próprio `match_id` (join com `matches`) em vez de ler
`app_config` sem filtro.

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
- Seleção persiste em `localStorage` (`competicao_selecionada`), não em URL — mesma
  decisão já tomada para o sub-filtro de temporada.
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
   atual. Cache de IDs (`0015_sync_cache.sql`) passa a ser namespaced por `competicao_id`
   para não colidir entre competições.
6. Cron continua no mesmo intervalo — agora uma execução cobre todas as competições ativas
   em sequência (mesmo tratamento de 429/timeout já existente, por competição).

---

## Componentes afetados

### Novos
- `supabase/migrations/0019_competicoes.sql` — tabela `competicoes`, `matches.competicao_id`, seed
- `supabase/migrations/0020_app_config_por_competicao.sql` — `app_config.competicao_id`, `palpite_aberto` atualizado
- `supabase/migrations/0021_profiles_competicoes.sql` — tabela de opt-in
- `supabase/migrations/0022_ranking_por_competicao.sql` — `ranking(p_competicao_id, p_periodo)`
- `src/components/competicao/competicao-selector.tsx`
- `src/app/perfil/competicoes/page.tsx` (ou seção equivalente) — tela "Minhas competições"

### Modificados
- `supabase/functions/sync-matches/index.ts` — loop por competição
- `supabase/migrations/0015_sync_cache.sql` (ou nova migration) — cache namespaced por competição
- `src/app/palpites/page.tsx`, `src/app/historico/page.tsx`, `src/app/ranking/page.tsx`, `src/app/regras/page.tsx` — integram o seletor
- `src/components/ranking/season-selector.tsx` (da spec 04/07, a implementar) — passa a viver dentro do fluxo de competição, só visível quando `formato = 'fases'`

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
- [ ] Migration `app_config.competicao_id` + `palpite_aberto` atualizado + seed dos valores por competição
- [ ] Migration `profiles_competicoes` + opt-in retroativo para participantes da Copa
- [ ] Migration `ranking(p_competicao_id, p_periodo)`
- [ ] `sync-matches` generalizado (loop por competição, formato fases/pontos-corridos, cache namespaced)
- [ ] `CompeticaoSelector` implementado e integrado em palpites/histórico/ranking/regras
- [ ] Tela "Minhas competições" (opt-in/opt-out)
- [ ] Sub-seletor T1/T2/Geral só aparece para competições `formato = 'fases'`
- [ ] Testes manuais: opt-in, troca de competição, corte de palpite por competição
- [ ] `npm test` passa
- [ ] `npm run build` passa
