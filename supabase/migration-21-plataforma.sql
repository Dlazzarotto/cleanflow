-- =============================================================
-- CleanFlow AI - Migracao 21: camada da PLATAFORMA
-- Separa "administrador do sistema" (CleanFlow) de "dono da empresa".
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Administradores da plataforma (CleanFlow)
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

do $$ begin
  create policy "platform_admins_read" on public.platform_admins
    for select using (user_id = auth.uid() or public.is_platform_admin());
exception when duplicate_object then null; end $$;

-- 2) Dados comerciais da conta de cada empresa
alter table public.companies add column if not exists representative_name text;
alter table public.companies add column if not exists website text;
alter table public.companies add column if not exists platform_notes text;
alter table public.companies add column if not exists monthly_fee numeric(10,2) not null default 0;
alter table public.companies add column if not exists next_due_date date;
alter table public.companies add column if not exists signed_up_at timestamptz default now();

alter table public.companies add column if not exists account_status text not null default 'ativa';
do $$ begin
  alter table public.companies
    add constraint companies_account_status_check
    check (account_status in ('teste','ativa','suspensa','cancelada'));
exception when duplicate_object then null; end $$;

alter table public.companies add column if not exists billing_status text not null default 'em_dia';
do $$ begin
  alter table public.companies
    add constraint companies_billing_status_check
    check (billing_status in ('em_dia','pendente','atrasado','isento'));
exception when duplicate_object then null; end $$;

-- 3) A plataforma enxerga e administra as CONTAS (nao os dados dos clientes)
drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies
  for select using (id = public.current_company_id() or public.is_platform_admin());

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update using (
    (id = public.current_company_id() and public.is_manager()) or public.is_platform_admin()
  )
  with check (
    (id = public.current_company_id() and public.is_manager()) or public.is_platform_admin()
  );

do $$ begin
  create policy "companies_insert_platform" on public.companies
    for insert with check (public.is_platform_admin());
exception when duplicate_object then null; end $$;

-- 4) Acessos: a plataforma resolve problemas de login/papel
drop policy if exists "memberships_select" on public.memberships;
create policy "memberships_select" on public.memberships
  for select using (
    user_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_manager())
    or public.is_platform_admin()
  );

drop policy if exists "memberships_admin_write" on public.memberships;
create policy "memberships_admin_write" on public.memberships
  for update using (
    (company_id = public.current_company_id() and public.is_manager()) or public.is_platform_admin()
  )
  with check (
    (company_id = public.current_company_id() and public.is_manager()) or public.is_platform_admin()
  );

-- 5) Numeros agregados por empresa — SEM expor dados de clientes
create or replace function public.platform_company_stats()
returns table (
  company_id uuid,
  users_count int,
  clients_count int,
  bookings_month int,
  last_activity timestamptz
) language sql stable security definer set search_path = public as $$
  select
    c.id,
    (select count(*)::int from public.memberships m where m.company_id = c.id and m.active),
    (select count(*)::int from public.clients cl where cl.company_id = c.id and cl.status <> 'deletado'),
    (select count(*)::int from public.bookings b
      where b.company_id = c.id and b.scheduled_at >= date_trunc('month', now())),
    (select max(b.created_at) from public.bookings b where b.company_id = c.id)
  from public.companies c
  where public.is_platform_admin();
$$;

grant execute on function public.platform_company_stats() to authenticated;

-- 6) Conta suspensa: bloqueia a operacao da empresa (leitura de dados)
create or replace function public.company_is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select account_status in ('ativa','teste') from public.companies where id = public.current_company_id()),
    false
  );
$$;
