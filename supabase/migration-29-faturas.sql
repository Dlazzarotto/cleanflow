-- =============================================================
-- CleanFlow AI - Migracao 29: faturas automaticas no check-out
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Como a empresa recebe (aparece na fatura do cliente)
alter table public.companies add column if not exists payment_instructions text;
alter table public.pricing_settings add column if not exists invoice_due_days int not null default 3;

-- 2) Faturas
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  booking_id uuid unique references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  number int not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'aberta'
    check (status in ('aberta','paga','vencida','cancelada')),
  issued_at timestamptz not null default now(),
  due_at date,
  paid_at timestamptz,
  paid_method text,
  paid_notes text,
  public_token uuid not null default uuid_generate_v4(),
  sent_at timestamptz,
  email_to text,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_company_number_idx on public.invoices(company_id, number);
create index if not exists invoices_company_status_idx on public.invoices(company_id, status);
create unique index if not exists invoices_token_idx on public.invoices(public_token);

alter table public.invoices enable row level security;

do $$ begin
  create policy "invoices_manager_all" on public.invoices
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 3) Fatura nasce sozinha quando a limpeza e concluida
create or replace function public.create_invoice_on_checkout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric(10,2);
  v_number int;
  v_days int;
begin
  if new.status <> 'concluido' or old.status = 'concluido' then
    return new;
  end if;

  if exists (select 1 from public.invoices where booking_id = new.id) then
    return new;
  end if;

  -- Valor: o da limpeza; se zerado, o valor padrao do cliente
  v_amount := new.price;
  if coalesce(v_amount, 0) = 0 then
    select coalesce(default_price, 0) into v_amount from public.clients where id = new.client_id;
  end if;

  if coalesce(v_amount, 0) = 0 then
    return new; -- sem valor definido, nao gera fatura
  end if;

  select coalesce(max(number), 0) + 1 into v_number
    from public.invoices where company_id = new.company_id;

  select coalesce(invoice_due_days, 3) into v_days
    from public.pricing_settings where company_id = new.company_id;

  insert into public.invoices (company_id, booking_id, client_id, number, amount, due_at)
  values (new.company_id, new.id, new.client_id, v_number, v_amount,
          (now() at time zone 'America/New_York')::date + coalesce(v_days, 3));

  return new;
end;
$$;

drop trigger if exists bookings_create_invoice on public.bookings;
create trigger bookings_create_invoice
  after update on public.bookings
  for each row execute function public.create_invoice_on_checkout();

-- 4) Consulta publica da fatura pelo link (sem login)
create or replace function public.get_invoice_by_token(p_token uuid)
returns table (
  number int,
  amount numeric,
  status text,
  issued_at timestamptz,
  due_at date,
  paid_at timestamptz,
  client_name text,
  client_language text,
  address text,
  service_date timestamptz,
  company_name text,
  company_phone text,
  company_email text,
  company_address text,
  payment_instructions text
) language sql stable security definer set search_path = public as $$
  select
    i.number, i.amount, i.status, i.issued_at, i.due_at, i.paid_at,
    c.full_name, c.language, c.address,
    b.scheduled_at,
    co.name, co.phone, co.email, co.address, co.payment_instructions
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  left join public.bookings b on b.id = i.booking_id
  join public.companies co on co.id = i.company_id
  where i.public_token = p_token;
$$;

grant execute on function public.get_invoice_by_token(uuid) to anon, authenticated;

-- 5) Marca faturas vencidas
create or replace function public.mark_overdue_invoices()
returns void language sql security definer set search_path = public as $$
  update public.invoices
     set status = 'vencida'
   where status = 'aberta'
     and due_at is not null
     and due_at < (now() at time zone 'America/New_York')::date;
$$;

grant execute on function public.mark_overdue_invoices() to authenticated;
