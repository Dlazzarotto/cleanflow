-- =============================================================
-- CleanFlow AI - Migracao 53: planos Base / Pro / Plus
-- Executar no SQL Editor do Supabase.
--
-- Substitui os planos Standard/Plus (migration-22) e transforma o
-- modulo comercial (migration-47), que era vendido a parte, no que
-- define o plano Plus.
--
--   Base  US$ 30  - so residencial              - 1 equipe
--   Pro   US$ 60  - so residencial + relatorios  - 2 equipes
--   Plus  US$ 90  - residencial + comercial      - 3 equipes
--
-- CLIENTE E ILIMITADO EM TODOS OS PLANOS. Limitar cliente pune quem
-- cresce, e o concorrente direto (MaidPad) vende "Unlimited Clients"
-- ate no plano de entrada. A diferenca entre os planos e recurso,
-- equipe e acesso — nao tamanho de carteira.
--
-- Equipe adicional: US$ 19,99/mes em qualquer plano, com teto de
-- mensalidade: Base para em US$ 100, Pro em US$ 150, Plus sem teto.
--
-- Os mesmos numeros estao em src/lib/plans.ts (para a tela). Mudou
-- aqui -> mudar la. Quem manda de verdade e este arquivo: as travas
-- rodam no banco, nao na tela.
--
-- IMPORTANTE: rodar junto com o deploy. O 'plus' antigo virou 'pro',
-- entao o nome colide — entre o deploy e esta migration, uma empresa
-- no plus antigo aparece como Plus novo na tela (so cosmetico, as
-- travas abaixo so passam a existir depois que isto rodar).
-- =============================================================

-- -------------------------------------------------------------
-- 1) Migrar os dados ANTES de trocar o check constraint
-- -------------------------------------------------------------
-- Esta conversao so pode acontecer UMA vez: o 'plus' antigo (US$ 50, 2
-- equipes) vira 'pro', mas 'plus' tambem e o nome do plano novo. Rodar
-- duas vezes sem protecao rebaixaria todo Pro para Base.
-- A guarda e o proprio constraint: enquanto ele ainda aceitar 'standard',
-- estamos no modelo antigo. Depois da primeira execucao ele nao aceita
-- mais, e o bloco abaixo simplesmente nao roda. Pode reexecutar a vontade.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'companies_plan_check'
       and pg_get_constraintdef(oid) like '%standard%'
  ) then
    alter table public.companies drop constraint companies_plan_check;

    -- Quem tinha o modulo comercial sobe para Plus, independente do plano.
    -- O 'plus' antigo equivale ao Pro novo. Todo o resto vira Base.
    update public.companies
       set plan = case
         when coalesce(commercial_enabled, false) then 'plus'
         when plan = 'plus'                       then 'pro'
         else 'base'
       end;
  end if;
end $$;

alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies
  add constraint companies_plan_check check (plan in ('base','pro','plus'));

alter table public.companies alter column plan set default 'base';

-- commercial_enabled deixa de ser a assinatura do modulo e passa a ser
-- so uma excecao manual (liberar comercial sem subir de plano). Mantido
-- coerente: todo Plus tem, por definicao.
update public.companies set commercial_enabled = true where plan = 'plus';

-- -------------------------------------------------------------
-- 2) Limites por plano
-- -------------------------------------------------------------
create or replace function public.company_max_teams(p_company uuid)
returns int language sql stable security definer set search_path = public as $$
  select (case plan when 'plus' then 3 when 'pro' then 2 else 1 end)
         + coalesce(extra_teams, 0)
    from public.companies where id = p_company;
$$;

-- Mantida devolvendo null (= sem limite) para nao quebrar nada que a
-- chame. Se um dia voltar a existir teto de cliente, e aqui que muda.
create or replace function public.company_max_clients(p_company uuid)
returns int language sql stable security definer set search_path = public as $$
  select null::int from public.companies where id = p_company;
$$;

-- Plus tambem tem teto de acesso: 6.
create or replace function public.company_max_users(p_company uuid)
returns int language sql stable security definer set search_path = public as $$
  select case plan
           when 'plus' then 6
           when 'pro'  then 6
           else 2
         end
    from public.companies where id = p_company;
