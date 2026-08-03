-- =============================================================
-- CleanFlow AI - Migracao 35: mensagens por SMS
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- Canal preferido das mensagens automaticas
alter table public.pricing_settings add column if not exists reminder_channel text not null default 'sms';
do $$ begin
  alter table public.pricing_settings add constraint pricing_reminder_channel_check
    check (reminder_channel in ('sms','email','ambos'));
exception when duplicate_object then null; end $$;

-- Cliente pode optar por nao receber SMS
alter table public.clients add column if not exists sms_opt_in boolean not null default true;

-- Historico aceita o canal sms (a coluna channel ja existe)
