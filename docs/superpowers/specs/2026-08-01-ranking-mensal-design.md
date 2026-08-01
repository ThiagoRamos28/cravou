# Ranking mensal + abas de competição na /ranking

**Data:** 2026-08-01
**Status:** aprovado, aguardando plano de implementação

## Problema

O `/ranking` do Brasileirão hoje é uma tabela só: a classificação acumulada da competição
inteira. Num campeonato de pontos corridos que vai de março a dezembro, isso significa que quem
entrou atrasado ou teve um mês ruim nunca mais alcança — e a disputa morre.

O Thiago pediu um **ranking por mês**: cada mês vira uma disputa própria, com campeão.

Junto vem um redesenho vizinho, acordado em 2026-07-17 e nunca implementado: as competições
viram **abas na própria página** do ranking, e o seletor de competição do header some em
`/ranking`. Os dois mexem no mesmo sub-controle da página; fazer separado é retrabalho.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Natureza do ranking mensal | **Disputa própria**, com campeão do mês — não só um filtro |
| Quando o mês fecha | Quando **nenhum jogo do mês está pendente** |
| Onde o campeão aparece | **Só numa faixa no topo da `/ranking`** — sem galeria, sem troféu no perfil, sem post no feed |
| Meses listados | Os que **têm ao menos um palpite**, mais o **mês corrente** se ele tiver jogo |
| Período padrão ao abrir | **Mês corrente** (formato `pontos-corridos`); `geral` na Copa |
| Abas de competição | **Entram nesta spec**, com o seletor do header oculto em `/ranking` |
| Lista de meses e estado "fechado" | Nova função SQL `ranking_meses()` — não agregação em TypeScript |
| Troca de aba | Escreve o cookie + `router.refresh()`, igual ao seletor do header |

## Os dados de hoje

Levantados em 2026-08-01 (a tabela equivalente no `NEXT_STEPS.md` estava inflada pelo join com
`predictions` — estes são os números corretos):

| Competição | Mês | Jogos | Finalizados | Usuários c/ palpite |
|---|---|---|---|---|
| Brasileirão | 2026-03 | 9 | 9 | **0** |
| Brasileirão | 2026-04 | 50 | 50 | **0** |
| Brasileirão | 2026-05 | 50 | 50 | **0** |
| Brasileirão | 2026-07 | 32 | 28 (+4 adiados) | 7 |
| Brasileirão | 2026-08 | 40 | 0 | 0 |
| Brasileirão | 2026-09 | 30 | 0 | 0 |
| Brasileirão | 2026-10 | 50 | 0 | 0 |
| Copa | 2026-06 | 79 | 79 | 11 |
| Copa | 2026-07 | 25 | 25 | 12 |

**O bolão só entrou no Brasileirão em julho.** Daí duas regras do design:

- O seletor **não pode** listar "meses que têm jogo": março, abril e maio têm jogo finalizado e
  zero palpite, e abrir Março mostraria uma tabela vazia sem explicação.
- **Junho não existe** no Brasileirão. Os meses não são contíguos; nada no código pode assumir
  sequência nem preencher buracos.

Competições no banco: `copa-mundo-2026` (formato `fases`, `ativa = false`, ordem 1) e
`brasileirao-2026` (formato `pontos-corridos`, `ativa = true`, ordem 2).

## Camada de dados

### Migration `0026_ranking_mensal.sql`

**1. `ranking(p_competicao_id, p_periodo)` ganha o ramo mensal.**

O `case p_periodo when ...` (forma simples) vira `case when ...` (forma pesquisada), porque a
comparação por regex não cabe na forma simples:

```sql
where case
  when p_periodo = 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
  when p_periodo = 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
  when p_periodo ~ '^\d{4}-\d{2}$' then
    to_char(m.inicio_em at time zone 'America/Sao_Paulo', 'YYYY-MM') = p_periodo
  else true
end
```

Todo o resto do corpo é copiado da **0025 sem alteração**. Dois trechos são consertos de bugs
reais e **não podem ser perdidos na reescrita**:

1. o pré-filtro de `predictions` via `exists` (migration **0024**), que impede pontos de vazarem
   entre competições — filtro no `ON` de `LEFT JOIN` não filtra os agregados;
2. o `and mm.status <> 'cancelado'` dentro desse `exists` (migration **0025**).

**Comportamento intencional:** num período mensal, quem não palpitou naquele mês **não aparece**
na tabela. O `left join` deixa `m.inicio_em` nulo, a comparação vira `NULL` e a linha cai. É
exatamente o que `temporada_1`/`temporada_2` já fazem hoje, e para uma disputa mensal é o certo:
quem não jogou não entra na disputa. No `geral` a pessoa continua aparecendo com 0 pontos.

**2. Nova função `ranking_meses(p_competicao_id uuid)`.**

Retorna `mes text, jogos bigint, pendentes bigint, palpites bigint, fechado boolean`:

