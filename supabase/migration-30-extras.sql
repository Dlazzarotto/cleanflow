-- =============================================================
-- CleanFlow AI - Migracao 30: servicos extras e itens da fatura
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Catalogo de extras (precos definidos pela gestao)
create table if not exists public.service_extras (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  minutes int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists extras_company_idx on public.service_extras(company_id);
alter table public.service_extras enable row level security;

-- Gestao administra; equipe apenas consulta (para escolher no app)
do $$ begin
  create policy "extras_read" on public.service_extras
    for select using (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "extras_manage" on public.service_extras
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 2) Extras pedidos em cada limpeza
create table if not exists public.booking_extras (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  extra_id uuid references public.service_extras(id) on delete set null,
  description text not null,
  price numeric(10,2),
  status text not null default 'solicitado'
    check (status in ('solicitado','aprovado','recusado')),
  requested_by uuid references auth.users(id) on delete set null,
  requester_name text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists booking_extras_booking_idx on public.booking_extras(booking_id);
create index if not exists booking_extras_company_idx on public.booking_extras(company_id, status);

alter table public.booking_extras enable row level security;

-- Equipe registra o pedido e ve os da propria limpeza
do $$ begin
  create policy "booking_extras_insert" on public.booking_extras
    for insert with check (
      company_id = public.current_company_id() and requested_by = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "booking_extras_select" on public.booking_extras
    for select using (
      company_id = public.current_company_id()
      and (public.is_manager() or requested_by = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "booking_extras_manage" on public.booking_extras
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 3) Itens da fatura (limpeza + extras aprovados)
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null default 0,
  sort_order int not null default 0
);

create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
alter table public.invoice_items enable row level security;

do $$ begin
  create policy "invoice_items_manager" on public.invoice_items
    for all using (
      invoice_id in (select id from public.invoices where company_id = public.current_company_id())
      and public.is_manager()
    )
    with check (
      invoice_id in (select id from public.invoices where company_id = public.current_company_id())
      and public.is_manager()
    );
exception when duplicate_object then null; end $$;

-- 4) Fatura no check-out passa a somar os extras aprovados
create or replace function public.create_invoice_on_checkout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base numeric(10,2);
  v_extras numeric(10,2);
  v_number int;
  v_days int;
  v_invoice uuid;
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

  if coalesce(v_base, 0) > 0 then
    insert into public.invoice_items (invoice_id, description, amount, sort_order)
    values (v_invoice, 'Limpeza', v_base, 0);
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

-- 5) Itens aparecem na fatura publica
create or replace function public.get_invoice_items_by_token(p_token uuid)
returns table (description text, amount numeric, sort_order int)
language sql stable security definer set search_path = public as $$
  select it.description, it.amount, it.sort_order
    from public.invoice_items it
    join public.invoices i on i.id = it.invoice_id
   where i.public_token = p_token
   order by it.sort_order, it.description;
$$;

grant execute on function public.get_invoice_items_by_token(uuid) to anon, authenticated;

-- 6) Catalogo inicial sugerido (so se a empresa ainda nao tiver nenhum)
insert into public.service_extras (company_id, name, price, minutes)
select c.id, x.name, x.price, x.minutes
  from public.companies c
 cross join (values
   ('Interior da geladeira', 40, 20),
   ('Interior do forno', 45, 25),
   ('Janelas por dentro', 50, 30),
   ('Limpeza de armários por dentro', 60, 40),
   ('Lavar e dobrar roupa (carga extra)', 25, 20),
   ('Limpeza de garagem', 60, 40),
   ('Aspirar sofá / estofados', 35, 20),
   ('Organização de closet', 55, 40)
 ) as x(name, price, minutes)
 where not exists (select 1 from public.service_extras se where se.company_id = c.id);
