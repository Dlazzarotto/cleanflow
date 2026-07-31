-- =============================================================
-- CleanFlow AI - Migracao 23: origem de entrada do cliente
-- marketing  = veio de campanha/prospeccao do time de marketing
-- organico   = indicacao, retorno, contato direto (cadastro da gestao)
-- importado  = base antiga trazida de outro sistema
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients
  add column if not exists entry_source text not null default 'organico';

do $$ begin
  alter table public.clients
    add constraint clients_entry_source_check
    check (entry_source in ('marketing','organico','importado'));
exception when duplicate_object then null; end $$;

-- 1) Toda a base existente vira "importado" — nao conta nos relatorios de marketing
update public.clients set entry_source = 'importado';

-- 2) Zera os leads antigos: quem ja e cliente antigo nao fica na fila de leads
update public.clients
   set status = 'ativo'
 where status = 'lead';

-- 3) Cadastro feito pelo time de marketing entra SEMPRE como lead de marketing
create or replace function public.set_client_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if auth.uid() is not null and public.is_marketing() then
    new.entry_source := 'marketing';
    new.status := 'lead';
  end if;

  return new;
end;
$$;

drop trigger if exists clients_set_creator on public.clients;
create trigger clients_set_creator
  before insert on public.clients
  for each row execute function public.set_client_creator();

-- Conferencia
select entry_source, status, count(*)
  from public.clients
 group by entry_source, status
 order by 1, 2;
