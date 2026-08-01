-- rls_palpites_adiados.test.sql
-- Regressão: o palpite de um jogo ADIADO não pode ficar visível para outro usuário.
-- A política predictions_select_started_matches libera palpites alheios quando
-- inicio_em <= now(). Num jogo adiado a data original já passou e o jogo NÃO aconteceu,
-- então quem ainda não palpitou enxergaria os palpites dos outros e palpitaria informado
-- quando o jogo fosse remarcado.
-- Execução: cole no execute_sql do MCP Supabase (roda em transação e faz ROLLBACK).

CREATE EXTENSION IF NOT EXISTS pgtap;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

BEGIN;
SELECT plan(5);

-- autor  = quem palpitou   'c1c1c1c1-0000-0000-0000-0000000000a1'
-- bisbi  = quem quer olhar 'c2c2c2c2-0000-0000-0000-0000000000a2'
DELETE FROM auth.users WHERE id IN
  ('c1c1c1c1-0000-0000-0000-0000000000a1', 'c2c2c2c2-0000-0000-0000-0000000000a2');
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
) VALUES
  ('c1c1c1c1-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'autor-adiado@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}'),
  ('c2c2c2c2-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'bisbilhoteiro@test.com', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated', '{}', '{}');

DELETE FROM public.competicoes WHERE id = 'cc000000-0000-0000-0000-0000000000cc';
INSERT INTO public.competicoes (id, slug, nome, formato, ativa, ordem) VALUES
  ('cc000000-0000-0000-0000-0000000000cc', 'test-adiado', 'Comp Adiado',
   'pontos-corridos', true, 92);

DELETE FROM public.matches WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
INSERT INTO public.matches
  (id, api_fixture_id, competicao_id, time_casa, time_fora, inicio_em, status)
VALUES
  ('dd000000-0000-0000-0000-0000000000dd', 'adiado-test-1',
   'cc000000-0000-0000-0000-0000000000cc', 'Time1', 'Time2',
   NOW() - INTERVAL '2 days', 'agendado');

DELETE FROM public.predictions WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd';
INSERT INTO public.predictions (user_id, match_id, palpite_casa, palpite_fora) VALUES
  ('c1c1c1c1-0000-0000-0000-0000000000a1', 'dd000000-0000-0000-0000-0000000000dd', 3, 1);

-- Vira o bisbilhoteiro (authenticated).
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 1) Jogo AGENDADO com horário vencido: o palpite alheio é visível (comportamento atual,
--    correto — o jogo começou).
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  1,
  'jogo agendado que ja comecou: palpite alheio visivel'
);

RESET role;
UPDATE public.matches SET status = 'adiado'
  WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 2) Jogo ADIADO: o palpite alheio some.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo adiado: palpite alheio NAO vaza'
);

RESET role;
UPDATE public.matches SET status = 'cancelado'
  WHERE id = 'dd000000-0000-0000-0000-0000000000dd';
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 3) Jogo CANCELADO: idem.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo cancelado: palpite alheio NAO vaza'
);

-- Remarcação: o jogo volta a 'agendado' com data no futuro, como o upsert do sync faria.
RESET role;
UPDATE public.matches
   SET status = 'agendado', inicio_em = NOW() + INTERVAL '2 days'
 WHERE id = 'dd000000-0000-0000-0000-0000000000dd';

-- 4) O palpite feito antes do adiamento foi PRESERVADO e voltou a ser editável.
--    palpite_aberto() olha só inicio_em, então a remarcação reabre a edição sozinha —
--    é o que torna a regra de produto gratuita. Este teste protege essa premissa.
SELECT ok(
  public.palpite_aberto('dd000000-0000-0000-0000-0000000000dd'),
  'jogo remarcado: palpite volta a ser editavel'
);

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"c2c2c2c2-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- 5) E o palpite alheio volta a ficar escondido, porque a nova data ainda não chegou.
SELECT is(
  (SELECT count(*)::int FROM public.predictions
    WHERE match_id = 'dd000000-0000-0000-0000-0000000000dd'),
  0,
  'jogo remarcado para o futuro: palpite alheio segue escondido'
);

SELECT * FROM finish();
ROLLBACK;
