-- =============================================================
-- CleanFlow AI - Migracao 38: marketing DA PLATAFORMA
-- Captacao de empresas de limpeza para assinar o CleanFlow.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Campanhas da plataforma
create table if not exists public.platform_campaigns (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  partner_name text,
  channel text,
  commission_type text not null default 'por_assinatura'
    check (commission_type in ('por_assinatura','por_lead','recorrente_pct','sem_comissao')),
  commission_value numeric(10,2) not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.platform_campaigns enable row level security;

do $$ begin
  create policy "platform_campaigns_admin" on public.platform_campaigns
    for all using (public.is_platform_admin())
    with check (public.is_platform_admin());
exception when duplicate_object then null; end $$;

-- 2) Visitas ao link
create table if not exists public.platform_visits (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.platform_campaigns(id) on delete cascade,
  visitor_key text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists pvisits_campaign_idx on public.platform_visits(campaign_id, created_at desc);
alter table public.platform_visits enable row level security;

do $$ begin
  create policy "platform_visits_admin" on public.platform_visits
    for select using (public.is_platform_admin());
exception when duplicate_object then null; end $$;

-- 3) Empresas interessadas (leads da plataforma)
create table if not exists public.platform_leads (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.platform_campaigns(id) on delete set null,
  company_name text not null,
  contact_name text not null,
  phone text,
  email text,
  city text,
  teams_count text,
  current_system text,
  notes text,
  status text not null default 'novo'
    check (status in ('novo','contatado','demonstracao','teste','assinante','perdido')),
  lost_reason text,
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pleads_status_idx on public.platform_leads(status, created_at desc);
alter table public.platform_leads enable row level security;

do $$ begin
  create policy "platform_leads_admin" on public.platform_leads
    for all using (public.is_platform_admin())
    with check (public.is_platform_admin());
exception when duplicate_object then null; end $$;

-- 4) Registro publico de visita
create or replace function public.register_platform_visit(
  p_slug text, p_visitor text default null, p_referrer text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.platform_campaigns where slug = p_slug and active;
  if v_id is null then return false; end if;

  if p_visitor is not null and exists (
    select 1 from public.platform_visits
     where campaign_id = v_id and visitor_key = p_visitor
       and created_at > now() - interval '24 hours'
  ) then
    return true;
  end if;

  insert into public.platform_visits (campaign_id, visitor_key, referrer)
  values (v_id, p_visitor, p_referrer);
  return true;
end;
$$;

grant execute on function public.register_platform_visit(text, text, text) to anon, authenticated;

-- 5) Cadastro publico de empresa interessada
create or replace function public.create_platform_lead(
  p_slug text,
  p_company text,
  p_contact text,
  p_phone text,
  p_email text default null,
  p_city text default null,
  p_teams text default null,
  p_system text default null,
  p_notes text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_campaign uuid;
begin
  select id into v_campaign from public.platform_campaigns where slug = p_slug and active;

  if coalesce(trim(p_company), '') = '' or coalesce(trim(p_contact), '') = '' then
    return false;
  end if;

  insert into public.platform_leads
    (campaign_id, company_name, contact_name, phone, email, city, teams_count, current_system, notes)
  values (
    v_campaign, trim(p_company), trim(p_contact),
    nullif(trim(coalesce(p_phone,'')), ''), nullif(trim(coalesce(p_email,'')), ''),
    nullif(trim(coalesce(p_city,'')), ''), nullif(trim(coalesce(p_teams,'')), ''),
    nullif(trim(coalesce(p_system,'')), ''), nullif(trim(coalesce(p_notes,'')), '')
  );
  return true;
end;
$$;

grant execute on function public.create_platform_lead(text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- 6) Resultado das campanhas da plataforma
create or replace function public.platform_campaign_stats()
returns table (
  campaign_id uuid, slug text, name text, partner_name text, channel text, active boolean,
  commission_type text, commission_value numeric,
  visits int, leads int, em_negociacao int, assinantes int, perdidos int,
  mrr_gerado numeric, comissao numeric
) language sql stable security definer set search_path = public as $$
  select
    c.id, c.slug, c.name, c.partner_name, c.channel, c.active,
    c.commission_type, c.commission_value,
    (select count(*)::int from public.platform_visits v where v.campaign_id = c.id),
    (select count(*)::int from public.platform_leads l where l.campaign_id = c.id),
    (select count(*)::int from public.platform_leads l
      where l.campaign_id = c.id and l.status in ('novo','contatado','demonstracao','teste')),
    (select count(*)::int from public.platform_leads l
      where l.campaign_id = c.id and l.status = 'assinante'),
    (select count(*)::int from public.platform_leads l
      where l.campaign_id = c.id and l.status = 'perdido'),
    (select coalesce(sum(co.monthly_fee), 0) from public.platform_leads l
      join public.companies co on co.id = l.company_id
      where l.campaign_id = c.id and co.account_status = 'ativa'),
    case c.commission_type
      when 'por_assinatura' then
        c.commission_value * (select count(*) from public.platform_leads l
          where l.campaign_id = c.id and l.status = 'assinante')
      when 'por_lead' then
        c.commission_value * (select count(*) from public.platform_leads l where l.campaign_id = c.id)
      when 'recorrente_pct' then
        (c.commission_value / 100.0) * (select coalesce(sum(co.monthly_fee), 0)
          from public.platform_leads l join public.companies co on co.id = l.company_id
          where l.campaign_id = c.id and co.account_status = 'ativa')
      else 0
    end
  from public.platform_campaigns c
  where public.is_platform_admin();
$$;

grant execute on function public.platform_campaign_stats() to authenticated;
