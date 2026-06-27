-- Camada social — visibilidade de palpites de outros usuários.
-- Permite que usuários autenticados leiam palpites alheios,
-- mas somente para partidas que já começaram (inicio_em <= now()).
-- Isso protege a integridade competitiva: ninguém vê o palpite
-- de um adversário antes do corte de edição.
--
-- predictions_select_own (existente) continua válida:
-- cada usuário sempre lê os próprios palpites independente do status.

drop policy if exists "predictions_select_all" on public.predictions;
drop policy if exists "predictions_select_started_matches" on public.predictions;

create policy "predictions_select_started_matches"
  on public.predictions for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.inicio_em <= now()
    )
  );
