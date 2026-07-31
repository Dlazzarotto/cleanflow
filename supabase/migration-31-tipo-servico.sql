-- =============================================================
-- CleanFlow AI - Migracao 31: tipo de servico (deep clean)
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Tipo de cada limpeza
alter table public.bookings add column if not exists service_type text not null default 'manutencao';
do $$ begin
  alter table public.bookings add constraint bookings_service_type_check
    check (service_type in ('manutencao','primeira','deep','pos_obra','mudanca'));
exception when duplicate_object then null; end $$;

-- 2) O estimate guarda os dois precos: primeira (profunda) e manutencao
alter table public.estimates add column if not exists first_price numeric(10,2);
alter table public.estimates add column if not exists recurring_price numeric(10,2);
alter table public.estimates add column if not exists first_minutes int;

-- 3) A visao da equipe mostra o tipo (coluna no FIM)
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
  b.lockout_status,
  b.service_type
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

-- 4) A fatura descreve o tipo do servico
create or replace function public.create_invoice_on_checkout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base numeric(10,2);
  v_extras numeric(10,2);
  v_number int;
  v_days int;
  v_invoice uuid;
  v_desc text;
  r record;
begin
  if new.status <> 'concluido' or old.status = 'concluido' then
    return new;
  end if;

  if exists (select 1 from public.invoices where booking_id = new.id) then
    return new;
  end if;

  v_base := new.price;
  if coalesce(v_base, 0) = 0 then
    select coalesce(default_price, 0) into v_base from public.clients where id = new.client_id;
  end if;

  select coalesce(sum(price), 0) into v_extras
    from public.booking_extras
   where booking_id = new.id and status = 'aprovado';

  if coalesce(v_base, 0) + coalesce(v_extras, 0) = 0 then
    return new;
  end if;

  select coalesce(max(number), 0) + 1 into v_number
    from public.invoices where company_id = new.company_id;

  select coalesce(invoice_due_days, 3) into v_days
    from public.pricing_settings where company_id = new.company_id;

  insert into public.invoices (company_id, booking_id, client_id, number, amount, due_at)
  values (new.company_id, new.id, new.client_id, v_number,
          coalesce(v_base, 0) + coalesce(v_extras, 0),
          (now() at time zone 'America/New_York')::date + coalesce(v_days, 3))
  returning id into v_invoice;

  v_desc := case new.service_type
    when 'primeira' then 'Primeira limpeza (profunda)'
    when 'deep'     then 'Limpeza profunda (deep cleaning)'
    when 'pos_obra' then 'Limpeza pós-obra'
    when 'mudanca'  then 'Limpeza de mudança'
    else 'Limpeza de manutenção'
  end;

  if coalesce(v_base, 0) > 0 then
    insert into public.invoice_items (invoice_id, description, amount, sort_order)
    values (v_invoice, v_desc, v_base, 0);
  end if;

  for r in
    select description, price from public.booking_extras
     where booking_id = new.id and status = 'aprovado'
  loop
    insert into public.invoice_items (invoice_id, description, amount, sort_order)
    values (v_invoice, r.description, coalesce(r.price, 0), 1);
  end loop;

  return new;
end;
$$;
