-- =============================================================
-- CleanFlow AI - Migracao 26: fluxo de campo
--  a) "sem acesso" so depois do check-in e com aprovacao da gestao
--  b) check-out so dentro de 100 m da casa
--  c) saida do local com servico em andamento encerra e avisa a gestao
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Controle do pedido de "sem acesso"
alter table public.bookings add column if not exists lockout_status text not null default 'nenhum';
do $$ begin
  alter table public.bookings add constraint bookings_lockout_status_check
    check (lockout_status in ('nenhum','solicitado','aprovado','recusado'));
exception when duplicate_object then null; end $$;

alter table public.bookings add column if not exists lockout_requested_at timestamptz;
alter table public.bookings add column if not exists lockout_decided_by uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists lockout_decided_at timestamptz;

-- 2) Encerramento automatico por afastamento
alter table public.bookings add column if not exists auto_closed boolean not null default false;
alter table public.bookings add column if not exists auto_closed_at timestamptz;

-- 3) Novo tipo de ocorrencia
alter table public.incidents drop constraint if exists incidents_kind_check;
alter table public.incidents
  add constraint incidents_kind_check
  check (kind in ('dano_pre_existente','incidente_limpeza','acesso','seguranca','equipamento','saida_automatica','outro'));

-- 4) Check-out exige estar na casa (100 m)
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

  -- Check-in e check-out precisam acontecer no local do serviço
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

-- 5) Pedido de "sem acesso" — so depois do check-in, e nao muda a cobranca sozinho
create or replace function public.request_lockout(
  p_booking uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select b.status into v_status
    from public.bookings b
    join public.team_members tm on tm.team_id = b.team_id
   where b.id = p_booking and tm.profile_id = auth.uid();

  if v_status is null then
    raise exception 'Você não faz parte da equipe desta limpeza';
  end if;

  if v_status <> 'em_andamento' then
    raise exception 'Faça o check-in na casa antes de informar que não conseguiu entrar';
  end if;

  update public.bookings
     set lockout_status = 'solicitado',
         lockout_requested_at = now()
   where id = p_booking;
end;
$$;

grant execute on function public.request_lockout(uuid, double precision, double precision) to authenticated;

-- 6) Encerramento automatico quando a equipe se afasta do local
create or replace function public.auto_close_my_booking(
  p_booking uuid,
  p_lat double precision,
  p_lng double precision
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.bookings b
      join public.team_members tm on tm.team_id = b.team_id
     where b.id = p_booking
       and tm.profile_id = auth.uid()
       and b.status = 'em_andamento'
  ) then
    return;
  end if;

  update public.bookings
     set status = 'concluido',
         checkout_at = now(),
         checkout_lat = p_lat,
         checkout_lng = p_lng,
         auto_closed = true,
         auto_closed_at = now()
   where id = p_booking;
end;
$$;

grant execute on function public.auto_close_my_booking(uuid, double precision, double precision) to authenticated;

-- 7) A visao da equipe passa a mostrar a situacao do pedido (coluna no FIM)
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
  c.unit,
  b.client_id,
  b.lockout_status
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
