-- =============================================================
-- CleanFlow AI - Migracao 25: registro no local + sem acesso (lockout)
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Ocorrencia guarda onde foi registrada (prova de presenca)
alter table public.incidents add column if not exists lat double precision;
alter table public.incidents add column if not exists lng double precision;
alter table public.incidents add column if not exists distance_m int;

-- A trava de auditoria tambem protege a localizacao do registro
create or replace function public.protect_incident_log()
returns trigger language plpgsql as $$
begin
  if new.description is distinct from old.description
     or new.photos is distinct from old.photos
     or new.reported_by is distinct from old.reported_by
     or new.created_at is distinct from old.created_at
     or new.kind is distinct from old.kind
     or new.moment is distinct from old.moment
     or new.lat is distinct from old.lat
     or new.lng is distinct from old.lng
     or new.distance_m is distinct from old.distance_m then
    raise exception 'O relato original de uma ocorrência não pode ser alterado (registro de auditoria)';
  end if;
  return new;
end;
$$;

-- 2) Novo status de limpeza: equipe foi e nao conseguiu entrar
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('orcamento','agendado','a_caminho','em_andamento','concluido','cancelado','sem_acesso'));

alter table public.bookings add column if not exists lockout_at timestamptz;

-- 3) A funcao da equipe passa a aceitar "sem_acesso" e grava o horario
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

  if p_status not in ('a_caminho','em_andamento','concluido','sem_acesso') then
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
         checkout_distance_m = case when p_status = 'concluido' then v_dist else checkout_distance_m end,
         lockout_at          = case when p_status = 'sem_acesso' then now() else lockout_at end
   where id = p_booking;
end;
$$;

grant execute on function public.set_my_booking_status(uuid, text, double precision, double precision) to authenticated;
