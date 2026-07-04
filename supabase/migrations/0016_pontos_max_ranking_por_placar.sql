-- 0016 — Virada de modelo (Modelo A, 04/07): contagens do ranking por palpite×placar
-- (independentes de app_config) + predictions.pontos_max (teto vigente na pontuação),
-- para aproveitamento correto com valores de pontuação que mudam entre temporadas.
-- NÃO altera nenhum predictions.pontos já gravado.

-- 1) Teto de pontos vigente no momento da pontuação de cada palpite
alter table public.predictions add column if not exists pontos_max int;

-- 2) recalcular_pontos passa a gravar também pontos_max (= pts_placar_exato vigente)
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
                     m.placar_casa, m.placar_fora, v_exato, v_saldo, v_res, v_gols),
          pontos_max = v_exato
      where p.match_id = p_match_id;
  else
    update public.predictions set pontos = null, pontos_max = null where match_id = p_match_id;
  end if;
end; $$;

revoke execute on function public.recalcular_pontos(uuid) from public, anon, authenticated;

-- 3) Backfill: todo o histórico existente foi pontuado com pts_placar_exato = 10
update public.predictions set pontos_max = 10 where pontos is not null and pontos_max is null;

-- 4) ranking(): categorias por palpite×placar (espelha os níveis de pontos_palpite,
--    mutuamente exclusivos, "pega a maior"), mantendo TODAS as colunas atuais
--    e adicionando pontos_max_total. drop+create porque o tipo de retorno muda.
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
  total_palpites     bigint,
  pontos_max_total   bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id,
    pr.apelido,
    pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    -- nível 1: placar exato
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    -- nível 2: vitória com vencedor certo e diferença de gols exata (não exato)
    count(*) filter (
      where p.pontos is not null
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and m.placar_casa <> m.placar_fora
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora)
    )::bigint as acertos_saldo,
    -- nível 3: resultado V/E/D certo (não níveis 1-2)
    count(*) filter (
      where p.pontos is not null
        and sign(p.palpite_casa - p.palpite_fora) = sign(m.placar_casa - m.placar_fora)
        and not (p.palpite_casa = m.placar_casa and p.palpite_fora = m.placar_fora)
        and not (m.placar_casa <> m.placar_fora
                 and (p.palpite_casa - p.palpite_fora) = (m.placar_casa - m.placar_fora))
    )::bigint as acertos_resultado,
    -- nível 4: errou o resultado, mas acertou os gols de um dos times
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
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m on m.id = p.match_id
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;

-- drop recria a função sem os privilégios anteriores — reaplicar
revoke execute on function public.ranking() from public, anon;
grant execute on function public.ranking() to authenticated;
