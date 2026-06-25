-- Fase 4 — Pontuação & Ranking
-- Modelo "pega a maior" (5 níveis): o palpite recebe os pontos de uma única
-- categoria, a mais alta que casar. Valores configuráveis em app_config.

-- 0) Novas chaves de pontuação em app_config (idempotente)
insert into public.app_config (chave, valor) values
  ('pts_saldo', 7),
  ('pts_gols_time', 2)
on conflict (chave) do nothing;

-- 1) Função pura de pontos de um palpite (níveis avaliados de cima pra baixo)
create or replace function public.pontos_palpite(
  p_casa int, p_fora int, r_casa int, r_fora int,
  pts_exato int, pts_saldo int, pts_resultado int, pts_gols int
) returns int language sql immutable set search_path = '' as $$
  select case
    when p_casa is null or p_fora is null or r_casa is null or r_fora is null then null
    -- 1: placar exato
    when p_casa = r_casa and p_fora = r_fora then pts_exato
    -- 2: vitória (não empate) com vencedor certo E diferença de gols exata
    when r_casa <> r_fora
         and sign(p_casa - p_fora) = sign(r_casa - r_fora)
         and (p_casa - p_fora) = (r_casa - r_fora) then pts_saldo
    -- 3: resultado V/E/D (mesmo sinal de casa - fora)
    when sign(p_casa - p_fora) = sign(r_casa - r_fora) then pts_resultado
    -- 4: errou o resultado, mas acertou os gols de um dos times
    when p_casa = r_casa or p_fora = r_fora then pts_gols
    else 0
  end;
$$;

-- 2) Recalcula os pontos de todos os palpites de um jogo
create or replace function public.recalcular_pontos(p_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_exato int := coalesce((select valor from public.app_config where chave='pts_placar_exato'),10);
  v_saldo int := coalesce((select valor from public.app_config where chave='pts_saldo'),7);
  v_res   int := coalesce((select valor from public.app_config where chave='pts_resultado'),5);
  v_gols  int := coalesce((select valor from public.app_config where chave='pts_gols_time'),2);
  m record;
begin
  select status, placar_casa, placar_fora into m from public.matches where id = p_match_id;
  if m.status = 'finalizado' and m.placar_casa is not null and m.placar_fora is not null then
    update public.predictions p
      set pontos = public.pontos_palpite(p.palpite_casa, p.palpite_fora,
                     m.placar_casa, m.placar_fora, v_exato, v_saldo, v_res, v_gols)
      where p.match_id = p_match_id;
  else
    update public.predictions set pontos = null where match_id = p_match_id;
  end if;
end; $$;

-- 3) Trigger: ao inserir/atualizar um jogo, recalcula (cobre sync + admin)
create or replace function public.trg_recalcular_pontos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_pontos(new.id);
  return new;
end; $$;

drop trigger if exists matches_recalcular_pontos on public.matches;
create trigger matches_recalcular_pontos
  after insert or update of status, placar_casa, placar_fora on public.matches
  for each row execute function public.trg_recalcular_pontos();

-- recalcular_pontos / trg são internas (trigger + admin): não expor via RPC.
-- O grant default de EXECUTE é para PUBLIC, então é preciso revogar de PUBLIC.
revoke execute on function public.recalcular_pontos(uuid) from public, anon, authenticated;
revoke execute on function public.trg_recalcular_pontos() from public, anon, authenticated;

-- 4) Backfill dos jogos já finalizados
do $$ declare r record; begin
  for r in select id from public.matches where status='finalizado' loop
    perform public.recalcular_pontos(r.id);
  end loop;
end $$;

-- 5) Ranking: função SECURITY DEFINER (agrega todos os usuários, expõe só
--    agregados). Função em vez de view para não disparar o advisor
--    "security_definer_view"; executável só por autenticados.
create or replace function public.ranking()
returns table (
  user_id uuid, apelido text, avatar_url text,
  pontos bigint, cravadas bigint, palpites_pontuados bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id, pr.apelido, pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos = coalesce((select valor from public.app_config where chave='pts_placar_exato'),10)
    )::bigint as cravadas,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;

revoke execute on function public.ranking() from public, anon;
grant execute on function public.ranking() to authenticated;
