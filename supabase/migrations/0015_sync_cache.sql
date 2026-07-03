-- Cache de dados estáveis da sincronização (ex.: IDs/stages do torneio da API-Football/FlashScore).
-- Evita chamar /tournaments/ids toda run da Edge Function sync-matches (endpoint que estava
-- tomando 429 e derrubando a sync inteira).
create table if not exists public.sync_cache (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.sync_cache enable row level security;

-- Sem policies para authenticated/anon: acesso apenas via service role (Edge Function),
-- que ignora RLS. Cache é detalhe interno da sincronização, não exposto ao cliente.
