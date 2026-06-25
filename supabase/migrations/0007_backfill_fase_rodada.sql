-- Fase 5 — Backfill da rodada da fase de grupos por blocos de data (fim exclusivo).
-- A API FlashScore não expõe rodada; derivamos pelos blocos de data do calendário
-- da Copa 2026 (grupos: 11–28/jun). A sync enriquecida recalcula os mesmos valores
-- a cada execução, então este backfill e a sync ficam consistentes.

update public.matches set rodada = '1'
  where fase = 'grupos' and rodada = ''
    and inicio_em < '2026-06-18T00:00:00Z';

update public.matches set rodada = '2'
  where fase = 'grupos' and rodada = ''
    and inicio_em >= '2026-06-18T00:00:00Z'
    and inicio_em <  '2026-06-24T00:00:00Z';

update public.matches set rodada = '3'
  where fase = 'grupos' and rodada = ''
    and inicio_em >= '2026-06-24T00:00:00Z';
