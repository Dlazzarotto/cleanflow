-- =============================================================
-- CleanFlow AI - Conferencia ANTES e DEPOIS das migrations 47/52-56
--
-- NAO e uma migration: nao altera nada, so consulta. Pode rodar a
-- vontade, inclusive no meio do processo.
--
-- COMO USAR
--   1. Rode a PARTE 1 antes de qualquer migration e guarde o resultado.
--   2. Rode as migrations: 47, 52, 53, 55, 56 (a 54 esta vazia).
--   3. Rode a PARTE 2 e compare com o que voce guardou.
--
-- ANTES DE COMECAR: tire um backup. No Supabase, Database > Backups.
-- A conversao de papel e de plano nao tem volta — 'owner' vira 'admin'
-- e o 'plus' antigo vira 'pro', e nao da para saber depois qual era qual.
-- =============================================================


-- =============================================================
-- PARTE 1 — ANTES
-- =============================================================
\echo '########## PARTE 1 — ANTES ##########'

\echo '=== 1.1 Quais migrations ja rodaram (funcoes existentes) ==='
select
  proname as funcao,
  'ja existe' as situacao
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('is_admin','is_field','can_see_values','sees_team','my_team_ids',
                   'guard_last_admin','has_reports','company_max_users','company_max_clients')
 order by proname;
-- Vazio = nenhuma das novas rodou ainda. Se aparecer alguma, aquela
-- migration ja foi aplicada (no todo ou em parte).

\echo ''
\echo '=== 1.2 Planos de hoje ==='
select plan, count(*) as empresas from public.companies group by plan order by plan;
-- Esperado antes: standard e/ou plus (nomes antigos).

\echo ''
\echo '=== 1.3 Papeis de hoje ==='
select role, count(*) as pessoas from public.memberships where active group by role order by role;
-- Esperado antes: owner, admin, supervisor, cleaner, marketing.

\echo ''
\echo '=== 1.4 Quem vira o que (simulacao — nao altera nada) ==='
select role as antes,
       case role
         when 'owner'   then 'admin'
         when 'admin'   then 'manager'
         when 'cleaner' then 'helper'
         else role
       end as depois,
       count(*) as pessoas
  from public.memberships where active
 group by 1, 2 order by 1;

\echo ''
\echo '=== 1.5 Empresas que viram Plus (tem comercial hoje) ==='
select name, plan as plano_hoje, commercial_enabled
  from public.companies
 where coalesce(commercial_enabled, false)
 order by name;

\echo ''
\echo '=== 1.6 A migration-47 aplicou inteira? ==='
select case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'platform_metrics'  -- funcao que devolve table
       ) or exists (
         select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'platform_metrics'
            and pg_get_function_result(p.oid) like '%commercial_enabled%'
       )
       then 'SIM — platform_metrics ja tem as colunas do comercial'
       else 'NAO — a secao 8 da migration-47 nunca aplicou. Rode a 47 corrigida.'
       end as situacao;

\echo ''
\echo '=== 1.7 Toda empresa tem alguem que vira admin? ==='
select c.name as empresa_sem_futuro_admin
  from public.companies c
 where not exists (
   select 1 from public.memberships m
    where m.company_id = c.id and m.active and m.role in ('owner','admin')
 )
 order by c.name;
-- IMPORTANTE: se vier alguma linha, resolva ANTES da migration-56.
-- Depois que guard_last_admin() existe, empresa sem admin nao se
-- conserta sozinha.


-- =============================================================
-- PARTE 2 — DEPOIS
-- =============================================================
\echo '########## PARTE 2 — DEPOIS ##########'

\echo ''
\echo '=== 2.1 As funcoes novas existem? ==='
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in
 ('current_company_id','is_manager','is_admin','is_field','can_see_values','sees_team',
  'my_permissions','guard_last_admin','has_commercial','has_reports','current_mode',
  'company_max_clients','company_max_users','company_max_teams','company_monthly_fee')
 order by proname;
-- Devem aparecer as 15. Faltando alguma, a migration correspondente nao rodou.

\echo ''
\echo '=== 2.2 Planos convertidos ==='
select plan, count(*) as empresas from public.companies group by plan order by plan;
-- Esperado: so base, pro e plus.

\echo ''
\echo '=== 2.3 Papeis convertidos ==='
select role, count(*) as pessoas from public.memberships where active group by role order by role;
-- Esperado: admin, manager, supervisor, motorista, helper, outros, marketing.
-- Nao pode sobrar owner nem cleaner.

\echo ''
\echo '=== 2.4 Mensalidade recalculada, com o teto ==='
select c.name, c.plan, c.extra_teams as equipes_extras,
       public.company_monthly_fee(c.id) as mensalidade,
       public.company_max_teams(c.id)   as equipes,
       public.company_max_clients(c.id) as lim_clientes,
       public.company_max_users(c.id)   as lim_acessos
  from public.companies c order by c.name;
-- lim_clientes e lim_acessos devem vir VAZIOS (null = ilimitado).
-- Teto: Base para em 100, Pro em 150, Plus nao tem teto.

\echo ''
\echo '=== 2.5 Quem ve valores (deve ser so admin, ate voce liberar) ==='
select c.name as empresa, m.full_name, m.role, m.can_see_values
  from public.memberships m
  join public.companies c on c.id = m.company_id
 where m.active and (m.role = 'admin' or m.can_see_values)
 order by c.name, m.role;

\echo ''
\echo '=== 2.6 Nenhuma empresa sem admin (tem que vir vazio) ==='
select c.name as empresa_sem_admin
  from public.companies c
 where not exists (
   select 1 from public.memberships m
    where m.company_id = c.id and m.active and m.role = 'admin'
 );

\echo ''
\echo '=== 2.7 A mascara de preco funciona? ==='
select case when to_regclass('public.clients_safe') is null
            then 'FALTA — a migration-56 nao rodou'
            else 'OK — clients_safe existe'
       end as view_de_preco,
       case when exists (
              select 1 from pg_trigger where tgname = 'clients_guard_price'
            ) then 'OK — guard_client_price ativo'
            else 'FALTA — a escrita de preco nao esta protegida'
       end as trava_de_escrita;

\echo ''
\echo '=== 2.8 Travas de limite que NAO devem mais existir ==='
select tgname as trigger_que_sobrou
  from pg_trigger
 where tgname in ('clients_plan_limit','clients_plan_limit_update',
                  'memberships_plan_limit','memberships_plan_limit_update');
-- Tem que vir vazio: cliente e acesso sao ilimitados agora.
