-- =============================================================
-- CleanFlow AI - Migracao 56: permissao por pessoa + trava do
--                             ultimo admin
-- Executar no SQL Editor do Supabase (depois da 55).
--
-- 1) PERMISSAO E POR PESSOA, NAO POR CARGO
--    A migration-11 guardava as permissoes em positions (cargo). Os
--    nomes dos cargos colidiam com os papeis da migration-55
--    (motorista, helper, supervisor) — duas listas para a mesma coisa.
--    Agora a permissao mora direto no vinculo da pessoa.
--
--    Nada e perdido: o que cada pessoa enxergava hoje (cargo + excecao)
--    e copiado para memberships.permissions antes de a leitura mudar.
--    A tabela positions NAO e apagada — fica parada, sem ninguem ler,
--    caso voce queira conferir algo depois. Apagar e decisao sua.
--
-- 2) TRAVA DO ULTIMO ADMIN
--    Nada impedia rebaixar, desativar ou apagar o unico admin da
--    empresa — e ela ficaria sem ninguem que pudesse liberar valores,
--    mudar papel ou promover alguem. So a plataforma destravaria.
-- =============================================================

-- -------------------------------------------------------------
-- 1) A permissao passa para o vinculo da pessoa
-- -------------------------------------------------------------
alter table public.memberships
  add column if not exists permissions jsonb not null default '{}'::jsonb;

comment on column public.memberships.permissions is
  'O que esta pessoa enxerga no app (chaves de src/lib/permissions.ts). Chave ausente = liberado, para que configuracao nunca impeca alguem de trabalhar.';

-- Copia o que cada pessoa ja enxergava, ANTES de a leitura mudar.
--
-- A origem depende do que existe no seu banco:
--   positions + memberships.position_id  vem da migration-11 (real)
--   memberships.permissions_override     so existe se voce rodou uma
--                                        versao antiga da migration-54,
--                                        que hoje esta vazia
-- Por isso cada parte e conferida antes de rodar. So mexe em quem esta
-- com permissions vazio, entao reexecutar nao desfaz ajuste posterior.
do $$
declare
  v_tem_cargo boolean;
  v_tem_excecao boolean;
begin
  select exists(
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'memberships'
       and column_name = 'position_id'
  ) and to_regclass('public.positions') is not null
    into v_tem_cargo;

  select exists(
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'memberships'
       and column_name = 'permissions_override'
  ) into v_tem_excecao;

  if v_tem_cargo and v_tem_excecao then
    execute $q$
      update public.memberships m
         set permissions = coalesce(p.permissions, '{}'::jsonb)
                        || coalesce(m.permissions_override, '{}'::jsonb)
        from public.positions p
       where p.id = m.position_id and m.permissions = '{}'::jsonb
    $q$;
  elsif v_tem_cargo then
    execute $q$
      update public.memberships m
         set permissions = coalesce(p.permissions, '{}'::jsonb)
        from public.positions p
       where p.id = m.position_id and m.permissions = '{}'::jsonb
    $q$;
  end if;

  if v_tem_excecao then
    execute $q$
      update public.memberships m
         set permissions = coalesce(m.permissions_override, '{}'::jsonb)
       where m.permissions = '{}'::jsonb
         and coalesce(m.permissions_override, '{}'::jsonb) <> '{}'::jsonb
    $q$;
  end if;
end $$;

-- A leitura passa a ser so do vinculo. Chave ausente continua valendo
-- como liberado (has_perm devolve true quando nao esta definida), que e
-- a regra 6: configuracao nunca impede trabalhar.
create or replace function public.my_permissions()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(m.permissions, '{}'::jsonb)
       from public.memberships m
      where m.user_id = auth.uid()
        and m.company_id = public.current_company_id()
        and m.active
      limit 1),
    '{}'::jsonb
  );
$$;

grant execute on function public.my_permissions() to authenticated;

-- -------------------------------------------------------------
-- 2) A empresa nunca pode ficar sem admin
--
-- Vale para rebaixar, desativar e apagar. Com dois socios admin,
-- qualquer um dos dois pode mexer no outro — foi decisao sua deixar
-- assim; o que esta trava impede e sobrar zero.
-- -------------------------------------------------------------
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $func$
declare
  v_outros int;
begin
  -- So interessa quando a linha ERA um admin ativo e deixa de ser.
  if tg_op = 'UPDATE'
     and not (old.role = 'admin' and old.active
              and (new.role <> 'admin' or not new.active)) then
    return new;
  end if;

  if tg_op = 'DELETE' and not (old.role = 'admin' and old.active) then
    return old;
  end if;

  select count(*) into v_outros
    from public.memberships
   where company_id = old.company_id
     and active
     and role = 'admin'
     and id <> old.id;

  if v_outros = 0 then
    raise exception
      'Esta é a única pessoa com acesso de admin da empresa. Promova outra pessoa a admin antes de mudar ou remover esta.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$func$;

drop trigger if exists memberships_guard_last_admin on public.memberships;
create trigger memberships_guard_last_admin
  before update or delete on public.memberships
  for each row execute function public.guard_last_admin();

-- -------------------------------------------------------------
-- 3) CORRECAO: a clients_safe da migration-55 nao mascarava nada
--
-- Ela era "select c.*, case when can_see_values() ... as
-- default_price_visivel". Como c.* ja traz default_price cru, o valor
-- continuava visivel pela propria view. Mascarar exige substituir a
-- coluna, nao acrescentar outra ao lado.
--
-- Aqui a lista de colunas e montada na hora a partir do catalogo, entao
-- a view nasce com os MESMOS nomes de clients (so o default_price sai
-- mascarado) e as telas trocam a tabela pela view sem mudar mais nada.
-- Rodar de novo depois de acrescentar coluna em clients regenera a view.
-- -------------------------------------------------------------
drop view if exists public.clients_safe;

do $$
declare v_cols text;
begin
  select string_agg(
           -- Toda coluna de dinheiro de clients entra aqui. Acrescentou
           -- outra? Ponha na lista e rode este arquivo de novo.
           case when column_name in ('default_price','monthly_contract_value')
                then 'case when public.can_see_values() then c.' || quote_ident(column_name)
                     || ' else null end as ' || quote_ident(column_name)
                else 'c.' || quote_ident(column_name)
           end,
           ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'clients';

  execute
    'create view public.clients_safe with (security_invoker = true) as select '
    || v_cols
    || ', public.can_see_values() as pode_ver_valor from public.clients c';
end $$;

grant select on public.clients_safe to authenticated;

-- -------------------------------------------------------------
-- 4) Conferencia
-- -------------------------------------------------------------
-- O que cada pessoa enxerga agora (vazio = tudo liberado):
-- select c.name as empresa, m.full_name, m.role, m.permissions
--   from public.memberships m
--   join public.companies c on c.id = m.company_id
--  where m.active
--  order by c.name, m.role, m.full_name;
--
-- Empresas sem admin ativo (deve vir vazio; se vier algo, promova
-- alguem a mao antes de qualquer outra coisa):
-- select c.name from public.companies c
--  where not exists (select 1 from public.memberships m
--                     where m.company_id = c.id and m.active and m.role = 'admin');
--
-- A tabela positions continua no banco, sem ninguem ler. Para apagar
-- de vez, depois de conferir que nao precisa mais:
--
-- alter table public.memberships drop column if exists position_id;
-- alter table public.memberships drop column if exists permissions_override;
-- drop table if exists public.positions;
