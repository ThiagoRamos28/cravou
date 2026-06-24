create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  palpite_casa int not null check (palpite_casa >= 0),
  palpite_fora int not null check (palpite_fora >= 0),
  pontos int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_match_id_idx on public.predictions (match_id);
create index if not exists predictions_user_id_idx on public.predictions (user_id);

alter table public.predictions enable row level security;

-- Leitura: só os próprios palpites
create policy "predictions_select_own"
  on public.predictions for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserção: só os próprios E só com o corte aberto
create policy "predictions_insert_own"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id and public.palpite_aberto(match_id));

-- Atualização: só os próprios E só com o corte aberto
create policy "predictions_update_own"
  on public.predictions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.palpite_aberto(match_id));
