-- =============================================================
-- CleanFlow AI - Migracao 49: tres visoes de dashboard
--
-- RESIDENCIAL — a operacao do dia: quem limpa o que, hoje
-- COMERCIAL   — contratos e qualidade: receita recorrente e inspecoes
-- GERAL       — o negocio: margem, produtividade e crescimento
--
-- Cada visao e uma funcao so, para a tela carregar rapido.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- ============ RESIDENCIAL ============
create or replace function public.dash_residencial()
returns table (
  limpezas_hoje int,
  concluidas_hoje int,
  previsto_hoje numeric,
  realizado_hoje numeric,
  clientes_ativos int,
  ticket_medio numeric,
  a_receber numeric,
  faturas_abertas int,
  proxima_semana int,
  sem_valor int,
  novos_no_mes int,
  perdidos_no_mes int
) language sql stable security definer set search_path = public as $func$
  with hoje as (
    select b.* from public.bookings b
      join public.clients c on c.id = b.client_id
     where b.company_id = public.current_company_id()
       and coalesce(c.client_type,'residencial') = 'residencial'
       and (b.scheduled_at at time zone 'America/New_York')::date
           = (now() at time zone 'America/New_York')::date
  ),
  res as (
    select * from public.clients
     where company_id = public.current_company_id()
       and coalesce(client_type,'residencial') = 'residencial'
  )
  select
    (select count(*)::int from hoje where status <> 'cancelado'),
    (select count(*)::int from hoje where status = 'concluido'),
    (select coalesce(sum(price),0) from hoje where status <> 'cancelado'),
    (select coalesce(sum(price),0) from hoje where status = 'concluido'),
    (select count(*)::int from res where status = 'ativo'),
    (select coalesce(round(avg(nullif(default_price,0)),2),0) from res where status = 'ativo'),
    (select coalesce(sum(i.amount),0) from public.invoices i
       join res r on r.id = i.client_id
      where i.status in ('aberta','vencida')),
    (select count(*)::int from public.invoices i
       join res r on r.id = i.client_id
      where i.status in ('aberta','vencida')),
    (select count(*)::int from public.bookings b
       join res r on r.id = b.client_id
      where b.scheduled_at > now()
        and b.scheduled_at < now() + interval '7 days'
        and b.status not in ('cancelado','concluido')),
    (select count(*)::int from public.bookings b
       join res r on r.id = b.client_id
      where b.scheduled_at > now() and coalesce(b.price,0) = 0
        and b.status not in ('cancelado','concluido')),
    (select count(*)::int from res
      where status = 'ativo' and created_at >= date_trunc('month', now())),
    (select count(*)::int from res
      where status in ('perdido','inativo')
        and coalesce(last_contact_at, created_at) >= date_trunc('month', now()))
  where public.is_manager();
$func$;

grant execute on function public.dash_residencial() to authenticated;

-- ============ COMERCIAL ============
create or replace function public.dash_comercial()
returns table (
  contratos_ativos int,
  receita_recorrente numeric,
  ticket_medio numeric,
  limpezas_mes int,
  concluidas_mes int,
  nota_media numeric,
  inspecoes_mes int,
  contratos_sem_inspecao int,
  a_receber numeric,
  pontos_criticos int,
  segmentos int,
  area_total int
) language sql stable security definer set search_path = public as $func$
  with com as (
    select * from public.clients
     where company_id = public.current_company_id()
       and client_type = 'comercial'
       and status = 'ativo'
  )
  select
    (select count(*)::int from com),
    (select coalesce(sum(
        case when billing_type = 'mensal_fixo' then coalesce(monthly_contract_value,0)
             else coalesce(default_price,0) *
                  case frequency
                    when 'semanal' then 4.3
                    when 'quinzenal' then 2.15
                    when 'tres_semanas' then 1.43
                    when 'mensal' then 1
                    else 1 end
        end), 0) from com),
    (select coalesce(round(avg(nullif(
        case when billing_type = 'mensal_fixo' then monthly_contract_value
             else default_price end, 0)), 2), 0) from com),
    (select count(*)::int from public.bookings b join com c on c.id = b.client_id
      where b.scheduled_at >= date_trunc('month', now()) and b.status <> 'cancelado'),
    (select count(*)::int from public.bookings b join com c on c.id = b.client_id
      where b.scheduled_at >= date_trunc('month', now()) and b.status = 'concluido'),
    (select coalesce(round(avg(i.percent), 1), 0) from public.inspections i
       join com c on c.id = i.client_id
      where i.status in ('concluida','enviada') and i.percent is not null),
    (select count(*)::int from public.inspections i join com c on c.id = i.client_id
      where i.created_at >= date_trunc('month', now())),
    (select count(*)::int from com c
      where not exists (
        select 1 from public.inspections i
         where i.client_id = c.id
           and i.created_at > now() - interval '60 days'
           and i.status in ('concluida','enviada')
      )),
    (select coalesce(sum(i.amount),0) from public.invoices i join com c on c.id = i.client_id
      where i.status in ('aberta','vencida')),
    (select count(*)::int from public.inspection_results r
       join public.inspections i on i.id = r.inspection_id
       join com c on c.id = i.client_id
      where r.rating is not null and r.rating <= 2
        and i.created_at > now() - interval '30 days'),
    (select count(distinct business_segment)::int from com where business_segment is not null),
    (select coalesce(sum(area_sqft),0)::int from com)
  where public.is_manager();
