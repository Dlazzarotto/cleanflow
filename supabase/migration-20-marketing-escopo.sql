-- =============================================================
-- CleanFlow AI - Migracao 20: marketing so ve o que ele cadastrou
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Quem cadastrou o cliente
alter table public.clients
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists clients_created_by_idx on public.clients(created_by);

-- 2) Preenche automaticamente no cadastro
create or replace function public.set_client_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists clients_set_creator on public.clients;
create trigger clients_set_creator
  before insert on public.clients
  for each row execute function public.set_client_creator();

-- 3) RLS: gestao ve tudo; marketing ve apenas os proprios cadastros
drop policy if exists "clients_manager_all" on public.clients;
create policy "clients_manager_all" on public.clients
  for all using (
    company_id = public.current_company_id()
    and (
      public.is_manager()
      or (public.is_marketing() and created_by = auth.uid())
    )
  )
  with check (
    company_id = public.current_company_id()
    and (
      public.is_manager()
      or (public.is_marketing() and created_by = auth.uid())
    )
  );
