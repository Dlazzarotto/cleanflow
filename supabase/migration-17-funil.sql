-- =============================================================
-- CleanFlow AI - Migracao 17: funil (visita -> estimate -> recorrencia)
-- + base de marketing para leads que nao converteram
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Tipo do agendamento: limpeza ou visita de orcamento
alter table public.bookings
  add column if not exists type text not null default 'limpeza';

do $$ begin
  alter table public.bookings
    add constraint bookings_type_check check (type in ('limpeza','visita'));
exception when duplicate_object then null; end $$;

-- 2) Novo status de cliente: lead
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients
  add constraint clients_status_check
  check (status in ('lead','ativo','em_espera','inativo','deletado'));

-- 3) Campos de marketing / origem
alter table public.clients add column if not exists source text;              -- indicacao, google, instagram...
alter table public.clients add column if not exists marketing_opt_in boolean not null default true;
alter table public.clients add column if not exists lost_reason text;         -- por que nao fechou
alter table public.clients add column if not exists last_contact_at timestamptz;

-- 4) Estimate sabe se ja virou recorrencia
alter table public.estimates add column if not exists series_id uuid;
