create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id text unique,
  fase text not null default 'grupos',
  rodada text not null default '',
  time_casa text not null,
  time_fora text not null,
  bandeira_casa text,
  bandeira_fora text,
  inicio_em timestamptz not null,
  status text not null default 'agendado'
    check (status in ('agendado','ao_vivo','finalizado')),
  placar_casa int,
  placar_fora int,
  placar_manual boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create index if not exists matches_inicio_em_idx on public.matches (inicio_em);

alter table public.matches enable row level security;

create policy "matches_select_authenticated"
  on public.matches for select
  to authenticated
  using (true);

create policy "matches_insert_admin"
  on public.matches for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ));

create policy "matches_update_admin"
  on public.matches for update
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ));
