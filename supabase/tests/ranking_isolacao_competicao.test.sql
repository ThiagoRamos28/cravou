-- ranking_isolacao_competicao.test.sql
-- Regressão do bug 0024: ranking(competicao) NÃO pode somar pontos de OUTRA competição.
-- Execução: cole no execute_sql do MCP Supabase (roda em transação e faz ROLLBACK), ou
-- rode via `supabase test db`. Pré-requisito: pgTAP (CREATE EXTENSION IF NOT EXISTS pgtap).

CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(3);

-- Fixtures como postgres (bypassa RLS). UUIDs fixos para reprodutibilidade.
-- userX  = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
-- compA  = 'a1a1a1a1-0000-0000-0000-000000000001' (onde consultamos o ranking)
-- compB  = 'b2b2b2b2-0000-0000-0000-000000000002' (outra competição — não pode vazar)
-- matchA = 'a1000000-0000-0000-0000-00000000000a'
-- matchB = 'b2000000-0000-0000-0000-00000000000b'

DELETE FROM auth.users WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
   'rank-x@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');
-- Trigger on_auth_user_created cria public.profiles automaticamente.

DELETE FROM public.competicoes WHERE id IN
  ('a1a1a1a1-0000-0000-0000-000000000001', 'b2b2b2b2-0000-0000-0000-000000000002');
INSERT INTO public.competicoes (id, slug, nome, formato, ativa, ordem) VALUES
  ('a1a1a1a1-0000-0000-0000-000000000001', 'test-comp-a', 'Comp A', 'pontos-corridos', true, 90),
  ('b2b2b2b2-0000-0000-0000-000000000002', 'test-comp-b', 'Comp B', 'pontos-corridos', true, 91);

DELETE FROM public.matches WHERE id IN
  ('a1000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-00000000000b');
INSERT INTO public.matches
  (id, api_fixture_id, competicao_id, time_casa, time_fora, inicio_em, status, placar_casa, placar_fora)
VALUES
  ('a1000000-0000-0000-0000-00000000000a', 'rank-test-a', 'a1a1a1a1-0000-0000-0000-000000000001',
   'Time1', 'Time2', NOW() - INTERVAL '2 hours', 'finalizado', 2, 1),
  ('b2000000-0000-0000-0000-00000000000b', 'rank-test-b', 'b2b2b2b2-0000-0000-0000-000000000002',
   'Time3', 'Time4', NOW() - INTERVAL '2 hours', 'finalizado', 0, 0);

-- userX participa das DUAS competições
DELETE FROM public.profiles_competicoes WHERE user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
INSERT INTO public.profiles_competicoes (user_id, competicao_id, ativo) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'a1a1a1a1-0000-0000-0000-000000000001', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'b2b2b2b2-0000-0000-0000-000000000002', true);

-- Palpites com pontos FIXOS: 10 na Comp A, 99 na Comp B.
DELETE FROM public.predictions WHERE user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora, pontos, pontos_max) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'a1000000-0000-0000-0000-00000000000a', 2, 1, 10, 15),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'b2000000-0000-0000-0000-00000000000b', 0, 0, 99, 15);

-- === Teste 1: pontos do ranking da Comp A = 10 (NÃO 109 — sem vazar a Comp B) ===
SELECT is(
  (SELECT pontos::int FROM public.ranking('a1a1a1a1-0000-0000-0000-000000000001', 'geral')
   WHERE user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  10,
  'ranking(Comp A) conta só os 10 pts da Comp A, não soma os 99 da Comp B'
);

-- === Teste 2: total_palpites da Comp A = 1 (só o palpite da Comp A) ===
SELECT is(
  (SELECT total_palpites::int FROM public.ranking('a1a1a1a1-0000-0000-0000-000000000001', 'geral')
   WHERE user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'ranking(Comp A) conta só 1 palpite (o da Comp A)'
);

-- === Teste 3: simetria — ranking da Comp B conta só os 99, não os 10 ===
SELECT is(
  (SELECT pontos::int FROM public.ranking('b2b2b2b2-0000-0000-0000-000000000002', 'geral')
   WHERE user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  99,
  'ranking(Comp B) conta só os 99 pts da Comp B, não soma os 10 da Comp A'
);

SELECT * FROM finish();
ROLLBACK;
