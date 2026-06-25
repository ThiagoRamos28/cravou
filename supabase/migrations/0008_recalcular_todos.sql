-- Fase 7 — Função pública para recalcular pontos de todos os jogos finalizados.
-- SECURITY DEFINER permite chamar recalcular_pontos internamente (revogada de authenticated).
create or replace function public.recalcular_todos()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in select id from public.matches where status = 'finalizado' loop
    perform public.recalcular_pontos(r.id);
  end loop;
end; $$;

-- Admin check é feito no Next.js via requireAdmin(); DB expõe a qualquer autenticado.
grant execute on function public.recalcular_todos() to authenticated;
