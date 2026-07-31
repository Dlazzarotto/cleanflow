-- =============================================================
-- CleanFlow AI - Migracao 22: planos Standard/Plus + limite de equipes
-- Executar no SQL Editor do Supabase (depois da migracao 21).
-- =============================================================

-- 1) Novos planos
alter table public.companies drop constraint if exists companies_plan_check;
update public.companies set plan = 'standard' where plan not in ('standard','plus');
alter table public.companies
  add constraint companies_plan_check check (plan in ('standard','plus'));

alter table public.companies alter column plan set default 'standard';

-- 2) Equipes extras contratadas (US$ 10 cada, so no Plus)
alter table public.companies add column if not exists extra_teams int not null default 0;

-- 3) Limite de equipes conforme o plano
create or replace function public.company_max_teams(p_company uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when plan = 'plus' then 2 + extra_teams else 1 end
    from public.companies where id = p_company;
$$;

-- 4) Trava: nao criar equipe acima do plano
create or replace function public.check_team_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_atual int;
begin
  select public.company_max_teams(new.company_id) into v_max;
  select count(*) into v_atual
    from public.teams
   where company_id = new.company_id and active;

  if v_atual >= v_max then
    raise exception 'Seu plano permite % equipe(s). Faça upgrade para adicionar mais.', v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_plan_limit on public.teams;
create trigger teams_plan_limit
  before insert on public.teams
  for each row execute function public.check_team_limit();

-- 5) Mensalidade calculada pelo plano
create or replace function public.company_monthly_fee(p_company uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when plan = 'plus' then 50 + (extra_teams * 10) else 30 end::numeric
    from public.companies where id = p_company;
$$;

-- 6) Aceite do contrato de uso da plataforma
create table if not exists public.terms_acceptances (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  full_name text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists terms_company_idx on public.terms_acceptances(company_id);

alter table public.terms_acceptances enable row level security;

do $$ begin
  create policy "terms_insert_own" on public.terms_acceptances
    for insert with check (user_id = auth.uid() and company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "terms_select" on public.terms_acceptances
    for select using (
      user_id = auth.uid()
      or (company_id = public.current_company_id() and public.is_manager())
      or public.is_platform_admin()
    );
exception when duplicate_object then null; end $$;

alter table public.companies add column if not exists terms_version text;
alter table public.companies add column if not exists terms_accepted_at timestamptz;
