-- =============================================================
-- CleanFlow AI - Migracao 2: series recorrentes
-- Executar no SQL Editor do Supabase
-- =============================================================

alter table public.bookings add column if not exists series_id uuid;
create index if not exists bookings_series_idx on public.bookings(series_id);
