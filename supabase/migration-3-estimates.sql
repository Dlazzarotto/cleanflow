-- =============================================================
-- CleanFlow AI - Migracao 3: Estimates + configuracao de precos
-- Executar no SQL Editor do Supabase
-- =============================================================

create table if not exists public.pricing_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  hourly_rate numeric(10,2) not null default 55,
  min_price numeric(10,2) not null default 130,
  deep_multiplier numeric(4,2) not null default 1.5
);

create table if not exists public.estimates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  address text,
  city text,
  lat double precision,
  lng double precision,
  bedrooms int not null default 0,
  full_baths int not null default 0,
  half_baths int not null default 0,
  extras jsonb not null default '{}',        -- { cozinha: [taskIds], sala: [...] }
  bedroom_tasks jsonb not null default '[]', -- [taskIds]
  bathroom_tasks jsonb not null default '[]',
  laundry boolean not null default false,
  laundry_loads int not null default 0,
  deep_clean boolean not null default false,
  minutes int not null default 0,
  price_low numeric(10,2) not null default 0,
  price_high numeric(10,2) not null default 0,
  hourly_rate numeric(10,2) not null default 0,
  market_notes text,
  status text not null default 'rascunho'
    check (status in ('rascunho','enviado','aprovado','recusado')),
  created_at timestamptz not null default now()
);

create index if not exists estimates_company_idx on public.estimates(company_id);

alter table public.pricing_settings enable row level security;
alter table public.estimates enable row level security;

create policy "pricing_settings_all" on public.pricing_settings
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "estimates_all" on public.estimates
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
