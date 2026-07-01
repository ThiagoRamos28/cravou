alter table public.matches
  add column decisao text not null default 'normal'
    check (decisao in ('normal', 'prorrogacao', 'penaltis')),
  add column placar_penaltis_casa int,
  add column placar_penaltis_fora int;
