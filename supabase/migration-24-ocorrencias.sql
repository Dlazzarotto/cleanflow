-- =============================================================
-- CleanFlow AI - Migracao 24: ocorrencias com fotos (auditoria)
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Bucket privado para as fotos
insert into storage.buckets (id, name, public)
values ('ocorrencias', 'ocorrencias', false)
on conflict (id) do nothing;

-- Fotos ficam em {company_id}/{arquivo} — cada empresa so acessa a propria pasta
do $$ begin
  create policy "ocorrencias_upload" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'ocorrencias'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ocorrencias_leitura" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'ocorrencias'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    );
exception when duplicate_object then null; end $$;

-- 2) Registro de ocorrencias
create table if not exists public.incidents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  reported_by uuid not null references auth.users(id) on delete restrict,
  reporter_name text not null,
  kind text not null default 'outro'
    check (kind in ('dano_pre_existente','incidente_limpeza','acesso','seguranca','equipamento','outro')),
  moment text not null default 'chegada'
    check (moment in ('chegada','durante','saida')),
  severity text not null default 'media'
    check (severity in ('baixa','media','alta')),
  description text not null,
  photos text[] not null default '{}',
  status text not null default 'aberta'
    check (status in ('aberta','em_analise','resolvida')),
  resolution_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists incidents_company_idx on public.incidents(company_id, created_at desc);
create index if not exists incidents_client_idx on public.incidents(client_id);
create index if not exists incidents_booking_idx on public.incidents(booking_id);

alter table public.incidents enable row level security;

-- Equipe registra; nao pode alterar depois (auditoria)
do $$ begin
  create policy "incidents_insert" on public.incidents
    for insert with check (
      company_id = public.current_company_id() and reported_by = auth.uid()
    );
exception when duplicate_object then null; end $$;

-- Gestao ve tudo; quem reportou ve o proprio registro
do $$ begin
  create policy "incidents_select" on public.incidents
    for select using (
      company_id = public.current_company_id()
      and (public.is_manager() or reported_by = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Somente a gestao trata/resolve
do $$ begin
  create policy "incidents_update_manager" on public.incidents
    for update using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 3) Trava de auditoria: o relato original nao pode ser reescrito nem apagado
create or replace function public.protect_incident_log()
returns trigger language plpgsql as $$
begin
  if new.description is distinct from old.description
     or new.photos is distinct from old.photos
     or new.reported_by is distinct from old.reported_by
     or new.created_at is distinct from old.created_at
     or new.kind is distinct from old.kind
     or new.moment is distinct from old.moment then
    raise exception 'O relato original de uma ocorrência não pode ser alterado (registro de auditoria)';
  end if;
  return new;
end;
$$;

drop trigger if exists incidents_immutable on public.incidents;
create trigger incidents_immutable
  before update on public.incidents
  for each row execute function public.protect_incident_log();

-- 4) A visao da equipe passa a expor o id do cliente
-- (coluna acrescentada no FIM — create or replace nao permite reordenar)
create or replace view public.team_agenda as
select
  b.id,
  b.team_id,
  b.scheduled_at,
  b.duration_minutes,
  b.status,
  case when public.has_perm('notes') then b.notes else null end as notes,
  c.full_name as client_name,
  c.address,
  case when public.has_perm('door_code') then c.door_code else null end as door_code,
  c.has_pets,
  c.pets_notes,
  case when public.has_perm('alarm') then c.alarm_notes else null end as alarm_notes,
  case when public.has_perm('preferences') then c.preferences else null end as preferences,
  case when public.has_perm('preferences') then c.products_notes else null end as products_notes,
  t.name  as team_name,
  t.color as team_color,
  c.lat,
  c.lng,
  c.unit,
  b.client_id
from public.bookings b
join public.clients c on c.id = b.client_id
left join public.teams t on t.id = b.team_id
where b.status <> 'cancelado'
  and exists (
    select 1 from public.team_members tm
     where tm.team_id = b.team_id
       and tm.profile_id = auth.uid()
  );

grant select on public.team_agenda to authenticated;
