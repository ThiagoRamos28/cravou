-- Fase 7 (segurança) — Impede autopromção de admin via RLS.
-- Vulnerabilidade: profiles_update_self permitia qualquer usuário
-- atualizar is_admin para true na própria linha via chamada direta ao Supabase.
-- Correção: WITH CHECK garante que is_admin nunca muda via essa policy.

drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- is_admin deve permanecer igual ao valor atual no banco
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  );
