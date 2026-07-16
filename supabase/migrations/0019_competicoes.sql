-- supabase/migrations/0019_competicoes.sql
-- 0019 — Competições multi-torneio (Copa arquivada + Brasileirão ativo).

create table if not exists public.competicoes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  formato text not null default 'pontos-corridos'
    check (formato in ('fases', 'pontos-corridos')),
  ativa boolean not null default true,
  fs_tournament_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.competicoes (slug, nome, formato, ativa, fs_tournament_url, ordem) values
  ('copa-mundo-2026', 'Copa do Mundo 2026', 'fases', false, null, 1),
  ('brasileirao-2026', 'Brasileirão Série A 2026', 'pontos-corridos', true, '/football/brazil/serie-a-betano/', 2)
on conflict (slug) do nothing;

alter table public.matches add column if not exists competicao_id uuid references public.competicoes (id);

update public.matches
set competicao_id = (select id from public.competicoes where slug = 'copa-mundo-2026')
where competicao_id is null;

alter table public.matches alter column competicao_id set not null;

create index if not exists matches_competicao_id_idx on public.matches (competicao_id);

-- RLS de competicoes: leitura para autenticados, escrita só admin (mesmo padrão de app_config).
alter table public.competicoes enable row level security;

create policy "competicoes_select_authenticated"
  on public.competicoes for select
  to authenticated
  using (true);

create policy "competicoes_write_admin"
  on public.competicoes for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
