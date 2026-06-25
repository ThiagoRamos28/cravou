-- rls_matches.test.sql
-- Pré-requisito: pgTAP instalado e acessível (ver Task 1).

CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(9);

-- Fixtures como postgres
DELETE FROM auth.users WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
   'rls-c@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');

DELETE FROM public.matches WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
INSERT INTO public.matches (id, api_fixture_id, time_casa, time_fora, inicio_em, status)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'rls-match-test',
        'Espanha', 'Portugal', NOW() + INTERVAL '1 hour', 'agendado');

-- === Teste 1: Autenticado pode SELECT em matches ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.matches WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  1,
  'Autenticado pode SELECT matches'
);
RESET ROLE;

-- === Teste 2: Autenticado NÃO pode INSERT em matches ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.matches (api_fixture_id, time_casa, time_fora, inicio_em)
     VALUES ('rls-fail', 'X', 'Y', NOW() + INTERVAL '1 day') $$,
  '42501', NULL,
  'Autenticado não-admin não pode INSERT em matches'
);
RESET ROLE;

-- === Teste 3: Autenticado NÃO pode UPDATE matches (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.matches SET time_casa = 'HACK'
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
RESET ROLE;
SELECT is(
  (SELECT time_casa FROM public.matches WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  'Espanha',
  'Autenticado não-admin não modifica matches (USING falha, filtro silencioso)'
);

-- === Teste 4: Autenticado pode SELECT ranking() ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT * FROM public.ranking() $$,
  'Autenticado pode chamar ranking()'
);
RESET ROLE;

-- === Teste 5: Anônimo NÃO pode chamar ranking() ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT * FROM public.ranking() $$,
  '42501', NULL,
  'Anônimo não pode chamar ranking() (GRANT só para authenticated)'
);
RESET ROLE;

-- === Teste 6: Anônimo vê 0 matches ===
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.matches),
  0,
  'Anônimo vê 0 matches (sem policy para anon)'
);
RESET ROLE;

-- === Teste 7: Autenticado pode SELECT app_config ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.app_config),
  '>', 0,
  'Autenticado pode SELECT app_config'
);
RESET ROLE;

-- === Teste 8: Autenticado NÃO pode UPDATE app_config (filtro silencioso) ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.app_config SET valor = 999 WHERE chave = 'minutos_corte';
RESET ROLE;
SELECT isnt(
  (SELECT valor FROM public.app_config WHERE chave = 'minutos_corte'),
  999,
  'Autenticado não-admin não pode UPDATE app_config (USING admin check falha)'
);

-- === Teste 9: Autenticado NÃO pode INSERT em app_config ===
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO public.app_config (chave, valor) VALUES ('chave_hack', 42) $$,
  '42501', NULL,
  'Autenticado não-admin não pode INSERT em app_config'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
