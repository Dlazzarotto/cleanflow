-- =============================================================
-- CleanFlow AI - Migracao 44: fatura so existe depois do servico
--
-- PROBLEMAS CORRIGIDOS:
--  1. A fatura nascia quando a limpeza era marcada como concluida,
--     mesmo com data no futuro (limpeza de 11/08 gerando fatura hoje).
--  2. O vencimento contava a partir de HOJE, nao da data do servico
--     — por isso apareciam faturas vencendo ANTES da limpeza.
--
-- REGRA: fatura so nasce quando o servico ja aconteceu, e vence
-- N dias depois da DATA DA LIMPEZA.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

create or replace function public.create_invoice_on_checkout()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_base numeric(10,2);
  v_extras numeric(10,2);
  v_number int;
  v_days int;
  v_invoice uuid;
  v_desc text;
  v_dia date;
  r record;
begin
  if new.status <> 'concluido' or old.status = 'concluido' then
    return new;
  end if;

  -- Servico que ainda nao aconteceu nao gera fatura
  if new.scheduled_at > now() then
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

  -- Vencimento conta a partir do dia do servico
  v_dia := (new.scheduled_at at time zone 'America/New_York')::date;

  insert into public.invoices (company_id, booking_id, client_id, number, amount, due_at)
  values (new.company_id, new.id, new.client_id, v_number,
          coalesce(v_base, 0) + coalesce(v_extras, 0),
          v_dia + coalesce(v_days, 3))
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
$func$;

-- =============================================================
-- LIMPEZA DOS DADOS: faturas criadas para servicos futuros
-- =============================================================

-- 1) Quais serao removidas
select i.number, c.full_name as cliente, i.amount, i.status,
       (b.scheduled_at at time zone 'America/New_York')::date as limpeza_marcada_para
  from public.invoices i
  join public.bookings b on b.id = i.booking_id
  left join public.clients c on c.id = i.client_id
 where b.scheduled_at > now()
   and i.status <> 'paga'
 order by i.number;

-- 2) Remove os itens e as faturas de servicos que ainda nao aconteceram
delete from public.invoice_items
 where invoice_id in (
   select i.id from public.invoices i
     join public.bookings b on b.id = i.booking_id
    where b.scheduled_at > now() and i.status <> 'paga'
 );

delete from public.invoices i
 using public.bookings b
 where b.id = i.booking_id
   and b.scheduled_at > now()
   and i.status <> 'paga';

-- 3) A limpeza volta para agendada (foi marcada como concluida antes da hora)
update public.bookings
   set status = 'agendado'
 where scheduled_at > now()
   and status = 'concluido';

-- 4) Corrige o vencimento das faturas que ficaram com data anterior ao servico
update public.invoices i
   set due_at = (b.scheduled_at at time zone 'America/New_York')::date
                + coalesce((select invoice_due_days from public.pricing_settings ps
                             where ps.company_id = i.company_id), 3)
  from public.bookings b
 where b.id = i.booking_id
   and i.status in ('aberta','vencida')
   and i.due_at < (b.scheduled_at at time zone 'America/New_York')::date;

-- 5) Reavalia o que esta realmente vencido
update public.invoices
   set status = 'aberta'
 where status = 'vencida'
   and due_at >= (now() at time zone 'America/New_York')::date;

-- Conferencia
select
  (select count(*) from public.invoices i join public.bookings b on b.id = i.booking_id
    where b.scheduled_at > now()) as faturas_de_servico_futuro,
  (select count(*) from public.invoices i join public.bookings b on b.id = i.booking_id
    where i.due_at < (b.scheduled_at at time zone 'America/New_York')::date) as vencimento_antes_do_servico,
  (select count(*) from public.invoices) as total_de_faturas;

-- =============================================================
-- Trava no banco: nao aceitar conclusao de servico futuro
-- =============================================================
create or replace function public.guard_future_completion()
returns trigger
language plpgsql
as $func$
begin
  if new.status = 'concluido'
     and old.status <> 'concluido'
     and new.scheduled_at > now() + interval '1 hour' then
    raise exception 'Esta limpeza está marcada para %. Só é possível concluir depois do serviço acontecer.',
      to_char(new.scheduled_at at time zone 'America/New_York', 'DD/MM/YYYY HH24:MI');
  end if;
  return new;
end;
$func$;

drop trigger if exists bookings_guard_future on public.bookings;
create trigger bookings_guard_future
  before update on public.bookings
  for each row execute function public.guard_future_completion();
