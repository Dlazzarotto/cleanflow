-- =============================================================
-- CleanFlow AI - Migracao 32: equipe nao ve valores dos extras
-- A equipe registra o SERVICO; o valor e assunto da empresa
-- com o cliente, conforme a clausula 5 do contrato.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Catalogo: leitura de precos so para a gestao
drop policy if exists "extras_read" on public.service_extras;

do $$ begin
  create policy "extras_manager_read" on public.service_extras
    for select using (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 2) Visao da equipe: apenas id e nome do servico, SEM preco
create or replace view public.team_service_extras as
select se.id, se.name
  from public.service_extras se
 where se.company_id = public.current_company_id()
   and se.active;

grant select on public.team_service_extras to authenticated;

-- 3) Extras pedidos: a equipe ve o que registrou, sem valores
drop policy if exists "booking_extras_select" on public.booking_extras;

do $$ begin
  create policy "booking_extras_manager_select" on public.booking_extras
    for select using (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

create or replace view public.team_booking_extras as
select be.id, be.booking_id, be.description, be.status, be.created_at
  from public.booking_extras be
 where be.company_id = public.current_company_id()
   and be.requested_by = auth.uid();

grant select on public.team_booking_extras to authenticated;

-- 4) O preco do item do catalogo e definido no servidor, nunca enviado pelo app da equipe
create or replace function public.request_extra(
  p_booking uuid,
  p_extra uuid,
  p_description text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_name text;
  v_price numeric(10,2);
  v_person text;
begin
  select b.company_id into v_company
    from public.bookings b
    join public.team_members tm on tm.team_id = b.team_id
   where b.id = p_booking and tm.profile_id = auth.uid();

  if v_company is null then
    raise exception 'Você não faz parte da equipe desta limpeza';
  end if;

  select full_name into v_person
    from public.memberships
   where user_id = auth.uid() and company_id = v_company;

  if p_extra is not null then
    select name, price into v_name, v_price
      from public.service_extras
     where id = p_extra and company_id = v_company and active;
  end if;

  insert into public.booking_extras
    (company_id, booking_id, extra_id, description, price, status, requested_by, requester_name)
  values (
    v_company,
    p_booking,
    p_extra,
    coalesce(v_name, nullif(trim(p_description), ''), 'Serviço extra'),
    v_price,
    case when p_extra is not null then 'aprovado' else 'solicitado' end,
    auth.uid(),
    coalesce(v_person, 'Equipe')
  );
end;
$$;

grant execute on function public.request_extra(uuid, uuid, text) to authenticated;
