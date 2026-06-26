-- rls_security.test.sql
-- Testa as correções de segurança da Fase 7 (pen-test antifraude).
-- Execução: cole no execute_sql do MCP Supabase, ou rode via `supabase test db`.
-- Pré-requisito: pgTAP instalado (CREATE EXTENSION IF NOT EXISTS pgtap).

CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(5);

-- UUID fixo: uid_user = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' (usuário comum)
-- Não precisa de admin — todas as verificações testam o bloqueio de não-admins.

DELETE FROM auth.users WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
   'sec-user@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');
-- Trigger on_auth_user_created cria public.profiles com is_admin = false

-- ============================================================
-- C-1: Autopromção de admin via RLS (WITH CHECK barra)
-- ============================================================

-- Teste 1: Usuário comum NÃO consegue se tornar admin — recebe 42501
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ UPDATE public.profiles SET is_admin = true
     WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' $$,
  '42501',
  NULL,
  'C-1: self-promote para admin lança 42501 (WITH CHECK barra)'
);
RESET ROLE;

-- Teste 2: Usuário comum PODE atualizar apelido normalmente (sem regressão)
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ UPDATE public.profiles SET apelido = 'Palpiteiro'
     WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' $$,
  'C-1: usuário pode atualizar apelido sem erro (regressão OK)'
);
RESET ROLE;

-- ============================================================
-- A-1: recalcular_todos() exige is_admin no banco
-- ============================================================

-- Teste 3: Usuário comum recebe exceção ao chamar recalcular_todos()
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.recalcular_todos() $$,
  'Apenas administradores podem recalcular pontos.',
  'A-1: não-admin recebe exceção ao chamar recalcular_todos()'
);
RESET ROLE;

-- ============================================================
-- M-1: audit_log visível apenas para admins
-- ============================================================

-- Teste 4: Usuário comum vê 0 linhas no audit_log (RLS barra)
SELECT set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.audit_log),
  0,
  'M-1: usuário comum vê 0 linhas no audit_log'
);
RESET ROLE;

-- Teste 5: Anônimo vê 0 linhas no audit_log
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.audit_log),
  0,
  'M-1: anônimo vê 0 linhas no audit_log'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
