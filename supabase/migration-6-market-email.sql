-- =============================================================
-- CleanFlow AI - Migracao 6: cache da pesquisa de mercado
-- Executar no SQL Editor do Supabase
-- =============================================================

create table if not exists public.market_cache (
  company_id uuid not null references public.companies(id) on delete cascade,
  city_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (company_id, city_key)
);

alter table public.market_cache enable row level security;

do $$ begin
  create policy "market_cache_all" on public.market_cache
    for all using (company_id = public.current_company_id())
    with check (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;