```sql
create or replace function public.ranking_meses(p_competicao_id uuid)
returns table (mes text, jogos bigint, pendentes bigint, palpites bigint, fechado boolean)
language sql stable security definer set search_path = '' as $$
  with jogos as (
    select to_char(m.inicio_em at time zone 'America/Sao_Paulo','YYYY-MM') as mes,
           m.id,
           (m.status in ('agendado','ao_vivo')
            or (m.status = 'finalizado' and exists (
                  select 1 from public.predictions p
                   where p.match_id = m.id and p.pontos is null))) as pendente
      from public.matches m
     where m.competicao_id = p_competicao_id
       and m.status <> 'cancelado'
  ), palpites as (
    select j.mes, count(p.id) as total
      from jogos j
      join public.predictions p on p.match_id = j.id
     group by j.mes
  )
  select j.mes,
         count(*)::bigint,
         count(*) filter (where j.pendente)::bigint,
         coalesce(pl.total, 0)::bigint,
         count(*) filter (where j.pendente) = 0
    from jogos j
    left join palpites pl on pl.mes = j.mes
   group by j.mes, pl.total
   order by j.mes;
$$;

revoke execute on function public.ranking_meses(uuid) from public, anon;
grant  execute on function public.ranking_meses(uuid) to authenticated;
```

Regra de `fechado`: **nenhum jogo do mês pendente**.

- `adiado` e `cancelado` contam como **resolvidos**. Senão um adiamento sem data nova seguraria o
  mês aberto para sempre.
- A segunda condição (`finalizado` com palpite sem `pontos`) evita anunciar campeão na janela
  entre a sync finalizar o jogo e o `recalcular_pontos` rodar.
- Jogos cancelados ficam fora de todas as contagens, coerente com o que a `ranking()` faz.

Conferindo com os dados de hoje: julho tem 32 jogos, 28 finalizados e 4 adiados, nenhum pendente
→ **julho fecha, com campeão**. Agosto tem 40 agendados → aberto.

### `src/lib/ranking-shared.ts` (novo)

`lib/ranking.ts` importa `@/lib/supabase/server`, então componentes client não podem importar
dele. É o mesmo motivo que fez existir o `competicoes-shared.ts`, e a spec segue o precedente:
os tipos e as funções puras mudam para um módulo sem dependência de servidor, e `lib/ranking.ts`
re-exporta o que já exportava (nenhum import existente quebra).

Conteúdo: os tipos `RankingRow`, `RankingPeriodo`, `MesRanking` e quatro funções puras.

| Função | Regra |
|---|---|
| `mesCorrenteBRT(agora: Date): string` | `YYYY-MM` no fuso `America/Sao_Paulo` |
| `mesesVisiveis(meses, mesCorrente): MesRanking[]` | mantém quem tem `palpites > 0` **ou** é o mês corrente; ordena do mais recente para o mais antigo. Só filtra — nunca inventa um mês que não veio do banco, então um mês corrente sem jogo nenhum (junho, no Brasileirão) simplesmente não aparece |
| `rotuloMes(mes, anoCorrente): string` | `"Agosto"` dentro do ano corrente, `"Dezembro/2025"` fora dele |
| `campeaoDoMes(linhas): Campeao \| null` | `null` se a lista está vazia ou o topo tem 0 pontos; senão todos que empatam com a linha 1 em **pontos e cravadas** |

`campeaoDoMes` reusa o desempate que a própria `ranking()` já aplica (`order by pontos desc,
cravadas desc`): dois usuários com os mesmos pontos mas cravadas diferentes **não** são
co-campeões — quem cravou mais ganha. Empate só quando os dois números batem.

`RankingPeriodo` passa a aceitar meses. A garantia real é o **regex em runtime**
(`/^\d{4}-(0[1-9]|1[0-2])$/`), usado na validação do server action; o tipo TypeScript é
conveniência. Se o template literal type não compilar de forma limpa, `string` com o guard é
aceitável — o regex é a fronteira.

### `src/lib/ranking.ts`

Mantém os fetchers e re-exporta o módulo shared. Ganha:

```ts
export async function listarMesesRanking(competicaoId: string): Promise<MesRanking[]>
```

RPC `ranking_meses`, falha aberta com `[]`, igual a `listarRanking`.

## Camada de UI

```
src/app/ranking/page.tsx            (server)
 └ RankingContent                   (client)
    ├ CompeticaoTabs                ← novo
    ├ SeasonSelector                ← só formato 'fases' (inalterado)
    ├ MesSelector                   ← novo, só formato 'pontos-corridos'
    ├ FaixaCampeao                  ← novo, só quando o período é um mês
    └ Podium + RankingTable + RankingListaMobile   (inalterados)
```

### `page.tsx`

Além do que já faz: busca `listarMesesRanking(atual.id)` quando o formato é `pontos-corridos`,
aplica `mesesVisiveis`, decide o período inicial e busca o ranking **desse** período.

Período inicial:

- `pontos-corridos` → o mês corrente, **se** ele estiver na lista visível; senão `"geral"`;
- `fases` → `"geral"`, como hoje.

### `CompeticaoTabs` (novo, client)

Abas com as competições **ativas** visíveis. As inativas ficam numa linha discreta abaixo,
rotulada **"Temporadas anteriores"** — é onde a Copa vive hoje.