$func$;

grant execute on function public.dash_comercial() to authenticated;

-- ============ GERAL (o negocio) ============
create or replace function public.dash_geral()
returns table (
  receita_mes numeric,
  receita_residencial numeric,
  receita_comercial numeric,
  recebido_mes numeric,
  a_receber numeric,
  vencido numeric,
  horas_trabalhadas numeric,
  receita_por_hora numeric,
  limpezas_mes int,
  clientes_ativos int,
  clientes_residencial int,
  clientes_comercial int,
  pessoas_ativas int,
  equipes int,
  ocorrencias_abertas int,
  novos_clientes_mes int,
  mes_anterior numeric
) language sql stable security definer set search_path = public as $func$
  with base as (
    select b.*, coalesce(c.client_type,'residencial') as tipo
      from public.bookings b
      left join public.clients c on c.id = b.client_id
     where b.company_id = public.current_company_id()
  )
  select
    (select coalesce(sum(price),0) from base
      where status = 'concluido' and scheduled_at >= date_trunc('month', now())),
    (select coalesce(sum(price),0) from base
      where status = 'concluido' and tipo = 'residencial'
        and scheduled_at >= date_trunc('month', now())),
    (select coalesce(sum(price),0) from base
      where status = 'concluido' and tipo = 'comercial'
        and scheduled_at >= date_trunc('month', now())),
    (select coalesce(sum(amount),0) from public.invoices
      where company_id = public.current_company_id() and status = 'paga'
        and paid_at >= date_trunc('month', now())),
    (select coalesce(sum(amount),0) from public.invoices
      where company_id = public.current_company_id() and status in ('aberta','vencida')),
    (select coalesce(sum(amount),0) from public.invoices
      where company_id = public.current_company_id() and status = 'vencida'),
    (select coalesce(round(sum(extract(epoch from (ended_at - started_at)) / 3600)::numeric, 1), 0)
       from public.work_shifts
      where company_id = public.current_company_id()
        and ended_at is not null and started_at >= date_trunc('month', now())),
    (select case when h > 0 then round(r / h, 2) else 0 end from (
       select
         (select coalesce(sum(extract(epoch from (ended_at - started_at)) / 3600), 0)
            from public.work_shifts
           where company_id = public.current_company_id()
             and ended_at is not null and started_at >= date_trunc('month', now()))::numeric as h,
         (select coalesce(sum(price),0) from base
           where status = 'concluido' and scheduled_at >= date_trunc('month', now()))::numeric as r
     ) x),
    (select count(*)::int from base
      where status = 'concluido' and scheduled_at >= date_trunc('month', now())),
    (select count(*)::int from public.clients
      where company_id = public.current_company_id() and status = 'ativo'),
    (select count(*)::int from public.clients
      where company_id = public.current_company_id() and status = 'ativo'
        and coalesce(client_type,'residencial') = 'residencial'),
    (select count(*)::int from public.clients
      where company_id = public.current_company_id() and status = 'ativo'
        and client_type = 'comercial'),
    (select count(*)::int from public.memberships
      where company_id = public.current_company_id() and active),
    (select count(*)::int from public.teams
      where company_id = public.current_company_id() and active),
    (select count(*)::int from public.incidents
      where company_id = public.current_company_id() and status <> 'resolvida'),
    (select count(*)::int from public.clients
      where company_id = public.current_company_id()
        and status = 'ativo' and created_at >= date_trunc('month', now())),
    (select coalesce(sum(price),0) from base
      where status = 'concluido'
        and scheduled_at >= date_trunc('month', now()) - interval '1 month'
        and scheduled_at < date_trunc('month', now()))
  where public.is_manager();
$func$;

grant execute on function public.dash_geral() to authenticated;

-- ============ Evolucao de 6 meses, para o grafico ============
create or replace function public.dash_evolucao()
returns table (mes date, residencial numeric, comercial numeric, limpezas int)
language sql stable security definer set search_path = public as $func$
  with meses as (
    select generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month')::date as mes
    where public.is_manager()
  )
  select
    m.mes,
    (select coalesce(sum(b.price),0) from public.bookings b
       left join public.clients c on c.id = b.client_id
      where b.company_id = public.current_company_id() and b.status = 'concluido'
        and coalesce(c.client_type,'residencial') = 'residencial'
        and date_trunc('month', b.scheduled_at)::date = m.mes),
    (select coalesce(sum(b.price),0) from public.bookings b
       join public.clients c on c.id = b.client_id
      where b.company_id = public.current_company_id() and b.status = 'concluido'
        and c.client_type = 'comercial'
        and date_trunc('month', b.scheduled_at)::date = m.mes),
    (select count(*)::int from public.bookings b
      where b.company_id = public.current_company_id() and b.status = 'concluido'
        and date_trunc('month', b.scheduled_at)::date = m.mes)
  from meses m order by m.mes;
$func$;

grant execute on function public.dash_evolucao() to authenticated;

-- Conferencia
select 'residencial' as visao, * from public.dash_residencial();
