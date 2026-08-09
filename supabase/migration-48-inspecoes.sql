-- =============================================================
-- CleanFlow AI - Migracao 48: inspecoes de qualidade
--
-- O supervisor visita o local, avalia ponto a ponto com nota e
-- foto, e o cliente recebe um relatorio. E o que protege o
-- contrato comercial: prova documentada do servico entregue.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Modelos de inspecao (a empresa monta, por segmento ou cliente)
create table if not exists public.inspection_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  segment text,
  client_id uuid references public.clients(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists insp_templates_idx on public.inspection_templates(company_id, active);

-- 2) Pontos avaliados em cada modelo
create table if not exists public.inspection_points (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references public.inspection_templates(id) on delete cascade,
  area text not null,
  item text not null,
  requires_photo boolean not null default false,
  sort_order int not null default 0
);

create index if not exists insp_points_idx on public.inspection_points(template_id, sort_order);

-- 3) Inspecoes realizadas
create table if not exists public.inspections (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  template_id uuid references public.inspection_templates(id) on delete set null,
  inspector_id uuid not null references auth.users(id) on delete restrict,
  inspector_name text not null,
  score numeric(5,2),
  max_score numeric(5,2),
  percent numeric(5,2),
  status text not null default 'rascunho'
    check (status in ('rascunho','concluida','enviada')),
  notes text,
  lat double precision,
  lng double precision,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sent_at timestamptz,
  public_token uuid not null default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

create index if not exists inspections_company_idx on public.inspections(company_id, created_at desc);
create index if not exists inspections_client_idx on public.inspections(client_id, created_at desc);
create unique index if not exists inspections_token_idx on public.inspections(public_token);

-- 4) Resultado de cada ponto avaliado
create table if not exists public.inspection_results (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  area text not null,
  item text not null,
  rating int check (rating between 0 and 5),
  na boolean not null default false,
  comment text,
  photos text[] not null default '{}',
  sort_order int not null default 0
);

create index if not exists insp_results_idx on public.inspection_results(inspection_id, sort_order);

-- 5) Seguranca
alter table public.inspection_templates enable row level security;
alter table public.inspection_points enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_results enable row level security;

