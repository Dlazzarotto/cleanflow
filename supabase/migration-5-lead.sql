-- =============================================================
-- CleanFlow AI - Migracao 5: dados do lead no estimate
-- Executar no SQL Editor do Supabase
-- =============================================================

alter table public.estimates add column if not exists lead_name text;
alter table public.estimates add column if not exists lead_phone text;
alter table public.estimates add column if not exists lead_email text;
