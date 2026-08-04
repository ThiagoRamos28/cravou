-- supabase/migrations/0027_ranking_regex_mes.sql
-- 0027 — Alinha o regex de período mensal da ranking() ao do TypeScript.
--
-- A 0026 introduziu `p_periodo ~ '^\d{4}-\d{2}$'`, que aceita mês inválido (ex.: '2026-99').
-- O guard TypeScript (`ehPeriodoMensal` em src/lib/ranking-shared.ts) usa
-- `^\d{4}-(0[1-9]|1[0-2])$`, que só aceita 01–12. Inofensivo hoje porque `to_char(...,
-- 'YYYY-MM')` nunca emite mês fora de 01–12, mas os dois guards deviam dizer a mesma coisa.
--
-- Corpo idêntico ao da 0026, só o regex muda. ranking_meses() não usa esse regex e não é
-- tocada.

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
    when p_periodo ~ '^\d{4}-(0[1-9]|1[0-2])$' then
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