$$;

-- Mensalidade com TETO por plano:
--   Base  para em US$ 100
--   Pro   para em US$ 150
--   Plus  sem teto — quem cresce muito esta aqui, e ai o crescimento
--         vira receita. Sem teto no Base, o plano de entrada passaria
--         do teto do Pro, o que nao faria sentido.
create or replace function public.company_monthly_fee(p_company uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case c.plan
           when 'plus' then v.bruto
           when 'pro'  then least(v.bruto, 150::numeric)
           else             least(v.bruto, 100::numeric)
         end
    from public.companies c
    cross join lateral (
      select ((case c.plan when 'plus' then 90 when 'pro' then 60 else 30 end)
              + coalesce(c.extra_teams, 0) * 19.99)::numeric as bruto
    ) v
   where c.id = p_company;
$$;

-- -------------------------------------------------------------
-- 3) Comercial e relatorios seguem o plano
-- -------------------------------------------------------------
-- Plus inclui comercial. commercial_enabled fica como excecao manual,
-- para a plataforma liberar comercial sem subir o plano.
create or replace function public.has_commercial()
returns boolean language sql stable security definer set search_path = public as $func$
  select coalesce(
    (select plan = 'plus' or coalesce(commercial_enabled, false)
       from public.companies where id = public.current_company_id()),
    false
  );
$func$;

grant execute on function public.has_commercial() to authenticated;

-- Relatorios: Pro e Plus.
create or replace function public.has_reports()
returns boolean language sql stable security definer set search_path = public as $func$
  select coalesce(
    (select plan in ('pro','plus')
       from public.companies where id = public.current_company_id()),
    false
  );
$func$;

grant execute on function public.has_reports() to authenticated;

-- -------------------------------------------------------------
-- 4) Cliente nao tem teto
--
-- Nao existe trava de quantidade de cliente. Estes drops estao aqui
-- para o caso de uma versao anterior deste arquivo ja ter criado os
-- triggers no seu banco — assim reexecutar limpa o que ficou.
-- -------------------------------------------------------------
drop trigger if exists clients_plan_limit on public.clients;
drop trigger if exists clients_plan_limit_update on public.clients;
drop function if exists public.check_client_limit();

-- -------------------------------------------------------------
-- 5) Trava de acessos
--
-- Conta vinculos ativos da empresa. Reativar alguem que ja existe passa
-- pelo mesmo limite; sair e voltar nao burla.
-- -------------------------------------------------------------
create or replace function public.check_user_limit()
returns trigger language plpgsql security definer set search_path = public as $func$
declare
  v_max int;
  v_atual int;
begin
  select public.company_max_users(new.company_id) into v_max;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_atual
    from public.memberships
   where company_id = new.company_id
     and active
     and id is distinct from new.id;

  if v_atual >= v_max then
    raise exception
      'Seu plano permite % acesso(s). Faça upgrade para liberar mais pessoas.', v_max;
  end if;
  return new;
end;
$func$;

drop trigger if exists memberships_plan_limit on public.memberships;
create trigger memberships_plan_limit
  before insert on public.memberships
  for each row
  when (new.active)
  execute function public.check_user_limit();

drop trigger if exists memberships_plan_limit_update on public.memberships;
create trigger memberships_plan_limit_update
  before update on public.memberships
  for each row
  when (new.active and not old.active)
  execute function public.check_user_limit();

-- -------------------------------------------------------------
-- 6) Conferencia — rode depois para ver como ficou
-- -------------------------------------------------------------
-- select plan, count(*) from public.companies group by plan order by plan;
--
-- Empresas que ficaram acima do limite do plano novo (nada quebra: as
-- travas so valem para o proximo cadastro, o que ja existe continua
-- funcionando). Serve para voce decidir quem precisa subir de plano:
--
-- select c.name, c.plan,
--        (select count(*) from public.memberships m
--          where m.company_id = c.id and m.active) as acessos,
--        public.company_max_users(c.id) as limite_acessos
--   from public.companies c
--  order by c.name;
