-- =============================================================
-- CleanFlow AI - Migracao 13: preferencias de configuracao
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.user_settings
  add column if not exists locale text not null default 'pt'
  check (locale in ('pt','en','es','fr'));
