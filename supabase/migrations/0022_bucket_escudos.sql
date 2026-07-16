-- supabase/migrations/0022_bucket_escudos.sql
-- 0022 — Bucket público `escudos`: espelha os escudos dos times (evita depender do
-- hotlink da FlashScore, que responde 403 para requisições diretas/datacenter).

insert into storage.buckets (id, name, public)
values ('escudos', 'escudos', true)
on conflict (id) do update set public = true;
