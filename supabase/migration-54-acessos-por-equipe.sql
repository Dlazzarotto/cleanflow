-- =============================================================
-- CleanFlow AI - Migracao 54: acesso por equipe, cargos e excecao
-- Executar no SQL Editor do Supabase (depois da 53).
--
-- Muda o conceito de acesso:
--
--   Nao e um login por faxineira. E 1 login da dona + 1 login por
--   equipe, compartilhado pela turma. Quem entra e sai da turma e
--   trocado no cadastro da equipe; o acesso continua sendo da equipe.
--   Quem sai fica em hold (memberships.active = false) e volta depois
--   sem perder historico.
--
--   Base  1 equipe  -> 2 acessos
--   Pro   2 equipes -> 3 acessos
--   Plus  3 equipes -> 4 acessos
--   Cada equipe adicional (US$ 19,99) soma mais um acesso.
--
-- Tambem cria os quatro cargos padrao (motorista, helper, supervisor,
-- outro) e permite excecao de permissao por pessoa, sem quebrar o
-- modelo de cargo que ja existe na migration-11.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Acesso = 1 (dona) + 1 por equipe
-- -------------------------------------------------------------
create or replace function public.company_max_users(p_company uuid)
returns int language sql stable security definer set search_path = public as $$
  select 1 + public.company_max_teams(p_company);
$$;

-- -------------------------------------------------------------
-- 2) Cargos padrao da empresa
--
-- A migration-11 ja tem positions(name, permissions jsonb) e
-- memberships.position_id. Aqui so semeamos os quatro cargos para quem
-- ainda nao tem, sem tocar em cargo que a empresa ja criou na mao.
--
-- Permissoes (as cinco chaves de src/lib/permissions.ts):
--   door_code, alarm, preferences, notes, checkin
--
-- Supervisor enxerga tudo do campo. Valor, fatura e pagamento nao estao
-- nesta lista e continuam fora do alcance de qualquer cargo — isso e
-- decidido por RLS, nao por caixinha.
-- -------------------------------------------------------------
insert into public.positions (company_id, name, permissions)
select c.id, v.name, v.permissions
  from public.companies c
 cross join (values
   ('Motorista',  '{"door_code":true,"alarm":true,"preferences":false,"notes":true,"checkin":true}'::jsonb),
   ('Helper',     '{"door_code":false,"alarm":false,"preferences":true,"notes":true,"checkin":true}'::jsonb),
   ('Supervisor', '{"door_code":true,"alarm":true,"preferences":true,"notes":true,"checkin":true}'::jsonb),
   ('Outro',      '{"door_code":false,"alarm":false,"preferences":false,"notes":false,"checkin":true}'::jsonb)
 ) as v(name, permissions)
 where not exists (
   select 1 from public.positions p
    where p.company_id = c.id and lower(p.name) = lower(v.name)
 );

-- -------------------------------------------------------------
-- 3) Excecao de permissao por pessoa
--
-- O cargo define o padrao; o override e so o que a dona destravou ou
-- travou naquela pessoa especifica. Guardamos apenas as chaves mexidas,
-- para que mudar a regra do cargo continue valendo para quem nao tem
-- excecao.
-- -------------------------------------------------------------
alter table public.memberships
  add column if not exists permissions_override jsonb not null default '{}'::jsonb;

comment on column public.memberships.permissions_override is
  'Excecao por pessoa sobre as permissoes do cargo. Só as chaves mexidas.';

-- Cargo primeiro, excecao por cima: no jsonb, o operador || faz o lado
-- direito vencer chave a chave.
create or replace function public.my_permissions()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(p.permissions, '{}'::jsonb)
            || coalesce(m.permissions_override, '{}'::jsonb)
       from public.memberships m
       left join public.positions p on p.id = m.position_id
      where m.user_id = auth.uid()
        and m.company_id = public.current_company_id()
        and m.active
      limit 1),
    '{}'::jsonb
  );
$$;

grant execute on function public.my_permissions() to authenticated;

-- -------------------------------------------------------------
-- 4) Conferencia
-- -------------------------------------------------------------
-- Acessos usados x permitidos, por empresa:
--
-- select c.name, c.plan,
--        (select count(*) from public.memberships m
--          where m.company_id = c.id and m.active) as acessos_ativos,
--        public.company_max_users(c.id) as limite,
--        public.company_max_teams(c.id) as equipes
--   from public.companies c
--  order by c.name;
--
-- Cargos criados:
-- select c.name as empresa, p.name as cargo, p.permissions
--   from public.positions p
--   join public.companies c on c.id = p.company_id
--  order by c.name, p.name;
