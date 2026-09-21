-- 0028 — Sugestões de placar enviadas ao admin no Telegram (Edge Function sugerir-placares).
-- Uma linha por jogo: serve de trava de idempotência (não reenviar) e de histórico para
-- comparar depois as sugestões com o placar real.
create table if not exists public.sugestoes_placar (
  match_id uuid primary key references public.matches (id) on delete cascade,
  enviado_em timestamptz not null default now(),
  fonte text not null check (fonte in ('odds+forma', 'odds', 'forma')),
  lambda_casa numeric not null,
  lambda_fora numeric not null,
  sugestoes jsonb not null
);

alter table public.sugestoes_placar enable row level security;

-- Sem policies: uso pessoal do admin, acesso apenas via service role (Edge Function).
