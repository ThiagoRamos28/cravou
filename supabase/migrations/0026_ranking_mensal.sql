-- supabase/migrations/0026_ranking_mensal.sql
-- 0026 — Ranking mensal e cascata de desempate.
--
-- Duas mudanças em ranking() e uma função nova:
--   1. p_periodo passa a aceitar 'YYYY-MM' (mês em horário de Brasília). O `case p_periodo
--      when ...` (forma simples) vira `case when ...` (forma pesquisada) porque a comparação
--      por regex não cabe na forma simples.
--   2. o order by desce por toda a hierarquia da pontuação em vez de parar em cravadas.
--      Antes, dois usuários empatados em pontos e cravadas saíam em ordem indefinida — a
--      mesma tabela podia aparecer em ordens diferentes em dois acessos.
--   3. ranking_meses() lista os meses de uma competição e diz quais já fecharam.
--
-- O corpo da ranking() é o da 0025 com essas duas mudanças e nada mais. Os dois trechos
-- abaixo são consertos de bugs reais e NÃO podem ser perdidos na reescrita:
--   - o pré-filtro de predictions via `exists` (0024), que impede pontos de vazarem entre
--     competições (filtro no ON de LEFT JOIN não filtra agregados);
--   - o `and mm.status <> 'cancelado'` dentro desse exists (0025).

-- 1. ranking() ──────────────────────────────────────────────────────────────────────────
create or replace function public.ranking(p_competicao_id uuid, p_periodo text default 'geral')
returns table (
  user_id            uuid,
  apelido            text,
  avatar_url         text,
  pontos             bigint,
  cravadas           bigint,
  acertos_saldo      bigint,
  acertos_resultado  bigint,
  acertos_gols       bigint,
  erros              bigint,
  palpites_pontuados bigint,
  total_palpites     bigint,
  pontos_max_total   bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id,
    pr.apelido,
    pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    count(*) filter (
      where p.pontos is not null
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and m.placar_casa <> m.placar_fora
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora)
    )::bigint as acertos_saldo,
    count(*) filter (
      where p.pontos is not null
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and not (m.placar_casa <> m.placar_fora
                 and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora))
    )::bigint as acertos_resultado,
    count(*) filter (
      where p.pontos is not null
        and sign(p.palpite_casa - p.palpite_fora) <> sign(m.placar_casa - m.placar_fora)
        and (p.palpite_casa = m.placar_casa or p.palpite_fora = m.placar_fora)
    )::bigint as acertos_gols,
    count(*) filter (where p.pontos = 0)::bigint as erros,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados,
    count(p.id)::bigint as total_palpites,
    coalesce(sum(p.pontos_max), 0)::bigint as pontos_max_total
  from public.profiles pr
  join public.profiles_competicoes pc
    on pc.user_id = pr.id
   and pc.competicao_id = p_competicao_id
   and pc.ativo = true
  -- Só os palpites DESTA competição, e nunca os de jogo cancelado. (0024 + 0025)
  left join public.predictions p
    on p.user_id = pr.id
   and exists (
     select 1 from public.matches mm
     where mm.id = p.match_id
       and mm.competicao_id = p_competicao_id
       and mm.status <> 'cancelado'
   )
  left join public.matches m
    on m.id = p.match_id
   and m.competicao_id = p_competicao_id
  where case
    when p_periodo = 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
    when p_periodo = 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
    when p_periodo ~ '^\d{4}-\d{2}$' then
      to_char(m.inicio_em at time zone 'America/Sao_Paulo', 'YYYY-MM') = p_periodo
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  -- Seis critérios de mérito; apelido e id só para a ordem ser estável entre acessos.
  order by pontos desc, cravadas desc, acertos_saldo desc, acertos_resultado desc,
           acertos_gols desc, erros asc, pr.apelido asc nulls last, pr.id asc;
$$;

revoke execute on function public.ranking(uuid, text) from public, anon;
grant  execute on function public.ranking(uuid, text) to authenticated;

-- 2. ranking_meses() ────────────────────────────────────────────────────────────────────
-- `fechado` = nenhum jogo do mês pendente. 'adiado' e 'cancelado' contam como resolvidos:
-- senão um adiamento sem data nova seguraria o mês aberto para sempre. A segunda condição
-- (finalizado com palpite sem pontos) evita anunciar campeão na janela entre a sync
-- finalizar o jogo e o recalcular_pontos rodar.
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
