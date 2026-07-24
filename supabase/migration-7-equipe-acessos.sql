-- =============================================================
-- CleanFlow AI - Migracao 7: vinculos multiempresa (memberships)
-- + acesso da equipe. Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Vinculos: uma pessoa pode pertencer a varias empresas
create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null default 'cleaner' check (role in ('owner','admin','supervisor','cleaner')),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_company_idx on public.memberships(company_id);

-- 2) Migra os perfis existentes para vinculos
insert into public.memberships (user_id, company_id, role, full_name, phone)
select id, company_id, role, full_name, phone from public.profiles
on conflict (user_id, company_id) do nothing;

-- 3) Empresa ativa por usuario (para quem tiver mais de um vinculo)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_company_id uuid references public.companies(id) on delete set null
);

insert into public.user_settings (user_id, active_company_id)
select id, company_id from public.profiles
on conflict (user_id) do nothing;

-- 4) Redefine a funcao usada por TODAS as policies de RLS
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select us.active_company_id
       from public.user_settings us
       join public.memberships m
         on m.user_id = us.user_id
        and m.company_id = us.active_company_id
        and m.active
      where us.user_id = auth.uid()),
    (select m.company_id
       from public.memberships m
      where m.user_id = auth.uid() and m.active
      order by m.created_at
      limit 1)
  );
$$;

-- 5) team_members passa a referenciar o usuario (auth), nao o perfil antigo
alter table public.team_members drop constraint if exists team_members_profile_id_fkey;
alter table public.team_members
  add constraint team_members_user_fkey
  foreign key (profile_id) references auth.users(id) on delete cascade;

-- 6) RLS dos vinculos
alter table public.memberships enable row level security;
alter table public.user_settings enable row level security;

do $$ begin
  create policy "memberships_select" on public.memberships
    for select using (user_id = auth.uid() or company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "memberships_admin_write" on public.memberships
    for update using (company_id = public.current_company_id())
    with check (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "user_settings_own" on public.user_settings
    for all using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- A tabela profiles fica preservada como legado (nao e mais usada pelo app).
