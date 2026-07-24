-- =============================================================
-- CleanFlow AI - Migracao 14: coordenadas da sede da empresa
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.companies add column if not exists lat double precision;
alter table public.companies add column if not exists lng double precision;
