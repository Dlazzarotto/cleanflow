-- =============================================================
-- CleanFlow AI - Migracao 55: papeis novos, escopo por equipe e
--                             chave de valores dada pelo admin
-- Executar no SQL Editor do Supabase (depois da 54).
--
-- PAPEIS
--   admin       quem cria a empresa. Acesso total: incluir, excluir,
--               modificar. Unico que concede permissao a alguem.
--   manager     escritorio: organiza agenda e equipes.
--   supervisor  campo: cuida das equipes.
--   motorista   equipe
--   helper      equipe
--   outros      equipe
--   marketing   NAO e da equipe. Empresa ou pessoa de fora que so
--               cadastra lead e acompanha o que ela mesma cadastrou.
--               Escopo ja resolvido na migration-20; nada muda aqui.
--
-- DE -> PARA (papeis antigos)
--   owner       -> admin       (era quem criava a empresa)
--   admin       -> manager     (era gestor de segundo nivel; segue
--                               gestor, mas sem valores ate o admin dar)
--   supervisor  -> supervisor
--   cleaner     -> helper      (equipe; o admin ajusta para motorista
--                               ou outros depois, um clique)
--   marketing   -> marketing
--
-- VALORES
--   Ninguem ve valor por ser gestao. Admin sempre ve; manager e
--   supervisor so se o admin ligar a chave (memberships.can_see_values,
--   que nasce DESLIGADA para todo mundo que ja existe). Equipe e
--   marketing nunca veem.
--
-- ESCOPO POR EQUIPE
--   Manager e supervisor enxergam as equipes sob a responsabilidade
--   deles (as equipes em que estao em team_members). Decisao tecnica:
--   quem nao tem NENHUMA equipe atribuida enxerga TODAS — e o caso do
--   escritorio que organiza a empresa inteira, e evita que um gestor
--   recem-criado abra o app vazio achando que quebrou. O admin estreita
--   atribuindo equipes.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Lista de papeis + conversao dos dados
--
-- Guardado pelo constraint, como na 53: 'admin' e nome valido nos dois
-- modelos, entao rodar duas vezes sem protecao rebaixaria os admins
-- novos para manager. Enquanto o constraint ainda aceitar 'owner',
-- estamos no modelo antigo. Pode reexecutar o arquivo a vontade.
-- -------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'memberships_role_check'
       and pg_get_constraintdef(oid) like '%owner%'
  ) then
    alter table public.memberships drop constraint memberships_role_check;

    update public.memberships
       set role = case role
         when 'owner'   then 'admin'
         when 'admin'   then 'manager'
         when 'cleaner' then 'helper'
         else role
       end;
  end if;
end $$;

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check
  check (role in ('admin','manager','supervisor','motorista','helper','outros','marketing'));

alter table public.memberships alter column role set default 'helper';

-- -------------------------------------------------------------
-- 2) Quem e quem
-- -------------------------------------------------------------
-- Acesso total. So ele concede permissao.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() = 'admin', false);
$$;

-- Quem tem telas de gestao. Mesma forma de antes (eram owner/admin/
-- supervisor), entao todas as politicas que ja usam is_manager()
-- continuam valendo sem serem reescritas.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() in ('admin','manager','supervisor'), false);
$$;

-- Equipe de campo.
create or replace function public.is_field()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() in ('motorista','helper','outros'), false);
$$;

grant execute on function public.is_admin()   to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_field()   to authenticated;

-- Check-in: a lista de papeis mudou de nome (migration-39).
-- Continua valendo a regra 6: configuracao nunca impede trabalhar.
create or replace function public.can_checkin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.company_id = public.current_company_id()
       and m.active
       and m.role in ('admin','manager','supervisor','motorista','helper','outros')
  );
$$;

grant execute on function public.can_checkin() to authenticated;

-- -------------------------------------------------------------
-- 3) A chave de valores
-- -------------------------------------------------------------
alter table public.memberships
  add column if not exists can_see_values boolean not null default false;

