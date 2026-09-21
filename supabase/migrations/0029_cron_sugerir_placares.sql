-- 0029 — Agenda a Edge Function sugerir-placares.
-- Roda 5 min depois de cada execução do sync-matches (*/15), que é quem captura as odds
-- pré-jogo quando o jogo entra na janela de 2h. Assim a sugestão já sai com as odds gravadas.
-- O header x-cron-secret é o mesmo do job sync-matches: ao aplicar, substitua <CRON_SECRET>
-- (ou copie o comando do job existente, trocando só o nome da função na URL).
select cron.unschedule('sugerir-placares')
  where exists (select 1 from cron.job where jobname = 'sugerir-placares');

select cron.schedule(
  'sugerir-placares',
  '5,20,35,50 * * * *',
  $$
  select net.http_post(
    url := 'https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sugerir-placares',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    timeout_milliseconds := 20000
  );
  $$
);
