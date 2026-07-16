-- supabase/migrations/0023_matches_odds.sql
-- 0023 — Snapshot de odds pré-jogo (1x2, over/under 2.5, ambas marcam) por partida.
-- Coluna aditiva e nullable: jogos sem odds capturadas ficam com NULL.

alter table public.matches add column if not exists odds jsonb;
