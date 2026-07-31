-- =============================================================
-- CleanFlow AI - Migracao 16: banimento de cliente com motivo
-- Somente owner bane; motivo obrigatorio (trava no banco).
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients add column if not exists ban_reason text;
alter table public.clients add column if not exists banned_at timestamptz;
alter table public.clients add column if not exists banned_by uuid references auth.users(id) on delete set null;

-- Trava: nao existe cliente deletado/banido sem motivo registrado
create or replace function public.check_ban_reason()
returns trigger language plpgsql as $$
begin
  -- Exige motivo apenas no momento do banimento (nao a cada atualizacao posterior)
  if new.status = 'deletado'
     and (tg_op = 'INSERT' or old.status is distinct from 'deletado')
     and coalesce(trim(new.ban_reason), '') = '' then
    raise exception 'Para deletar/banir um cliente é obrigatório registrar o motivo';
  end if;
  if new.status <> 'deletado' then
    new.ban_reason := null;
    new.banned_at := null;
    new.banned_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_ban_reason on public.clients;
create trigger clients_ban_reason
  before insert or update on public.clients
  for each row execute function public.check_ban_reason();