do $$ begin
  create policy "insp_templates_read" on public.inspection_templates
    for select using (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insp_templates_manage" on public.inspection_templates
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insp_points_read" on public.inspection_points
    for select using (
      template_id in (select id from public.inspection_templates
                       where company_id = public.current_company_id())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insp_points_manage" on public.inspection_points
    for all using (
      public.is_manager() and template_id in (
        select id from public.inspection_templates where company_id = public.current_company_id()
      )
    )
    with check (
      public.is_manager() and template_id in (
        select id from public.inspection_templates where company_id = public.current_company_id()
      )
    );
exception when duplicate_object then null; end $$;

-- Inspecao: gestao ve tudo; quem inspecionou ve a propria
do $$ begin
  create policy "inspections_select" on public.inspections
    for select using (
      company_id = public.current_company_id()
      and (public.is_manager() or inspector_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inspections_insert" on public.inspections
    for insert with check (
      company_id = public.current_company_id() and inspector_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inspections_update" on public.inspections
    for update using (
      company_id = public.current_company_id()
      and (public.is_manager() or (inspector_id = auth.uid() and status = 'rascunho'))
    )
    with check (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insp_results_all" on public.inspection_results
    for all using (
      inspection_id in (
        select id from public.inspections
         where company_id = public.current_company_id()
           and (public.is_manager() or inspector_id = auth.uid())
      )
    )
    with check (
      inspection_id in (
        select id from public.inspections
         where company_id = public.current_company_id()
           and (public.is_manager() or inspector_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- 6) Fotos das inspecoes (bucket proprio, isolado por empresa)
insert into storage.buckets (id, name, public)
values ('inspecoes', 'inspecoes', false)
on conflict (id) do nothing;

do $$ begin
  create policy "inspecoes_upload" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'inspecoes'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inspecoes_leitura" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'inspecoes'
      and (storage.foldername(name))[1] = public.current_company_id()::text
    );
exception when duplicate_object then null; end $$;

-- 7) Recalcula a nota ao mudar qualquer ponto
create or replace function public.recalc_inspection_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_id uuid;
  v_soma numeric;
  v_max numeric;
begin
  v_id := coalesce(new.inspection_id, old.inspection_id);

  select coalesce(sum(rating), 0), coalesce(count(*) filter (where not na and rating is not null) * 5, 0)
    into v_soma, v_max
    from public.inspection_results
   where inspection_id = v_id and not na;

  update public.inspections
     set score = v_soma,
         max_score = v_max,
         percent = case when v_max > 0 then round((v_soma / v_max) * 100, 1) else null end
   where id = v_id;

  return coalesce(new, old);
end;
$func$;

drop trigger if exists insp_results_score on public.inspection_results;
create trigger insp_results_score
  after insert or update or delete on public.inspection_results
  for each row execute function public.recalc_inspection_score();

-- 8) Relatorio publico para o cliente (link, sem login)
create or replace function public.get_inspection_by_token(p_token uuid)
returns table (
  id uuid, numero text, inspector_name text, percent numeric,
  score numeric, max_score numeric, notes text,
  finished_at timestamptz, client_name text, address text,
  company_name text, company_phone text, company_email text
) language sql stable security definer set search_path = public as $func$
  select
    i.id,
    to_char(i.created_at, 'YYYYMMDD') || '-' || substr(i.id::text, 1, 4),
    i.inspector_name, i.percent, i.score, i.max_score, i.notes,
    i.finished_at,
    c.full_name, c.address,
    co.name, co.phone, co.email
  from public.inspections i
  left join public.clients c on c.id = i.client_id
  join public.companies co on co.id = i.company_id
  where i.public_token = p_token and i.status in ('concluida','enviada');
$func$;

grant execute on function public.get_inspection_by_token(uuid) to anon, authenticated;

create or replace function public.get_inspection_results_by_token(p_token uuid)
returns table (area text, item text, rating int, na boolean, comment text, photos text[], sort_order int)
language sql stable security definer set search_path = public as $func$
  select r.area, r.item, r.rating, r.na, r.comment, r.photos, r.sort_order
    from public.inspection_results r
    join public.inspections i on i.id = r.inspection_id
   where i.public_token = p_token and i.status in ('concluida','enviada')
   order by r.sort_order, r.area, r.item;
$func$;

grant execute on function public.get_inspection_results_by_token(uuid) to anon, authenticated;

-- 9) Modelos iniciais por segmento
do $$
declare
  v_company uuid;
  v_template uuid;
  r record;
begin
  for v_company in select id from public.companies loop
    if exists (select 1 from public.inspection_templates where company_id = v_company) then
      continue;
    end if;

    -- Escritorio
    insert into public.inspection_templates (company_id, name, segment)
    values (v_company, 'Inspeção — Escritório', 'escritorio')
    returning id into v_template;

    for r in select * from (values
      ('Recepção','Piso limpo e sem manchas', 1),
      ('Recepção','Superfícies sem poeira', 2),
      ('Recepção','Vidros e portas limpos', 3),
      ('Estações de trabalho','Mesas limpas', 4),
      ('Estações de trabalho','Lixeiras esvaziadas', 5),
      ('Estações de trabalho','Piso aspirado', 6),
      ('Banheiros','Vasos e pias higienizados', 7),
      ('Banheiros','Espelhos sem marcas', 8),
      ('Banheiros','Papel e sabonete abastecidos', 9),
      ('Banheiros','Sem odor', 10),
      ('Copa','Bancada e pia limpas', 11),
      ('Copa','Micro-ondas e geladeira por fora', 12),
      ('Geral','Corredores e escadas', 13),
      ('Geral','Lixo levado para fora', 14)
    ) as t(area, item, ord) loop
      insert into public.inspection_points (template_id, area, item, sort_order, requires_photo)
      values (v_template, r.area, r.item, r.ord, r.ord in (7, 9));
    end loop;

    -- Restaurante
    insert into public.inspection_templates (company_id, name, segment)
    values (v_company, 'Inspeção — Restaurante', 'restaurante')
    returning id into v_template;

    for r in select * from (values
      ('Cozinha','Fogão e chapa desengordurados', 1),
      ('Cozinha','Coifa e filtros limpos', 2),
      ('Cozinha','Fritadeira e grill', 3),
      ('Cozinha','Piso sem gordura', 4),
      ('Cozinha','Ralos limpos e sem odor', 5),
      ('Cozinha','Bancadas de inox polidas', 6),
      ('Câmara fria','Piso e prateleiras', 7),
      ('Salão','Mesas e cadeiras', 8),
      ('Salão','Piso limpo', 9),
      ('Banheiros','Vasos e pias higienizados', 10),
      ('Banheiros','Abastecimento completo', 11),
      ('Área de lixo','Contentores limpos', 12)
    ) as t(area, item, ord) loop
      insert into public.inspection_points (template_id, area, item, sort_order, requires_photo)
      values (v_template, r.area, r.item, r.ord, r.ord in (1, 2, 5));
    end loop;

    -- Residencial
    insert into public.inspection_templates (company_id, name, segment)
    values (v_company, 'Inspeção — Residencial', null)
    returning id into v_template;

    for r in select * from (values
      ('Cozinha','Bancadas e pia', 1),
      ('Cozinha','Fogão e forno', 2),
      ('Cozinha','Piso', 3),
      ('Banheiros','Box e azulejos', 4),
      ('Banheiros','Vaso e pia', 5),
      ('Banheiros','Espelho', 6),
      ('Quartos','Camas arrumadas', 7),
      ('Quartos','Superfícies sem poeira', 8),
      ('Quartos','Piso aspirado', 9),
      ('Sala','Móveis sem poeira', 10),
      ('Sala','Piso', 11),
      ('Geral','Lixo recolhido', 12)
    ) as t(area, item, ord) loop
      insert into public.inspection_points (template_id, area, item, sort_order, requires_photo)
      values (v_template, r.area, r.item, r.ord, false);
    end loop;
  end loop;
end $$;

-- 10) Conferencia
select t.name, t.segment, count(p.id) as pontos
  from public.inspection_templates t
  left join public.inspection_points p on p.template_id = t.id
 group by t.id, t.name, t.segment
 order by t.name;
