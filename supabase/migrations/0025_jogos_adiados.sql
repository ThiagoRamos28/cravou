-- supabase/migrations/0025_jogos_adiados.sql
-- 0025 — Jogos adiados e cancelados.
--
-- Contexto: `matches.status` só tinha agendado/ao_vivo/finalizado. Um jogo adiado ficava
-- `agendado` com `inicio_em` no passado e nunca saía da listagem (aparecia com o palpite
-- fechado, para sempre). Pior: a política predictions_select_started_matches libera os
-- palpites alheios quando `inicio_em <= now()`, então os palpites de um jogo que NÃO
-- aconteceu ficavam expostos a todo usuário logado.
--
-- Três mudanças:
--   1. status aceita 'adiado' (reversível — volta a 'agendado' quando remarcado) e
--      'cancelado' (terminal).
--   2. a política de leitura de palpites alheios passa a exigir que o jogo não esteja
--      adiado nem cancelado.
--   3. ranking() ignora palpites de jogo cancelado: o jogo deixou de existir e não pode
--      estragar o aproveitamento de ninguém.

-- 1. Estados ────────────────────────────────────────────────────────────────────────────
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status = any (array['agendado', 'ao_vivo', 'finalizado', 'adiado', 'cancelado']));

-- 2. RLS ────────────────────────────────────────────────────────────────────────────────
-- Mantém `to public` + `auth.uid() is not null` inline, exatamente como estava: trocar o
-- papel mudaria o alcance da política.
drop policy if exists predictions_select_started_matches on public.predictions;
create policy predictions_select_started_matches on public.predictions
  for select to public
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.inicio_em <= now()
        and m.status not in ('adiado', 'cancelado')
    )
  );

-- 3. Ranking ────────────────────────────────────────────────────────────────────────────
-- Idêntica à 0024, com uma única diferença: o pré-filtro de `predictions` (que conserta o
-- vazamento entre competições e NÃO pode ser removido) passa a descartar também os jogos
-- cancelados, tirando-os de todos os agregados — inclusive de `total_palpites`.
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
  -- Só os palpites DESTA competição, e nunca os de jogo cancelado.
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
  where case p_periodo
    when 'temporada_1' then m.inicio_em <  timestamptz '2026-07-04 00:00:00-03'
    when 'temporada_2' then m.inicio_em >= timestamptz '2026-07-04 00:00:00-03'
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;

revoke execute on function public.ranking(uuid, text) from public, anon;
grant execute on function public.ranking(uuid, text) to authenticated;

-- 4. Backfill ───────────────────────────────────────────────────────────────────────────
-- Os 4 jogos do Brasileirão marcados para 2026-07-29 17:00 BRT. A API confirmou
-- `is_postponed: true` nos quatro em 2026-07-31.
update public.matches
   set status = 'adiado', atualizado_em = now()
 where api_fixture_id in ('dKNS3gge', 'ARJ356Ua', 'U3fuDcW8', '2c2gkfv2')
   and status = 'agendado';
