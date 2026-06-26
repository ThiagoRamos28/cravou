-- Fase 7 (segurança) — Trilha de auditoria para ações administrativas.
-- Registra: alterações de placar, mudanças de config, disparos de sync.
-- Apenas admins leem; inserção só via registrar_acao_admin() (SECURITY DEFINER).

create table if not exists public.audit_log (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete set null,
  acao           text        not null,
  tabela         text,
  registro_id    text,
  dados_anteriores jsonb,
  dados_novos    jsonb,
  criado_em      timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- Leitura: apenas administradores
create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));

-- Usuários não podem inserir diretamente — só via função abaixo
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Função auxiliar chamada pelos Server Actions após operações sensíveis
create or replace function public.registrar_acao_admin(
  p_acao           text,
  p_tabela         text    default null,
  p_registro_id    text    default null,
  p_dados_anteriores jsonb default null,
  p_dados_novos    jsonb   default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (
    user_id, acao, tabela, registro_id, dados_anteriores, dados_novos
  ) values (
    auth.uid(), p_acao, p_tabela, p_registro_id, p_dados_anteriores, p_dados_novos
  );
end; $$;

revoke execute on function public.registrar_acao_admin from public, anon;
grant  execute on function public.registrar_acao_admin to authenticated;
