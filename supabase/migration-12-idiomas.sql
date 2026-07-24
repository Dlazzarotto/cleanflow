-- =============================================================
-- CleanFlow AI - Migracao 12: idioma do cliente (documentos)
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients
  add column if not exists language text not null default 'pt'
  check (language in ('pt','en','es','fr'));

alter table public.estimates
  add column if not exists language text not null default 'pt'
  check (language in ('pt','en','es','fr'));
