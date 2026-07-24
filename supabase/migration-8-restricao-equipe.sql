-- =============================================================
-- CleanFlow AI - Migracao 8: equipe NUNCA ve valores/pagamentos
-- Restricao aplicada no banco (RLS por papel + visao segura).
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- Papel do usuario na empresa ativa
create or replace function public.current_member_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships
   where user_id = auth.uid()
     and company_id = public.current_company_id()
     and active
   limit 1;
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() in ('owner','admin','supervisor'), false);
$$;

-- ------- Tabelas com VALORES: somente gestao -------
drop policy if exists "bookings_all" on public.bookings;
create policy "bookings_manager_all" on public.bookings
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "payments_all" on public.payments;
create policy "payments_manager_all" on public.payments
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "estimates_all" on public.estimates;
create policy "estimates_manager_all" on public.estimates
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "pricing_settings_all" on public.pricing_settings;
create policy "pricing_settings_manager_all" on public.pricing_settings
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "market_cache_all" on public.market_cache;
create policy "market_cache_manager_all" on public.market_cache
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

-- Cadastro de clientes tambem vira restrito a gestao
-- (a equipe recebe apenas o necessario pela visao team_agenda abaixo)
drop policy if exists "clients_all" on public.clients;
create policy "clients_manager_all" on public.clients
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "teams_all" on public.teams;
create policy "teams_manager_all" on public.teams
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

drop policy if exists "team_members_all" on public.team_members;
create policy "team_members_manager_all" on public.team_members
  for all using (public.is_manager() and team_id in
    (select id from public.teams where company_id = public.current_company_id()));

-- ------- Visao segura da equipe: SEM precos, SEM pagamentos -------
create or replace view public.team_agenda as
select
  b.id,
  b.team_id,
  b.scheduled_at,
  b.duration_minutes,
  b.status,
  b.notes,
  c.full_name as client_name,
  c.address,
  c.door_code,
  c.has_pets,
  c.pets_notes,
  c.alarm_notes,
  c.preferences,
  c.products_notes,
  t.name  as team_name,
  t.color as team_color
from public.bookings b
join public.clients c on c.id = b.client_id
left join public.teams t on t.id = b.team_id
where b.status <> 'cancelado'
  and exists (
    select 1 from public.team_members tm
     where tm.team_id = b.team_id
       and tm.profile_id = auth.uid()
  );

grant select on public.team_agenda to authenticated;

-- ------- Funcao segura para check-in/out da equipe -------
create or replace function public.set_my_booking_status(p_booking uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('a_caminho','em_andamento','concluido') then
    raise exception 'Status não permitido';
  end if;

  if not exists (
    select 1
      from public.bookings b
      join public.team_members tm on tm.team_id = b.team_id
     where b.id = p_booking
       and tm.profile_id = auth.uid()
  ) then
    raise exception 'Você não faz parte da equipe desta limpeza';
  end if;

  update public.bookings
     set status = p_status,
         checkin_at  = case when p_status = 'em_andamento' then now() else checkin_at end,
         checkout_at = case when p_status = 'concluido'    then now() else checkout_at end
   where id = p_booking;
end;
$$;

grant execute on function public.set_my_booking_status(uuid, text) to authenticated;
