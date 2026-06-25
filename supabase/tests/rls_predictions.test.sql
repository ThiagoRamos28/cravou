-- rls_predictions.test.sql
-- Execução: cole no execute_sql do MCP Supabase, ou rode via `supabase test db`.
-- Pré-requisito: pgTAP instalado (CREATE EXTENSION IF NOT EXISTS pgtap).

-- Habilitar pgTAP (fora da transação de teste para o GRANT persistir)
CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(7);

-- UUIDs fixos para reprodutibilidade
-- uid_a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- uid_b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
-- mid1  = 'cccccccc-cccc-cccc-cccc-cccccccccccc' (finalizado — corte passado)
-- mid2  = 'dddddddd-dddd-dddd-dddd-dddddddddddd' (agendado — corte aberto)

-- Fixtures como postgres (bypassa RLS)
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'rls-a@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'rls-b@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');
-- Trigger on_auth_user_created cria public.profiles automaticamente

DELETE FROM public.matches WHERE id IN (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

INSERT INTO public.matches (id, api_fixture_id, time_casa, time_fora, inicio_em, status)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'rls-test-mid1',
   'Brasil', 'Argentina', NOW() - INTERVAL '2 hours', 'finalizado'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'rls-test-mid2',
   'França',  'Alemanha',  NOW() + INTERVAL '2 hours', 'agendado');

DELETE FROM public.predictions WHERE user_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2, 1);

-- === Teste 1: User A vê apenas as próprias predictions ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.predictions),
  1,
  'User A vê apenas 1 prediction (a própria)'
);
RESET ROLE;

-- === Teste 2: User A vê 0 predictions de B ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.predictions
   WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'User A vê 0 predictions de B (filtro RLS)'
);
RESET ROLE;

-- === Teste 3: User A pode INSERT prediction própria (jogo aberto) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 0) $$,
  'User A insere prediction própria em jogo aberto sem erro'
);
RESET ROLE;

-- === Teste 4: User A NÃO pode INSERT com user_id de B ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora)
     VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'dddddddd-dddd-dddd-dddd-dddddddddddd', 0, 0) $$,
  '42501', NULL,
  'User A não pode inserir prediction com user_id de B (WITH CHECK falha)'
);
RESET ROLE;

-- === Teste 5: User A pode UPDATE na própria prediction (jogo aberto) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ UPDATE public.predictions SET palpite_casa = 2
     WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND match_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  'User A atualiza prediction própria em jogo aberto sem erro'
);
RESET ROLE;

-- === Teste 6: User A NÃO pode UPDATE prediction de B (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.predictions SET palpite_casa = 99
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
RESET ROLE;
SELECT is(
  (SELECT palpite_casa::int FROM public.predictions
   WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  2,
  'User A não modifica prediction de B (palpite_casa permanece 2)'
);

-- === Teste 7: Anônimo vê 0 predictions ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.predictions),
  0,
  'Anônimo vê 0 predictions'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
