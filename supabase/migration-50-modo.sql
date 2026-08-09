-- =============================================================
-- CleanFlow AI - Migracao 50: dois modos de operacao
--
-- O sistema passa a funcionar em dois modos separados:
--   RESIDENCIAL — casas
--   COMERCIAL   — escritorios, restaurantes, lojas...
--
-- Cada modo tem seu proprio menu e todas as telas mostram
-- apenas o que pertence a ele. A pessoa troca no menu.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.user_settings add column if not exists active_mode text not null default 'residencial';
do $$ begin
  alter table public.user_settings add constraint user_settings_mode_check
    check (active_mode in ('residencial','comercial'));
exception when duplicate_object then null; end $$;

-- Modo ativo da pessoa (cai para residencial se nao tiver o modulo)
create or replace function public.current_mode()
returns text language sql stable security definer set search_path = public as $func$
  select case
    when coalesce((select active_mode from public.user_settings where user_id = auth.uid()), 'residencial') = 'comercial'
         and public.has_commercial()
      then 'comercial'
    else 'residencial'
  end;
$func$;

grant execute on function public.current_mode() to authenticated;

-- Troca o modo
create or replace function public.set_mode(p_mode text)
returns void language plpgsql security definer set search_path = public as $func$
begin
  if p_mode not in ('residencial','comercial') then
    raise exception 'Modo inválido';
  end if;

  if p_mode = 'comercial' and not public.has_commercial() then
    raise exception 'O módulo comercial não está contratado nesta empresa';
  end if;

  insert into public.user_settings (user_id, active_mode)
  values (auth.uid(), p_mode)
  on conflict (user_id) do update set active_mode = excluded.active_mode;
end;
$func$;

grant execute on function public.set_mode(text) to authenticated;

-- Conferencia
select public.current_mode() as modo_atual, public.has_commercial() as tem_modulo;