- Trocar de aba escreve o cookie `COOKIE_COMPETICAO` e chama `router.refresh()`, exatamente como
  o `CompeticaoSelector` do header faz. A escolha gruda no reload e o resto do app fica coerente.
- Uma competição visível no total → não renderiza nada.
- Nenhuma competição **ativa** visível → todas viram abas (senão um usuário com opt-in só na Copa
  ficaria sem controle nenhum).
- Trocar de aba reseta o período para o padrão da competição nova. Correto: os períodos de uma
  competição não existem na outra.

### `MesSelector` (novo, client)

Mesmo formato visual do `SeasonSelector` — label "Ver ranking de:" + `<select>` — com *Ranking
Geral* seguido dos meses, do mais recente para o mais antigo.

**Sem o botão de info.** O popover do `SeasonSelector` explica os dois modelos de pontuação da
Copa; no Brasileirão ele não faz sentido. `SeasonSelector` fica inalterado.

Se a lista de meses vier vazia, não renderiza.

### `FaixaCampeao` (novo)

Acima do pódio, só quando o período selecionado é um mês. Ícone de troféu do lucide — nunca
emoji. Quatro estados:

| Situação | Texto |
|---|---|
| Mês fechado, com campeão | **Campeão de Julho** — Fulano · 87 pts |
| Mês fechado, empate no topo | **Campeões de Julho** — Fulano e Beltrano · 87 pts |
| Mês em andamento, alguém pontuou | **Agosto em disputa** — liderança de Fulano · 12 pts |
| Mês em andamento, ninguém pontuou | **Agosto em disputa** — ninguém pontuou ainda |
| Mês fechado e ninguém pontuou | não renderiza — mês sem campeão não ganha faixa anunciando isso |

Fica oculta enquanto o ranking recarrega (o `RankingContent` já tem estado `carregando`).

O campeão sai da **linha 1 do ranking que a página já buscou** — nenhuma query adicional.

### Estado vazio

Hoje: *"Nenhum palpite pontuado neste período ainda."* Em período mensal passa a *"Ninguém
palpitou em Agosto ainda."*

Isso importa mais do que parece: com o padrão em mês corrente, **é a primeira tela que a galera
vê hoje, 1º/08**, quando agosto ainda não tem palpite nenhum.

### Header

`CompeticaoSelectorSlot` — wrapper client com `usePathname()` que devolve `null` em `/ranking` e
o `CompeticaoSelector` de sempre nas outras rotas. `site-header.tsx` passa a renderizar o slot.

### `src/app/ranking/actions.ts`

A whitelist de três valores passa a aceitar também `/^\d{4}-(0[1-9]|1[0-2])$/`. Qualquer outra
coisa cai em `"geral"`. O `p_periodo` já vai como parâmetro de RPC (não concatenado), então não
há injeção — a validação é higiene.

## Testes

**Puros** — `src/lib/__tests__/ranking-shared.test.ts`: as quatro funções, incluindo os casos que
os dados reais expõem (mês com jogo e zero palpite sai da lista; mês corrente sem palpite fica;
meses não contíguos; empate em pontos com cravadas diferentes **não** é co-campeonato).

**Componentes** — um arquivo por componente novo (`MesSelector`, `FaixaCampeao` nos quatro
estados, `CompeticaoTabs` incluindo os dois casos de borda, `CompeticaoSelectorSlot` nos dois
pathnames), mais `ranking-content.test.tsx` estendido para cobrir "o formato decide o
sub-controle".

**SQL** — o projeto não tem harness de teste para migrations. Verificação por queries de
conferência via MCP depois de aplicar: julho fecha; o ranking de julho bate com o geral (hoje são
iguais, porque só julho tem palpite); março, abril e maio ficam fora da lista visível; a
`ranking()` no `geral` devolve exatamente os mesmos números de antes da migration.

## Limites aceitos

1. **Sem snapshot do campeão.** Decisão explícita. Se um placar de mês fechado for corrigido, o
   campeão daquele mês muda retroativamente. Se isso incomodar, vira spec própria (tabela de
   campeões + job de congelamento).
2. **Jogo adiado carrega o palpite junto.** Quando os 4 jogos de 29/07 forem remarcados para
   agosto, o `inicio_em` muda e eles migram do balde de julho para o de agosto. Não mexe em
   pontos (estão sem pontuar), mas muda o aproveitamento exibido nos dois meses.
3. **A feature vai parecer não fazer nada no dia em que subir.** Só julho tem palpite, então o
   ranking mensal de julho é idêntico ao Geral. O valor aparece quando agosto tiver jogo
   pontuado.

## Fora de escopo

- Galeria de campeões, troféu no perfil, post automático no feed quando o mês fecha.
- Ranking mensal na Copa: o formato `fases` continua com Geral / Temporada 1 / Temporada 2.
- Fechamento manual pelo admin.
- Filtro por rodada — depende de `matches.rodada`, que está vazio no Brasileirão (dívida
  conhecida no `NEXT_STEPS.md`).