comment on column public.memberships.can_see_values is
  'Admin liberou esta pessoa a ver valores. Ignorado para admin (sempre ve) e para equipe/marketing (nunca veem).';

-- O admin sempre ve, mesmo com a coluna falsa — a chave nao se aplica a ele.
create or replace function public.can_see_values()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case
              when m.role = 'admin' then true
              when m.role in ('manager','supervisor') then coalesce(m.can_see_values, false)
              else false
            end
       from public.memberships m
      where m.user_id = auth.uid()
        and m.company_id = public.current_company_id()
        and m.active
      limit 1),
    false
  );
$$;

grant execute on function public.can_see_values() to authenticated;

-- So o admin mexe na chave e nos papeis. Sem isto, um manager se
-- auto-libera e a trava nao vale nada.
create or replace function public.guard_membership_admin()
returns trigger language plpgsql security definer set search_path = public as $func$
begin
  if (new.role is distinct from old.role
      or new.can_see_values is distinct from old.can_see_values)
     and not public.is_admin() then
    raise exception 'Apenas o admin pode mudar o papel ou liberar valores.';
  end if;
  return new;
end;
$func$;

drop trigger if exists memberships_guard_admin on public.memberships;
create trigger memberships_guard_admin
  before update on public.memberships
  for each row execute function public.guard_membership_admin();

-- -------------------------------------------------------------
-- 4) Escopo por equipe (manager e supervisor)
-- -------------------------------------------------------------
create or replace function public.my_team_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tm.team_id
    from public.team_members tm
   where tm.profile_id = auth.uid();
$$;

-- true quando a pessoa enxerga aquela equipe:
--   admin  -> todas
--   gestao -> as dela; nenhuma atribuida = todas (escritorio)
--   resto  -> so as dela
create or replace function public.sees_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then true
    when p_team is null then public.is_manager()
    when public.is_manager()
         and not exists (select 1 from public.my_team_ids()) then true
    else exists (select 1 from public.my_team_ids() t where t = p_team)
  end;
$$;

grant execute on function public.my_team_ids() to authenticated;
grant execute on function public.sees_team(uuid) to authenticated;

drop policy if exists "bookings_manager_all" on public.bookings;
create policy "bookings_manager_all" on public.bookings
  for all using (
    company_id = public.current_company_id()
    and public.is_manager()
    and public.sees_team(team_id)
  )
  with check (
    company_id = public.current_company_id()
    and public.is_manager()
    and public.sees_team(team_id)
  );

-- -------------------------------------------------------------
-- 5) Dinheiro deixa de ser "gestao" e passa a ser a chave
-- -------------------------------------------------------------
-- As quatro tabelas que guardam dinheiro:
--   invoices        (amount)          migration-29
--   invoice_items   (amount)          migration-30
--   service_extras  (price)           migration-30
--   booking_extras  (price)           migration-30
--
-- O QUE NAO SE TOCA AQUI: a politica booking_extras_insert. E por ela
-- que a equipe registra um extra no meio do servico, e o preco nem sai
-- do celular — quem define e a funcao request_extra() no servidor
-- (migration-32). Mexer nela quebraria a regra 6: configuracao nunca
-- impede a equipe de trabalhar. As views team_service_extras e
-- team_booking_extras tambem seguem intactas: sao a visao sem preco.
--
-- Os "drop policy" repetem o nome novo tambem, para o arquivo poder ser
-- reexecutado (create policy nao tem "or replace").

-- Faturas
drop policy if exists "invoices_manager_all" on public.invoices;
drop policy if exists "invoices_values_all"  on public.invoices;
create policy "invoices_values_all" on public.invoices
  for all using (company_id = public.current_company_id() and public.can_see_values())
  with check (company_id = public.current_company_id() and public.can_see_values());

-- Itens da fatura
drop policy if exists "invoice_items_manager"    on public.invoice_items;
drop policy if exists "invoice_items_values_all" on public.invoice_items;
create policy "invoice_items_values_all" on public.invoice_items
  for all using (
    invoice_id in (select id from public.invoices where company_id = public.current_company_id())
    and public.can_see_values()
  )
  with check (
    invoice_id in (select id from public.invoices where company_id = public.current_company_id())
    and public.can_see_values()
  );

