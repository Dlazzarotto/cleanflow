-- =============================================================
-- CleanFlow AI - Migracao 43: o valor do cadastro vale em TODO lugar
--
-- REGRA: o valor no cadastro do cliente e a unica fonte de verdade.
-- Ao alterar, muda na hora:
--   - limpezas nao concluidas (futuras E passadas ainda em aberto)
--   - limpezas concluidas cuja fatura ainda NAO foi paga
--   - faturas em aberto e vencidas, com seus itens
--
-- So NAO muda:
--   - fatura ja paga (o que foi cobrado esta cobrado)
--   - limpeza com preco definido a mao naquela limpeza (price_manual)
--   - limpeza profunda/pos-obra/mudanca, que tem preco proprio
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

create or replace function public.sync_price_from_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if coalesce(new.default_price, 0) = coalesce(old.default_price, 0) then
    return new;
  end if;

  -- 1) Limpezas que ainda nao foram pagas
  update public.bookings b
     set price = new.default_price
   where b.client_id = new.id
     and b.price_manual = false
     and coalesce(b.service_type, 'manutencao') = 'manutencao'
     and b.status <> 'cancelado'
     and not exists (
       select 1 from public.invoices i
        where i.booking_id = b.id and i.status = 'paga'
     );

  -- 2) Faturas em aberto do cliente
  update public.invoices i
     set amount = new.default_price + coalesce((
           select sum(be.price) from public.booking_extras be
            where be.booking_id = i.booking_id and be.status = 'aprovado'
         ), 0)
   where i.client_id = new.id
     and i.status in ('aberta','vencida');

  -- 3) Item principal de cada fatura em aberto
  update public.invoice_items it
     set amount = new.default_price
   where it.id in (
     select (select x.id from public.invoice_items x
              where x.invoice_id = i.id order by x.sort_order limit 1)
       from public.invoices i
      where i.client_id = new.id and i.status in ('aberta','vencida')
   );

  return new;
end;
$func$;

drop trigger if exists clients_sync_price on public.clients;
create trigger clients_sync_price
  after update of default_price on public.clients
  for each row execute function public.sync_price_from_client();

-- =============================================================
-- Alinha o que ja esta divergente
-- =============================================================

update public.bookings b
   set price = c.default_price
  from public.clients c
 where b.client_id = c.id
   and coalesce(c.default_price, 0) > 0
   and b.price_manual = false
   and coalesce(b.service_type, 'manutencao') = 'manutencao'
   and b.status <> 'cancelado'
   and coalesce(b.price, 0) <> c.default_price
   and not exists (
     select 1 from public.invoices i where i.booking_id = b.id and i.status = 'paga'
   );

update public.invoices i
   set amount = c.default_price + coalesce((
         select sum(be.price) from public.booking_extras be
          where be.booking_id = i.booking_id and be.status = 'aprovado'
       ), 0)
  from public.clients c
 where i.client_id = c.id
   and i.status in ('aberta','vencida')
   and coalesce(c.default_price, 0) > 0;

update public.invoice_items it
   set amount = c.default_price
  from public.invoices i
  join public.clients c on c.id = i.client_id
 where i.status in ('aberta','vencida')
   and coalesce(c.default_price, 0) > 0
   and it.id = (
     select x.id from public.invoice_items x
      where x.invoice_id = i.id order by x.sort_order limit 1
   );

-- Conferencia: tudo deve dar 0
select
  (select count(*) from public.bookings b join public.clients c on c.id = b.client_id
    where b.status <> 'cancelado' and b.price_manual = false
      and coalesce(c.default_price,0) > 0
      and coalesce(b.price,0) <> c.default_price
      and coalesce(b.service_type,'manutencao') = 'manutencao'
      and not exists (select 1 from public.invoices i where i.booking_id = b.id and i.status='paga')
  ) as limpezas_divergentes,
  (select count(*) from public.invoices i join public.clients c on c.id = i.client_id
    where i.status in ('aberta','vencida') and coalesce(c.default_price,0) > 0
      and abs(i.amount - c.default_price) > 0.01
  ) as faturas_divergentes;
