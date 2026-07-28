-- =============================================================
-- CleanFlow AI - Migracao 19: papel de marketing
-- Marketing inclui leads e faz follow-up, mas NAO decide o destino
-- (finalizou / nao aceitou / em espera) — isso e da gestao.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Novo papel
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check
  check (role in ('owner','admin','supervisor','cleaner','marketing'));

-- 2) Helper
create or replace function public.is_marketing()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() = 'marketing', false);
$$;

-- 3) Marketing enxerga e cadastra clientes (sem acesso a valores/pagamentos)
drop policy if exists "clients_manager_all" on public.clients;
create policy "clients_manager_all" on public.clients
  for all using (
    company_id = public.current_company_id()
    and (public.is_manager() or public.is_marketing())
  )
  with check (
    company_id = public.current_company_id()
    and (public.is_manager() or public.is_marketing())
  );

-- 4) TRAVA: quem nao e gestao nao muda o destino do cliente
create or replace function public.guard_client_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.is_manager() then
      raise exception 'Somente a gestão pode definir o destino do cliente (ativo, em espera, não fechou, ex-cliente)';
    end if;
  end if;
  if tg_op = 'INSERT' and new.status not in ('lead','ativo') and not public.is_manager() then
    raise exception 'Novos cadastros feitos pelo marketing entram como lead';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_status_guard on public.clients;
create trigger clients_status_guard
  before insert or update on public.clients
  for each row execute function public.guard_client_status();
