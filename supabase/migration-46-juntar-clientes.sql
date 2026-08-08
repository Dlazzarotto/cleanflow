-- =============================================================
-- CleanFlow AI - Migracao 46: encontrar e juntar clientes repetidos
--
-- Acontece quando a gestao cadastra um cliente que o marketing
-- ja tinha lancado como lead (ou vice-versa).
--
-- JUNTAR e mais seguro que apagar: o historico dos dois vai para
-- um cadastro so, nada se perde.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Normaliza texto para comparar (sem acento, sem pontuacao, minusculo)
create or replace function public.normalizar(p_texto text)
returns text language sql immutable as $func$
  select lower(regexp_replace(
    translate(coalesce(p_texto,''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-zA-Z0-9]', '', 'g'));
$func$;

-- Só os dígitos do telefone
create or replace function public.so_digitos(p_texto text)
returns text language sql immutable as $func$
  select right(regexp_replace(coalesce(p_texto,''), '[^0-9]', '', 'g'), 10);
$func$;

-- 2) Encontra cadastros que parecem ser a mesma pessoa
create or replace function public.find_duplicate_clients()
returns table (
  id_a uuid, nome_a text, status_a text, criado_a timestamptz,
  limpezas_a int, faturas_a int,
  id_b uuid, nome_b text, status_b text, criado_b timestamptz,
  limpezas_b int, faturas_b int,
  motivo text
) language sql stable security definer set search_path = public as $func$
  select
    a.id, a.full_name, a.status, a.created_at,
    (select count(*)::int from public.bookings x where x.client_id = a.id),
    (select count(*)::int from public.invoices x where x.client_id = a.id),
    b.id, b.full_name, b.status, b.created_at,
    (select count(*)::int from public.bookings x where x.client_id = b.id),
    (select count(*)::int from public.invoices x where x.client_id = b.id),
    case
      when public.so_digitos(a.phone) = public.so_digitos(b.phone)
           and length(public.so_digitos(a.phone)) = 10 then 'mesmo telefone'
      when lower(trim(a.email)) = lower(trim(b.email)) and a.email is not null then 'mesmo email'
      else 'nome parecido'
    end
  from public.clients a
  join public.clients b
    on a.company_id = b.company_id
   and a.id < b.id
   and a.status <> 'deletado'
   and b.status <> 'deletado'
   and (
     (public.so_digitos(a.phone) = public.so_digitos(b.phone)
       and length(public.so_digitos(a.phone)) = 10)
     or (lower(trim(a.email)) = lower(trim(b.email))
       and coalesce(trim(a.email),'') <> '')
     or public.normalizar(a.full_name) = public.normalizar(b.full_name)
   )
  where a.company_id = public.current_company_id()
    and public.is_manager()
  order by a.created_at;
$func$;

grant execute on function public.find_duplicate_clients() to authenticated;

-- 3) Junta dois cadastros: tudo vai para o principal
create or replace function public.merge_clients(p_principal uuid, p_duplicado uuid)
returns text language plpgsql security definer set search_path = public as $func$
declare
  v_company uuid;
  v_movidos int := 0;
  v_nome text;
begin
  if not public.is_manager() then
    raise exception 'Apenas a gestão pode juntar cadastros';
  end if;

  if p_principal = p_duplicado then
    raise exception 'Selecione dois cadastros diferentes';
  end if;

  select company_id into v_company from public.clients where id = p_principal;
  if v_company is null or v_company <> public.current_company_id() then
    raise exception 'Cadastro não encontrado nesta empresa';
  end if;

  if not exists (
    select 1 from public.clients where id = p_duplicado and company_id = v_company
  ) then
    raise exception 'Cadastro duplicado não encontrado nesta empresa';
  end if;

  select full_name into v_nome from public.clients where id = p_duplicado;

  -- Move tudo o que aponta para o duplicado
  update public.bookings set client_id = p_principal where client_id = p_duplicado;
  get diagnostics v_movidos = row_count;

  update public.invoices set client_id = p_principal where client_id = p_duplicado;
  update public.estimates set client_id = p_principal where client_id = p_duplicado;
  update public.incidents set client_id = p_principal where client_id = p_duplicado;
  update public.client_messages set client_id = p_principal where client_id = p_duplicado;

  -- Completa no principal o que estiver em branco, aproveitando o duplicado
  update public.clients p
     set phone        = coalesce(nullif(trim(p.phone),''), d.phone),
         email        = coalesce(nullif(trim(p.email),''), d.email),
         address      = coalesce(nullif(trim(p.address),''), d.address),
         lat          = coalesce(p.lat, d.lat),
         lng          = coalesce(p.lng, d.lng),
         unit         = coalesce(nullif(trim(p.unit),''), d.unit),
         door_code    = coalesce(nullif(trim(p.door_code),''), d.door_code),
         alarm_notes  = coalesce(nullif(trim(p.alarm_notes),''), d.alarm_notes),
         preferences  = coalesce(nullif(trim(p.preferences),''), d.preferences),
         products_notes = coalesce(nullif(trim(p.products_notes),''), d.products_notes),
         pets_notes   = coalesce(nullif(trim(p.pets_notes),''), d.pets_notes),
         has_pets     = p.has_pets or d.has_pets,
         frequency    = coalesce(p.frequency, d.frequency),
         default_price = coalesce(nullif(p.default_price, 0), d.default_price),
         payment_method = coalesce(p.payment_method, d.payment_method),
         preferred_team_id = coalesce(p.preferred_team_id, d.preferred_team_id),
         source       = coalesce(nullif(trim(p.source),''), d.source),
         -- Se um dos dois veio do marketing, o crédito fica com o marketing
         entry_source = case when d.entry_source = 'marketing' or p.entry_source = 'marketing'
                             then 'marketing' else p.entry_source end,
         campaign_id  = coalesce(p.campaign_id, d.campaign_id),
         created_by   = coalesce(p.created_by, d.created_by),
         notes        = trim(both E'\n' from
                          coalesce(p.notes,'') || E'\n' ||
                          case when coalesce(trim(d.notes),'') <> ''
                               then '[do cadastro juntado] ' || d.notes else '' end)
    from public.clients d
   where p.id = p_principal and d.id = p_duplicado;

  -- O duplicado sai de cena
  delete from public.clients where id = p_duplicado;

  return format('Cadastros juntados. %s limpeza(s) movida(s) de "%s".', v_movidos, v_nome);
end;
$func$;

grant execute on function public.merge_clients(uuid, uuid) to authenticated;

-- 4) Campo de anotações, se ainda não existir
alter table public.clients add column if not exists notes text;

-- 5) Diagnóstico: quantos parecem repetidos hoje
select count(*) as pares_suspeitos from public.find_duplicate_clients();
