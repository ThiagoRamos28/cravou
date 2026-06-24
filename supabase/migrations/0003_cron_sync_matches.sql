create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sync-matches')
  where exists (select 1 from cron.job where jobname = 'sync-matches');

select cron.schedule(
  'sync-matches',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xyfuxtlnjapsptqufgah.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    )
  );
  $$
);
