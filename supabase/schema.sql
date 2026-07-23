-- =============================================================
-- CleanFlow AI - Schema Fase 1 (MVP)
-- Multi-tenant SaaS: cada empresa de limpeza = 1 company
-- Executar no SQL Editor do Supabase
-- =============================================================

-- Extensoes
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------
-- 1) EMPRESAS (tenants)
-- -------------------------------------------------------------
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  phone text,
  email text,
  address text,
  plan text not null default 'starter' check (plan in ('starter','pro','enterprise')),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2) PERFIS (usuarios ligados ao auth.users)
-- -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role in ('owner','admin','supervisor','cleaner')),
  phone text,
  created_at timestamptz not null default now()
);

create index profiles_company_idx on public.profiles(company_id);

-- Funcao auxiliar: company do usuario logado
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- -------------------------------------------------------------
-- 3) CLIENTES (CRM)
-- -------------------------------------------------------------
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  address text,
  lat double precision,
  lng double precision,
  door_code text,
  has_pets boolean not null default false,
  pets_notes text,
  alarm_notes text,
  preferences text,          -- ex: "aspirar primeiro; nao limpar escritorio"
  products_notes text,       -- ex: "produto sem perfume"
  frequency text check (frequency in ('unica','semanal','quinzenal','mensal')),
  photos text[] not null default '{}',
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now()
);

create index clients_company_idx on public.clients(company_id);

-- -------------------------------------------------------------
-- 4) EQUIPES E MEMBROS
-- -------------------------------------------------------------
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null default '#13706B',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index teams_company_idx on public.teams(company_id);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, profile_id)
);

-- -------------------------------------------------------------
-- 5) SERVICOS (catalogo)
-- -------------------------------------------------------------
create table public.services (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,               -- ex: Limpeza padrao, Limpeza profunda
  base_price numeric(10,2) not null default 0,
  base_minutes int not null default 120,
  active boolean not null default true
);

create index services_company_idx on public.services(company_id);

-- -------------------------------------------------------------
-- 6) AGENDAMENTOS
-- -------------------------------------------------------------
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 120,
  price numeric(10,2) not null default 0,
  status text not null default 'agendado'
    check (status in ('orcamento','agendado','a_caminho','em_andamento','concluido','cancelado')),
  checkin_at timestamptz,
  checkout_at timestamptz,
  notes text,
  photos_after text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index bookings_company_idx on public.bookings(company_id);
create index bookings_date_idx on public.bookings(company_id, scheduled_at);

-- -------------------------------------------------------------
-- 7) PAGAMENTOS (estrutura; integracao Stripe na Fase 2)
-- -------------------------------------------------------------
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  method text check (method in ('stripe','square','zelle','ach','cartao','dinheiro','outro')),
  status text not null default 'pendente' check (status in ('pendente','pago','estornado')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_company_idx on public.payments(company_id);

-- -------------------------------------------------------------
-- 8) CONVERSAS DO BOT IA (historico por cliente/lead)
-- -------------------------------------------------------------
create table public.bot_conversations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  channel text not null default 'web' check (channel in ('web','whatsapp','sms','email')),
  messages jsonb not null default '[]',   -- [{role, content, at}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bot_conv_company_idx on public.bot_conversations(company_id);

-- =============================================================
-- RLS: isolamento total por empresa
-- =============================================================
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.bot_conversations enable row level security;

-- companies: usuario ve apenas a propria empresa
create policy "companies_select" on public.companies
  for select using (id = public.current_company_id());
create policy "companies_update" on public.companies
  for update using (id = public.current_company_id());

-- profiles: ver colegas da mesma empresa; editar o proprio
create policy "profiles_select" on public.profiles
  for select using (company_id = public.current_company_id());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

-- padrao para tabelas de dados: CRUD dentro da empresa
create policy "clients_all" on public.clients
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "teams_all" on public.teams
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "team_members_all" on public.team_members
  for all using (
    team_id in (select id from public.teams where company_id = public.current_company_id())
  );

create policy "services_all" on public.services
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "bookings_all" on public.bookings
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "payments_all" on public.payments
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "bot_conversations_all" on public.bot_conversations
  for all using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- =============================================================
-- SEED opcional para testes (crie o usuario no Auth primeiro,
-- depois rode com o id dele):
--
-- insert into companies (name, slug) values ('Demo Cleaning', 'demo');
-- insert into profiles (id, company_id, full_name, role)
--   values ('UUID-DO-AUTH-USER', (select id from companies where slug='demo'), 'Admin Demo', 'owner');
-- =============================================================
