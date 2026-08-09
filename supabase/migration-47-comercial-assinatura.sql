-- =============================================================
-- CleanFlow AI - Migracao 47: limpeza comercial e um modulo pago
--
-- Quem assina o CleanFlow normal (Standard/Plus) atende so
-- residencial. O modulo comercial e contratado a parte e
-- liberado pela plataforma.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Modulo por empresa
alter table public.companies add column if not exists commercial_enabled boolean not null default false;
alter table public.companies add column if not exists commercial_price numeric(10,2) not null default 20;
alter table public.companies add column if not exists commercial_since timestamptz;

-- 2) A empresa tem o modulo?
create or replace function public.has_commercial()
returns boolean language sql stable security definer set search_path = public as $func$
  select coalesce(
    (select commercial_enabled from public.companies where id = public.current_company_id()),
    false
  );
$func$;

grant execute on function public.has_commercial() to authenticated;

-- 3) Trava no banco: sem o modulo, ninguem cria ou converte cliente comercial
create or replace function public.guard_commercial_client()
returns trigger language plpgsql security definer set search_path = public as $func$
begin
  if new.client_type = 'comercial'
     and (tg_op = 'INSERT' or coalesce(old.client_type,'residencial') <> 'comercial')
     and not public.has_commercial() then
    raise exception 'O módulo de limpeza comercial não está contratado. Fale com o CleanFlow para ativar.';
  end if;
  return new;
end;
$func$;

drop trigger if exists clients_guard_commercial on public.clients;
create trigger clients_guard_commercial
  before insert or update on public.clients
  for each row execute function public.guard_commercial_client();

-- 4) O catalogo de areas so aparece para quem tem o modulo
drop policy if exists "comm_areas_read" on public.commercial_areas;
do $$ begin
  create policy "comm_areas_read" on public.commercial_areas
    for select using (company_id = public.current_company_id() and public.has_commercial());
exception when duplicate_object then null; end $$;

-- 5) Mensalidade passa a somar o modulo
create or replace function public.company_monthly_fee(p_company uuid)
returns numeric language sql stable security definer set search_path = public as $func$
  select (case when plan = 'plus' then 50 + (extra_teams * 10) else 30 end)
         + (case when commercial_enabled then coalesce(commercial_price, 20) else 0 end)
    from public.companies where id = p_company;
$func$;

-- 6) Wait Happy ja tem clientes comerciais: libera para nao travar a operacao
update public.companies
   set commercial_enabled = true,
       commercial_since = now(),
       commercial_price = 0   -- cortesia por ser a empresa piloto
 where id = (select id from public.companies order by created_at limit 1);

-- 7) Conferencia
select name, plan, commercial_enabled, commercial_price, monthly_fee
  from public.companies order by created_at;

-- =============================================================
-- 8) As metricas da plataforma passam a mostrar o modulo
-- =============================================================
create or replace function public.platform_metrics()
returns table (
  company_id uuid, company_name text, city text,
  lat double precision, lng double precision,
  plan text, extra_teams int, monthly_fee numeric,
  account_status text, billing_status text,
  signed_up_at timestamptz, next_due_date date,
  users_count int, teams_count int,
  clients_active int, clients_total int,
  bookings_month int, bookings_done_month int,
  revenue_month numeric, invoices_open int, invoices_open_amount numeric,
  incidents_open int, last_activity timestamptz, last_login timestamptz,
  commercial_enabled boolean, commercial_price numeric, clients_commercial int
) language sql stable security definer set search_path = public as $func$
  select
    c.id, c.name,
    nullif(split_part(coalesce(c.address, ''), ',', 2), '') as city,
    c.lat, c.lng,
    c.plan, c.extra_teams, c.monthly_fee,
    c.account_status, c.billing_status, c.signed_up_at, c.next_due_date,
    (select count(*)::int from public.memberships m where m.company_id = c.id and m.active),
    (select count(*)::int from public.teams t where t.company_id = c.id and t.active),
    (select count(*)::int from public.clients cl where cl.company_id = c.id and cl.status = 'ativo'),
    (select count(*)::int from public.clients cl where cl.company_id = c.id and cl.status <> 'deletado'),
    (select count(*)::int from public.bookings b
      where b.company_id = c.id and b.scheduled_at >= date_trunc('month', now())),
    (select count(*)::int from public.bookings b
      where b.company_id = c.id and b.status = 'concluido'
        and b.scheduled_at >= date_trunc('month', now())),
    (select coalesce(sum(b.price), 0) from public.bookings b
      where b.company_id = c.id and b.status = 'concluido'
        and b.scheduled_at >= date_trunc('month', now())),
    (select count(*)::int from public.invoices i
      where i.company_id = c.id and i.status in ('aberta','vencida')),
    (select coalesce(sum(i.amount), 0) from public.invoices i
      where i.company_id = c.id and i.status in ('aberta','vencida')),
    (select count(*)::int from public.incidents inc
      where inc.company_id = c.id and inc.status <> 'resolvida'),
    (select max(b.created_at) from public.bookings b where b.company_id = c.id),
    (select max(m.last_seen_at) from public.memberships m where m.company_id = c.id),
    c.commercial_enabled, c.commercial_price,
    (select count(*)::int from public.clients cl
      where cl.company_id = c.id and cl.client_type = 'comercial' and cl.status <> 'deletado')
  from public.companies c
  where public.is_platform_admin();
$func$;

grant execute on function public.platform_metrics() to authenticated;
