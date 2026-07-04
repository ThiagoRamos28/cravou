# Virada do Modelo de Pontuação (Modelo A, 2026-07-04) — sem quebrar ranking/regras

## Contexto

Em 2026-07-02 foi decidido (`docs/superpowers/specs/2026-06-30-modelos-pontuacao.md`)
adotar o **Modelo A "Cravou Manda"** (15/7/4/1 em vez de 10/7/5/2), valendo só para jogos
finalizados a partir de **2026-07-04**, **sem recálculo retroativo** do histórico da fase de
grupos. A execução é manual via SQL direto em `app_config` (nunca pela tela `/admin/config`,
que dispara `recalcular_todos()` e reescreveria o histórico).

Essa parte mecânica já está pronta (SQL documentado na spec). O que falta — e é o motivo
deste plano — é que **três lugares do código assumem os valores antigos (10/7/5/2) como fixos**
e vão ficar incorretos ou enganosos assim que a virada acontecer:

1. `public.ranking()` (`supabase/migrations/0006_pontuacao_ranking.sql`) conta `cravadas`
   comparando `p.pontos` ao valor **atual** de `pts_placar_exato` em `app_config`. Depois da
   virada isso vale 15 — então todo "Cravou!" da fase de grupos (que ganhou 10 pts, valor da
   época) deixa de ser contado como cravada no ranking. Retroativamente errado.
2. `ranking-table.tsx` calcula "Aproveitamento" como `pontos / (palpites_pontuados * 10)`,
   hardcoding 10 como o máximo por palpite. Depois da virada, quem cravar um jogo do mata-mata
   ganha 15 pts — o percentual passa de 100%, o que é visualmente quebrado.
3. `regras/page.tsx` e `colunas.tsx` (cabeçalhos do ranking) exibem os valores de pontuação
   como texto fixo (10/7/5/2) — ficam desatualizados/incorretos para jogos futuros.

O objetivo deste plano é corrigir esses três pontos **antes ou junto com** a execução do SQL
de virada em 2026-07-04, para que o ranking continue correto e a UI reflita os dois períodos.

## O que NÃO muda

- A regra de negócio já decidida (sem recálculo retroativo, execução via SQL direto) não muda.
- `recalcular_pontos()` / trigger `matches_recalcular_pontos` já funcionam corretamente: cada
  jogo é pontuado com os valores de `app_config` vigentes no momento em que é finalizado —
  isso já dá o comportamento "histórico preservado" automaticamente. Não mexer aqui.
- `src/lib/palpites/pontuacao.ts` (espelho TS de `pontos_palpite`) não é usado em lugar nenhum
  do app além do próprio teste — fora de escopo, não precisa de mudança.

## Mudanças propostas

### 1. Corrigir `cravadas` em `public.ranking()` — comparar palpite×placar, não pontos×config

Trocar a contagem de `cravadas` de "pontos == pts_placar_exato atual" para a definição real de
"cravou": `p.palpite_casa = m.placar_casa AND p.palpite_fora = m.placar_fora`. Isso é correto
independente de qualquer mudança futura de config, porque não depende mais do valor em pontos.

Nova migration (`supabase/migrations/00XX_ranking_cravadas_por_placar.sql`) reescrevendo
`public.ranking()`:

```sql
create or replace function public.ranking()
returns table (
  user_id uuid, apelido text, avatar_url text,
  pontos bigint, cravadas bigint, palpites_pontuados bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id, pr.apelido, pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa
        and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m on m.id = p.match_id
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;
```

(Mantém `revoke`/`grant` já existentes — não precisam ser reescritos, o `create or replace`
preserva os privilégios da função.)

### 2. Guardar o "máximo possível" por palpite pontuado, para o Aproveitamento

Adicionar coluna `predictions.pontos_max int` e gravá-la em `recalcular_pontos()` junto com
`pontos` (usando o mesmo `v_exato` já lido de `app_config` no momento da pontuação). Isso captura
o teto real de cada palpite pontuado, sem depender de nenhum valor fixo (10 ou 15) hardcoded na UI.

Ajustes na mesma migration:
- `alter table public.predictions add column if not exists pontos_max int;`
- Em `recalcular_pontos()`: `set pontos = ..., pontos_max = case when m.status='finalizado' then v_exato else null end`
- Backfill do histórico: `update predictions set pontos_max = 10 where pontos is not null and pontos_max is null;` (valor vigente até 03/07 — todo o histórico existente foi pontuado com `pts_placar_exato = 10`)
- `public.ranking()` passa a expor `sum(p.pontos_max) as pontos_max_total`

`RankingRow` (`src/lib/ranking.ts`) ganha o campo `pontos_max_total: number`.
`ranking-table.tsx` troca `l.palpites_pontuados * 10` por `l.pontos_max_total` no cálculo do
aproveitamento.

### 3. Atualizar textos fixos de pontuação na UI

- `src/app/regras/page.tsx`: adicionar nota/seção explicando os dois períodos — grupos
  (10/7/5/2, até 03/07) e mata-mata (15/7/4/1, a partir de 04/07). Manter a tabela `NIVEIS`
  simples mas com um aviso abaixo dela (mesmo padrão visual do card "Jogos com prorrogação"
  já existente).
- `src/components/ranking/colunas.tsx`: remover os valores fixos "(10 pts)" / "(7 pts)" etc.
  dos `label`s (usados só como `title` tooltip das colunas) — trocar por texto sem número
  fixo, já que o valor agora varia por período.

## Arquivos afetados

- `supabase/migrations/00XX_ranking_cravadas_por_placar.sql` (nova)
- `src/lib/ranking.ts` — tipo `RankingRow` + `pontos_max_total`
- `src/components/ranking/ranking-table.tsx` — usa `pontos_max_total` no aproveitamento
- `src/components/ranking/colunas.tsx` — labels sem pts fixos
- `src/app/regras/page.tsx` — nota sobre os dois períodos de pontuação

## Ordem de execução

1. TDD: não há teste unitário de SQL no projeto para `ranking()`/`recalcular_pontos()` (são
   funções de banco, testadas via `mcp__supabase-cravou__execute_sql` manualmente) — validar
   com queries diretas antes/depois da migration.
2. Aplicar a migration (item 1 e 2 acima) via `mcp__supabase-cravou__apply_migration`.
3. Ajustar `ranking.ts`, `ranking-table.tsx`, `colunas.tsx`, `regras/page.tsx`.
4. `npm test` (garante que nada de TS quebrou) + `npm run build`.
5. Só então (em 2026-07-04) rodar o SQL de virada já documentado na spec:
   ```sql
   update app_config set valor = '15' where chave = 'pts_placar_exato';
   update app_config set valor = '7'  where chave = 'pts_saldo';
   update app_config set valor = '4'  where chave = 'pts_resultado';
   update app_config set valor = '1'  where chave = 'pts_gols_time';
   ```

## Verificação

- `npm test` — sem regressões.
- Query manual: `select * from ranking()` antes e depois da migration — `cravadas` deve
  bater com `count(*) where palpite_casa=placar_casa and palpite_fora=placar_fora` calculado
  à mão para pelo menos 2 usuários conhecidos.
- Depois da virada (04/07): finalizar/corrigir um jogo de mata-mata de teste e conferir que
  quem cravou ganha 15 pts, `pontos_max_total` sobe 15 (não 10), e o aproveitamento não passa
  de 100%.
- `/ranking` e `/regras` renderizando corretamente em dark e light.
