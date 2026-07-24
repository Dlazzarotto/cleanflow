-- =============================================================
-- CleanFlow AI - Migracao 9: GPS no check-in/out, unidade/apto
-- e localizacao em tempo real das equipes (mapa).
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Unidade/apartamento no cliente (predios com varias unidades)
alter table public.clients add column if not exists unit text;

-- 2) Carimbos de GPS no check-in/check-out
alter table public.bookings add column if not exists checkin_lat double precision;
alter table public.bookings add column if not exists checkin_lng double precision;
alter table public.bookings add column if not exists checkin_distance_m int;
alter table public.bookings add column if not exists checkout_lat double precision;
alter table public.bookings add column if not exists checkout_lng double precision;
alter table public.bookings add column if not exists checkout_distance_m int;

-- 3) Pings de localizacao (mapa em tempo real)
create table if not exists public.location_pings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m int,
  created_at timestamptz not null default now()
);

create index if not exists pings_company_time_idx on public.location_pings(company_id, created_at desc);

alter table public.location_pings enable row level security;

do $$ begin
  create policy "pings_insert_own" on public.location_pings
    for insert with check (user_id = auth.uid() and company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "pings_select_manager" on public.location_pings
    for select using (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 4) Visao da equipe ganha coordenadas e unidade (colunas novas ao final)
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

-- 5) Funcao de status agora grava GPS e distancia ate a casa
drop function if exists public.set_my_booking_status(uuid, text);

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
