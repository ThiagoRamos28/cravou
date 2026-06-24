-- Perfis: 1:1 com auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  apelido text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Leitura: qualquer usuário autenticado vê todos os perfis (necessário p/ ranking)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Inserção: só o próprio usuário (fallback; o normal é via trigger)
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Atualização: só o próprio perfil
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Cria a linha de perfil automaticamente quando um usuário é criado
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
