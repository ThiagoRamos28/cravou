-- Fase 7 (segurança) — Move verificação de admin para dentro do banco.
-- Vulnerabilidade: recalcular_todos() era executável por qualquer usuário
-- autenticado via chamada direta ao Supabase (bypass do Next.js).
-- Correção: a função verifica is_admin via auth.uid() antes de executar.

create or replace function public.recalcular_todos()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Apenas administradores podem recalcular pontos.'
      using errcode = 'insufficient_privilege';
  end if;

  for r in select id from public.matches where status = 'finalizado' loop
    perform public.recalcular_pontos(r.id);
  end loop;
end; $$;

-- Grant permanece em authenticated — a guarda agora é interna à função.
-- Não-admins recebem erro 'insufficient_privilege' ao tentar chamar.
