-- =============================================================
-- CleanFlow AI - Migracao 28: forma de pagamento, valor e contrato
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients add column if not exists payment_method text;
do $$ begin
  alter table public.clients add constraint clients_payment_method_check
    check (payment_method is null or payment_method in
      ('zelle','venmo','cheque','dinheiro','cartao','stripe','transferencia','outro'));
exception when duplicate_object then null; end $$;

alter table public.clients add column if not exists payment_notes text;
alter table public.clients add column if not exists default_price numeric(10,2);

alter table public.clients add column if not exists contract_status text not null default 'pendente';
do $$ begin
  alter table public.clients add constraint clients_contract_status_check
    check (contract_status in ('pendente','enviado','assinado','dispensado'));
exception when duplicate_object then null; end $$;

alter table public.clients add column if not exists contract_signed_at date;
