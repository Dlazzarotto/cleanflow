-- =============================================================
-- CleanFlow AI - Migracao 4: documento de estimate + contrato
-- Executar no SQL Editor do Supabase
-- =============================================================

alter table public.estimates
  add column if not exists frequency text
    check (frequency in ('unica','semanal','quinzenal','mensal'));

alter table public.estimates
  add column if not exists final_price numeric(10,2);

alter table public.pricing_settings
  add column if not exists cancel_notice_hours int not null default 48;

alter table public.pricing_settings
  add column if not exists lockout_fee numeric(10,2) not null default 70;

alter table public.pricing_settings
  add column if not exists termination_notice_days int not null default 30;

alter table public.pricing_settings
  add column if not exists solicitation_fee numeric(10,2) not null default 2500;
