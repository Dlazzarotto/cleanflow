-- =============================================================
-- CleanFlow AI - Migracao 36: metricas e mapa da plataforma
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- Metricas agregadas por empresa (sem expor dados de clientes)
create or replace function public.platform_metrics()
returns table (
  company_id uuid,
  company_name text,
  city text,
  lat double precision,
  lng double precision,
  plan text,
  extra_teams int,
  monthly_fee numeric,
  account_status text,
  billing_status text,
  signed_up_at timestamptz,
  next_due_date date,
  users_count int,
  teams_count int,
  clients_active int,
  clients_total int,
  bookings_month int,
  bookings_done_month int,
  revenue_month numeric,
  invoices_open int,
  invoices_open_amount numeric,
  incidents_open int,
  last_activity timestamptz,
  last_login timestamptz
) language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
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
    (select max(m.last_seen_at) from public.memberships m where m.company_id = c.id)
  from public.companies c
  where public.is_platform_admin();
$$;

grant execute on function public.platform_metrics() to authenticated;

-- Evolucao mensal da plataforma (novas contas e volume de servico)
create or replace function public.platform_growth()
returns table (mes date, novas_empresas int, limpezas int, empresas_ativas int)
language sql stable security definer set search_path = public as $$
  with meses as (
    select generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    )::date as mes
    where public.is_platform_admin()
  )
  select
    m.mes,
    (select count(*)::int from public.companies c
      where date_trunc('month', coalesce(c.signed_up_at, c.created_at))::date = m.mes),
    (select count(*)::int from public.bookings b
      where date_trunc('month', b.scheduled_at)::date = m.mes),
    (select count(*)::int from public.companies c
      where coalesce(c.signed_up_at, c.created_at)::date <= (m.mes + interval '1 month')::date
        and c.account_status in ('ativa','teste'))
  from meses m
  order by m.mes;
$$;

grant execute on function public.platform_growth() to authenticated;
