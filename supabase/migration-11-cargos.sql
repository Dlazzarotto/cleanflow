-- =============================================================
-- CleanFlow AI - Migracao 11: cargos com permissoes por clique
-- O banco mascara os campos conforme o cargo da pessoa.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Cargos da empresa
create table if not exists public.positions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists positions_company_idx on public.positions(company_id);

alter table public.positions enable row level security;

do $$ begin
  create policy "positions_manager_all" on public.positions
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 2) Cargo no vinculo da pessoa
alter table public.memberships
  add column if not exists position_id uuid references public.positions(id) on delete set null;

-- 3) Permissoes efetivas do usuario logado
-- Sem cargo definido = acesso operacional completo (padrao atual).
create or replace function public.my_permissions()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.permissions
       from public.memberships m
       left join public.positions p on p.id = m.position_id
      where m.user_id = auth.uid()
        and m.company_id = public.current_company_id()
        and m.active
      limit 1),
    '{}'::jsonb
  );
$$;

-- helper: permissao com padrao true quando nao definida
create or replace function public.has_perm(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.my_permissions()->>p_key)::boolean, true);
$$;

-- 4) A visao da equipe passa a MASCARAR campos conforme o cargo
create or replace view public.team_agenda as
select
  b.id,
  b.team_id,
  b.scheduled_at,
  b.duration_minutes,
  b.status,
  case when public.has_perm('notes') then b.notes else null end as notes,
  c.full_name as client_name,
  c.address,
  case when public.has_perm('door_code') then c.door_code else null end as door_code,
  c.has_pets,
  c.pets_notes,
  case when public.has_perm('alarm') then c.alarm_notes else null end as alarm_notes,
  case when public.has_perm('preferences') then c.preferences else null end as preferences,
  case when public.has_perm('preferences') then c.products_notes else null end as products_notes,
  t.name  as team_name,
  t.color as team_color,
  c.lat,
  c.lng,
  c.unit
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

-- 5) Check-in/out respeita a permissao do cargo
create or replace function public.set_my_booking_status(
  p_booking uuid,
  p_status text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clat double precision;
  v_clng double precision;
  v_dist int;
begin
  if not public.has_perm('checkin') then
    raise exception 'Seu cargo não permite registrar check-in/check-out';
  end if;

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

  select c.lat, c.lng into v_clat, v_clng
    from public.bookings b
    join public.clients c on c.id = b.client_id
   where b.id = p_booking;

  if p_lat is not null and p_lng is not null and v_clat is not null and v_clng is not null then
    v_dist := round(
      2 * 6371000 * asin( sqrt(
        power(sin(radians((v_clat - p_lat) / 2)), 2) +
        cos(radians(p_lat)) * cos(radians(v_clat)) *
        power(sin(radians((v_clng - p_lng) / 2)), 2)
      ))
    );
  end if;

  update public.bookings
     set status = p_status,
         checkin_at         = case when p_status = 'em_andamento' then now() else checkin_at end,
         checkin_lat        = case when p_status = 'em_andamento' then p_lat else checkin_lat end,
         checkin_lng        = case when p_status = 'em_andamento' then p_lng else checkin_lng end,
         checkin_distance_m = case when p_status = 'em_andamento' then v_dist else checkin_distance_m end,
         checkout_at         = case when p_status = 'concluido' then now() else checkout_at end,
         checkout_lat        = case when p_status = 'concluido' then p_lat else checkout_lat end,
         checkout_lng        = case when p_status = 'concluido' then p_lng else checkout_lng end,
         checkout_distance_m = case when p_status = 'concluido' then v_dist else checkout_distance_m end
   where id = p_booking;
end;
$$;

grant execute on function public.set_my_booking_status(uuid, text, double precision, double precision) to authenticated;
