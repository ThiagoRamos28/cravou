-- supabase/migrations/0020_profiles_competicoes.sql
-- 0020 — Opt-in de participação por competição + opt-in retroativo da Copa.

create table if not exists public.profiles_competicoes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  competicao_id uuid not null references public.competicoes (id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, competicao_id)
);

-- Opt-in retroativo: quem já palpitou na Copa continua no ranking da Copa.
insert into public.profiles_competicoes (user_id, competicao_id, ativo)
select distinct p.user_id, m.competicao_id, true
from public.predictions p
join public.matches m on m.id = p.match_id
where m.competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
on conflict (user_id, competicao_id) do nothing;

alter table public.profiles_competicoes enable row level security;

create policy "profiles_competicoes_select_own"
  on public.profiles_competicoes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_competicoes_insert_own"
  on public.profiles_competicoes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "profiles_competicoes_update_own"
  on public.profiles_competicoes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
