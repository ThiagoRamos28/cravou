-- Configurações do bolão (chave/valor inteiro)
create table if not exists public.app_config (
  chave text primary key,
  valor int not null
);

insert into public.app_config (chave, valor) values
  ('minutos_corte', 10),
  ('pts_placar_exato', 10),
  ('pts_resultado', 5)
on conflict (chave) do nothing;

alter table public.app_config enable row level security;

-- Leitura: qualquer autenticado (UI precisa do minutos_corte)
create policy "app_config_select_authenticated"
  on public.app_config for select
  to authenticated
  using (true);

-- Escrita: só admin
create policy "app_config_write_admin"
  on public.app_config for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- true enquanto ainda é permitido palpitar: now() < inicio_em - minutos_corte
create or replace function public.palpite_aberto(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select now() < m.inicio_em
    - make_interval(mins => coalesce(
        (select valor from public.app_config where chave = 'minutos_corte'), 10))
  from public.matches m
  where m.id = p_match_id;
$$;
