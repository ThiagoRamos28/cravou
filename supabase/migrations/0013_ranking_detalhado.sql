-- Fase 4 — Ranking detalhado por nível de pontuação
-- Adiciona contagens por categoria ao retorno de public.ranking()

drop function if exists public.ranking();

create function public.ranking()
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
  total_palpites     bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id,
    pr.apelido,
    pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos = coalesce((select valor from public.app_config where chave = 'pts_placar_exato'), 10)
    )::bigint as cravadas,
    count(*) filter (
      where p.pontos = coalesce((select valor from public.app_config where chave = 'pts_saldo'), 7)
    )::bigint as acertos_saldo,
    count(*) filter (
      where p.pontos = coalesce((select valor from public.app_config where chave = 'pts_resultado'), 5)
    )::bigint as acertos_resultado,
    count(*) filter (
      where p.pontos = coalesce((select valor from public.app_config where chave = 'pts_gols_time'), 2)
    )::bigint as acertos_gols,
    count(*) filter (where p.pontos = 0)::bigint as erros,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados,
    count(p.id)::bigint as total_palpites
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;

revoke execute on function public.ranking() from public, anon;
grant execute on function public.ranking() to authenticated;
