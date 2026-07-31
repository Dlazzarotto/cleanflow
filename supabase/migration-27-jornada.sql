-- =============================================================
-- CleanFlow AI - Migracao 27: inicio e fim da jornada do dia
-- Executar no SQL Editor do Supabase.
-- =============================================================

create table if not exists public.work_shifts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  started_at timestamptz not null default now(),
  start_lat double precision,
  start_lng double precision,
  ended_at timestamptz,
  end_lat double precision,
  end_lng double precision,
  note text,
  auto_closed boolean not null default false
);

create index if not exists shifts_company_day_idx on public.work_shifts(company_id, started_at desc);
create index if not exists shifts_user_idx on public.work_shifts(user_id, started_at desc);

alter table public.work_shifts enable row level security;

do $$ begin
  create policy "shifts_insert_own" on public.work_shifts
    for insert with check (user_id = auth.uid() and company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "shifts_select" on public.work_shifts
    for select using (
      company_id = public.current_company_id()
      and (public.is_manager() or user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "shifts_update" on public.work_shifts
    for update using (
      company_id = public.current_company_id()
      and (public.is_manager() or user_id = auth.uid())
    )
    with check (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

-- Jornada aberta do usuario (se houver)
create or replace function public.my_open_shift()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.work_shifts
   where user_id = auth.uid()
     and company_id = public.current_company_id()
     and ended_at is null
   order by started_at desc
   limit 1;
$$;

grant execute on function public.my_open_shift() to authenticated;

-- Check-in exige jornada iniciada
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

  if p_status in ('a_caminho','em_andamento') and public.my_open_shift() is null then
    raise exception 'Inicie seu dia no app antes de registrar a chegada';
  end if;

  if not exists (
    select 1 from public.bookings b
      join public.team_members tm on tm.team_id = b.team_id
     where b.id = p_booking and tm.profile_id = auth.uid()
  ) then
    raise exception 'Você não faz parte da equipe desta limpeza';
  end if;

  select c.lat, c.lng into v_clat, v_clng
    from public.bookings b join public.clients c on c.id = b.client_id
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

  if p_status in ('em_andamento','concluido') and v_dist is not null and v_dist > 100 then
    raise exception 'Você está a % m da casa. O registro só pode ser feito no local do serviço.', v_dist;
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