-- Catalogo de extras (tem preco)
drop policy if exists "extras_read"             on public.service_extras;
drop policy if exists "extras_manager_read"     on public.service_extras;
drop policy if exists "extras_manage"           on public.service_extras;
drop policy if exists "extras_values_read"      on public.service_extras;
drop policy if exists "extras_values_manage"    on public.service_extras;
create policy "extras_values_read" on public.service_extras
  for select using (company_id = public.current_company_id() and public.can_see_values());
create policy "extras_values_manage" on public.service_extras
  for all using (company_id = public.current_company_id() and public.can_see_values())
  with check (company_id = public.current_company_id() and public.can_see_values());

-- Extras pedidos numa limpeza (tem preco). A politica de INSERT da
-- equipe fica de fora de proposito — ver o bloco acima.
drop policy if exists "booking_extras_select"         on public.booking_extras;
drop policy if exists "booking_extras_manager_select" on public.booking_extras;
drop policy if exists "booking_extras_manage"         on public.booking_extras;
drop policy if exists "booking_extras_values_select"  on public.booking_extras;
drop policy if exists "booking_extras_values_manage"  on public.booking_extras;
create policy "booking_extras_values_select" on public.booking_extras
  for select using (company_id = public.current_company_id() and public.can_see_values());
create policy "booking_extras_values_manage" on public.booking_extras
  for all using (company_id = public.current_company_id() and public.can_see_values())
  with check (company_id = public.current_company_id() and public.can_see_values());

-- -------------------------------------------------------------
-- 6) Preco dentro do cadastro do cliente
--
-- RLS decide QUAIS LINHAS, nunca quais colunas — entao bloquear a linha
-- nao serve: quem nao ve valor ainda precisa do endereco, do codigo da
-- porta e da agenda. A saida e a mesma que a equipe de campo ja usa na
-- view team_agenda: mascarar a coluna.
--
-- As telas de leitura passam a ler clients_safe; a escrita continua na
-- tabela, protegida pelo trigger logo abaixo.
-- -------------------------------------------------------------
create or replace view public.clients_safe
with (security_invoker = true) as
select
  c.*,
  case when public.can_see_values() then c.default_price else null end as default_price_visivel,
  public.can_see_values() as pode_ver_valor
from public.clients c;

grant select on public.clients_safe to authenticated;

-- Sem a chave, ninguem muda preco — nem por tela, nem por API.
create or replace function public.guard_client_price()
returns trigger language plpgsql security definer set search_path = public as $func$
begin
  if tg_op = 'INSERT' then
    if new.default_price is not null and not public.can_see_values() then
      raise exception 'Você não tem liberação para definir valores. Fale com o admin da empresa.';
    end if;
  elsif new.default_price is distinct from old.default_price
        and not public.can_see_values() then
    raise exception 'Você não tem liberação para mudar valores. Fale com o admin da empresa.';
  end if;
  return new;
end;
$func$;

drop trigger if exists clients_guard_price on public.clients;
create trigger clients_guard_price
  before insert or update on public.clients
  for each row execute function public.guard_client_price();

-- -------------------------------------------------------------
-- 7) Conferencia
-- -------------------------------------------------------------
-- Como ficaram os papeis:
-- select role, count(*) from public.memberships group by role order by role;
--
-- Quem ve valores hoje (deve ser so admin, ate voce liberar alguem):
-- select c.name as empresa, m.full_name, m.role, m.can_see_values
--   from public.memberships m
--   join public.companies c on c.id = m.company_id
--  where m.active and (m.role = 'admin' or m.can_see_values)
--  order by c.name, m.role;
--
-- Toda empresa precisa de pelo menos um admin. Se alguma aparecer aqui,
-- promova alguem na mao antes de seguir:
-- select c.name from public.companies c
--  where not exists (select 1 from public.memberships m
--                     where m.company_id = c.id and m.active and m.role = 'admin');
