-- =============================================================
-- CleanFlow AI - Migracao 37: links de campanha e conversao
-- Cada parceiro de midia recebe um link proprio; o sistema conta
-- acessos, leads e fechamentos para calcular a comissao.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Campanhas / links
create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null,
  name text not null,
  partner_name text,
  channel text,
  owner_user_id uuid references auth.users(id) on delete set null,
  commission_type text not null default 'por_fechamento'
    check (commission_type in ('por_fechamento','por_lead','percentual','sem_comissao')),
  commission_value numeric(10,2) not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (slug)
);

create index if not exists campaigns_company_idx on public.campaigns(company_id);

alter table public.campaigns enable row level security;

do $$ begin
  create policy "campaigns_manager" on public.campaigns
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- Parceiro/marketing enxerga as campanhas das quais e responsavel
do $$ begin
  create policy "campaigns_owner_read" on public.campaigns
    for select using (
      company_id = public.current_company_id() and owner_user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

-- 2) Visitas ao link
create table if not exists public.campaign_visits (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  visitor_key text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists visits_campaign_idx on public.campaign_visits(campaign_id, created_at desc);

alter table public.campaign_visits enable row level security;

do $$ begin
  create policy "visits_read" on public.campaign_visits
    for select using (
      company_id = public.current_company_id()
      and (public.is_manager()
           or campaign_id in (select id from public.campaigns where owner_user_id = auth.uid()))
    );
exception when duplicate_object then null; end $$;

-- 3) Cliente sabe de qual campanha veio
alter table public.clients add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
create index if not exists clients_campaign_idx on public.clients(campaign_id);

-- 4) Registro publico da visita (sem login)
create or replace function public.register_campaign_visit(
  p_slug text,
  p_visitor text default null,
  p_referrer text default null,
  p_agent text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_company uuid;
begin
  select id, company_id into v_id, v_company
    from public.campaigns where slug = p_slug and active;
  if v_id is null then
    return null;
  end if;

  -- Nao conta a mesma pessoa duas vezes no mesmo dia
  if p_visitor is not null and exists (
    select 1 from public.campaign_visits
     where campaign_id = v_id and visitor_key = p_visitor
       and created_at > now() - interval '24 hours'
  ) then
    return v_id;
  end if;

  insert into public.campaign_visits (campaign_id, company_id, visitor_key, referrer, user_agent)
  values (v_id, v_company, p_visitor, p_referrer, p_agent);

  return v_id;
end;
$$;

grant execute on function public.register_campaign_visit(text, text, text, text) to anon, authenticated;

-- 5) Cadastro publico de interessado vindo do link
create or replace function public.create_campaign_lead(
  p_slug text,
  p_name text,
  p_phone text,
  p_email text default null,
  p_address text default null,
  p_notes text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_campaign uuid; v_company uuid;
begin
  select id, company_id into v_campaign, v_company
    from public.campaigns where slug = p_slug and active;
  if v_campaign is null then
    return false;
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    return false;
  end if;

  insert into public.clients
    (company_id, full_name, phone, email, address, preferences,
     status, entry_source, source, campaign_id, created_by)
  values (
    v_company, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email,'')), ''),
    nullif(trim(coalesce(p_address,'')), ''), nullif(trim(coalesce(p_notes,'')), ''),
    'lead', 'marketing',
    (select coalesce(channel, name) from public.campaigns where id = v_campaign),
    v_campaign,
    (select owner_user_id from public.campaigns where id = v_campaign)
  );

  return true;
end;
$$;

grant execute on function public.create_campaign_lead(text, text, text, text, text, text) to anon, authenticated;

-- 6) Resultado de cada campanha (visitas, leads, fechamentos, comissao)
create or replace function public.campaign_stats()
returns table (
  campaign_id uuid,
  slug text,
  name text,
  partner_name text,
  channel text,
  active boolean,
  commission_type text,
  commission_value numeric,
  visits int,
  leads int,
  em_aberto int,
  fechados int,
  perdidos int,
  receita_fechada numeric,
  comissao numeric
) language sql stable security definer set search_path = public as $$
  select
    c.id, c.slug, c.name, c.partner_name, c.channel, c.active,
    c.commission_type, c.commission_value,
    (select count(*)::int from public.campaign_visits v where v.campaign_id = c.id),
    (select count(*)::int from public.clients cl where cl.campaign_id = c.id),
    (select count(*)::int from public.clients cl
      where cl.campaign_id = c.id and cl.status in ('lead','em_espera')),
    (select count(*)::int from public.clients cl
      where cl.campaign_id = c.id and cl.status = 'ativo'),
    (select count(*)::int from public.clients cl
      where cl.campaign_id = c.id and cl.status in ('perdido','inativo')),
    (select coalesce(sum(cl.default_price), 0) from public.clients cl
      where cl.campaign_id = c.id and cl.status = 'ativo'),
    case c.commission_type
      when 'por_fechamento' then
        c.commission_value * (select count(*) from public.clients cl
          where cl.campaign_id = c.id and cl.status = 'ativo')
      when 'por_lead' then
        c.commission_value * (select count(*) from public.clients cl where cl.campaign_id = c.id)
      when 'percentual' then
        (c.commission_value / 100.0) * (select coalesce(sum(cl.default_price), 0)
          from public.clients cl where cl.campaign_id = c.id and cl.status = 'ativo')
      else 0
    end
  from public.campaigns c
  where c.company_id = public.current_company_id()
    and (public.is_manager() or c.owner_user_id = auth.uid());
$$;

grant execute on function public.campaign_stats() to authenticated;
