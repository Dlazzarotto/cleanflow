-- =============================================================
-- CleanFlow AI - Migracao 39: check-in a prova de travamento
--
-- PRINCIPIO: o sistema NUNCA impede a equipe de trabalhar por
-- causa de configuracao. Ele registra, sinaliza para a gestao,
-- e deixa o servico acontecer.
--
-- Causas de travamento eliminadas:
--  1. Check-in era permissao configuravel -> deixa de ser
--  2. Cargo novo nascia sem check-in      -> nasce com
--  3. Pessoa sem cargo travava            -> nao trava mais
--  4. Jornada esquecida travava a porta   -> inicia sozinha
--  5. GPS indisponivel travava            -> registra sem GPS
--  6. Erro de GPS em predio travava       -> usa a precisao do aparelho
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Check-in deixa de depender de cargo.
--    Permissoes passam a controlar apenas ACESSO A INFORMACAO
--    (codigo da porta, alarme, preferencias, observacoes),
--    nunca a capacidade de trabalhar.
create or replace function public.can_checkin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.company_id = public.current_company_id()
       and m.active
       and m.role in ('owner','admin','supervisor','cleaner')
  );
$$;

grant execute on function public.can_checkin() to authenticated;

-- 2) Cargos novos ja nascem com check-in liberado
alter table public.positions
  alter column permissions set default '{"checkin": true}'::jsonb;

update public.positions
   set permissions = coalesce(permissions, '{}'::jsonb) || '{"checkin": true}'::jsonb;

-- 3) Jornada: se a pessoa esquecer de iniciar o dia, o sistema
--    inicia sozinho no primeiro registro em campo (nao trava).
create or replace function public.ensure_open_shift(
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_company uuid;
  v_nome text;
begin
  v_id := public.my_open_shift();
  if v_id is not null then
    return v_id;
  end if;

  select m.company_id, m.full_name into v_company, v_nome
    from public.memberships m
   where m.user_id = auth.uid()
     and m.company_id = public.current_company_id()
     and m.active
   limit 1;

  if v_company is null then
    return null;
  end if;

  insert into public.work_shifts (company_id, user_id, person_name, start_lat, start_lng)
  values (v_company, auth.uid(), coalesce(v_nome, 'Equipe'), p_lat, p_lng)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.ensure_open_shift(double precision, double precision) to authenticated;

-- 4) Nova versao do registro em campo
create or replace function public.set_my_booking_status(
  p_booking uuid,
  p_status text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clat double precision;
  v_clng double precision;
  v_dist int;
  v_limite int;
begin
  -- Quem trabalha em campo sempre pode registrar
  if not public.can_checkin() then
    raise exception 'Seu acesso não permite registrar chegada e conclusão. Fale com o escritório.';
  end if;

  if p_status not in ('a_caminho','em_andamento','concluido') then
    raise exception 'Status não permitido';
  end if;

  if not exists (
    select 1 from public.bookings b
      join public.team_members tm on tm.team_id = b.team_id
     where b.id = p_booking and tm.profile_id = auth.uid()
  ) then
    raise exception 'Você não está na equipe desta limpeza. Fale com o escritório.';
  end if;

  -- Jornada inicia sozinha se a pessoa esqueceu
  if p_status in ('a_caminho','em_andamento') then
    perform public.ensure_open_shift(p_lat, p_lng);
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

    -- Tolerancia considera a precisao informada pelo aparelho:
    -- em predio ou area com sinal fraco o erro pode passar de 100 m
    v_limite := 250 + least(coalesce(round(p_accuracy)::int, 0), 250);

    if p_status in ('em_andamento','concluido') and v_dist > v_limite then
      raise exception 'Você está a % m da casa. O registro só pode ser feito no local do serviço.', v_dist;
    end if;
  end if;
  -- Sem GPS (cliente sem coordenada ou aparelho sem sinal): registra assim mesmo.
  -- Fica sinalizado para a gestao pelo campo de distancia em branco.

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

grant execute on function public.set_my_booking_status(uuid, text, double precision, double precision, double precision) to authenticated;

-- Mantem a versao antiga funcionando (apps ainda nao atualizados)
create or replace function public.set_my_booking_status(
  p_booking uuid,
  p_status text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_my_booking_status(p_booking, p_status, p_lat, p_lng, null::double precision);
end;
$$;

grant execute on function public.set_my_booking_status(uuid, text, double precision, double precision) to authenticated;

-- 5) Lockout tambem para de exigir permissao de cargo
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
    raise exception 'Você não está na equipe desta limpeza. Fale com o escritório.';
  end if;

  if v_status <> 'em_andamento' then
    raise exception 'Faça o check-in na casa antes de informar que não conseguiu entrar';
  end if;

  update public.bookings
     set lockout_status = 'solicitado', lockout_requested_at = now()
   where id = p_booking;
end;
$$;

-- 6) PREVENCAO: relatorio de saude para a gestao ver problemas
--    ANTES de a equipe travar na porta da casa.
create or replace function public.operation_health()
returns table (tipo text, item text, detalhe text, gravidade text)
language sql stable security definer set search_path = public as $$
  -- Pessoas de campo fora de qualquer equipe
  select 'pessoa'::text,
         m.full_name,
         'Não está em nenhuma equipe — não conseguirá fazer check-in',
         'alta'::text
    from public.memberships m
   where m.company_id = public.current_company_id()
     and m.active
     and m.role = 'cleaner'
     and not exists (
       select 1 from public.team_members tm where tm.profile_id = m.user_id
     )
     and public.is_manager()

  union all
  -- Clientes com limpeza agendada e sem coordenadas
  select 'cliente'::text,
         c.full_name,
         'Sem localização no mapa — check-in fica sem validação de local',
         'media'::text
    from public.clients c
   where c.company_id = public.current_company_id()
     and c.status = 'ativo'
     and (c.lat is null or c.lng is null)
     and exists (
       select 1 from public.bookings b
        where b.client_id = c.id and b.scheduled_at > now()
     )
     and public.is_manager()

  union all
  -- Limpezas futuras sem equipe atribuida
  select 'agenda'::text,
         coalesce(c.full_name, 'Limpeza'),
         'Limpeza de ' || to_char(b.scheduled_at at time zone 'America/New_York', 'DD/MM') ||
         ' sem equipe definida — ninguém verá na agenda',
         'alta'::text
    from public.bookings b
    left join public.clients c on c.id = b.client_id
   where b.company_id = public.current_company_id()
     and b.team_id is null
     and b.status in ('agendado','a_caminho')
     and b.scheduled_at > now()
     and public.is_manager()

  union all
  -- Clientes ativos sem valor definido (fatura nao nasce)
  select 'cobranca'::text,
         c.full_name,
         'Sem valor por limpeza — a fatura não é gerada no check-out',
         'media'::text
    from public.clients c
   where c.company_id = public.current_company_id()
     and c.status = 'ativo'
     and coalesce(c.default_price, 0) = 0
     and public.is_manager();
$$;

grant execute on function public.operation_health() to authenticated;
