-- 0018 — recalcular_pontos ciente de temporada (corrige re-corrupção pelo trigger/sync).
--
-- Problema: recalcular_pontos lia SEMPRE o app_config vigente. Como o trigger
-- matches_recalcular_pontos dispara em cada UPDATE OF placar_casa/placar_fora — e o
-- sync automático re-escreve o placar de jogos já finalizados — os jogos da fase de
-- grupos (temporada 1) eram re-pontuados com o modelo novo (15/7/4/1) a cada sync,
-- desfazendo o histórico congelado (10/7/5/2). A premissa "finaliza e congela" da
-- virada (0016) era falsa porque o sync re-toca partidas finalizadas.
--
-- Correção: o modelo passa a ser escolhido pela DATA do jogo (mesmo corte da 0017),
-- não pelo app_config global. Temporada 1 (grupos, inicio_em < 04/07 00:00 BRT) fica
-- congelada em 10/7/5/2; temporada 2+ (a partir do corte) usa o app_config vigente.
-- Isso torna a função idempotente: o trigger pode disparar quantas vezes quiser.

create or replace function public.recalcular_pontos(p_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_corte constant timestamptz := timestamptz '2026-07-04 00:00:00-03';
  v_exato int; v_saldo int; v_res int; v_gols int;
  m record;
begin
  select status, placar_casa, placar_fora, inicio_em into m
    from public.matches where id = p_match_id;

  if m.inicio_em < v_corte then
    -- Temporada 1 (grupos): modelo congelado, independente de app_config.
    v_exato := 10; v_saldo := 7; v_res := 5; v_gols := 2;
  else
    -- Temporada 2+ (a partir do corte): modelo vigente em app_config.
    v_exato := coalesce((select valor from public.app_config where chave='pts_placar_exato'),15);
    v_saldo := coalesce((select valor from public.app_config where chave='pts_saldo'),7);
    v_res   := coalesce((select valor from public.app_config where chave='pts_resultado'),4);
    v_gols  := coalesce((select valor from public.app_config where chave='pts_gols_time'),1);
  end if;

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
