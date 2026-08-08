-- =============================================================
-- CleanFlow AI - Migracao 45: limpeza comercial (base)
--
-- Primeiro passo do modulo comercial: separa o QUE o cliente e,
-- sem ainda mudar o motor de preco. Assim a operacao ja fica
-- organizada e os relatorios separam os dois mundos.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Tipo de cliente
alter table public.clients add column if not exists client_type text not null default 'residencial';
do $$ begin
  alter table public.clients add constraint clients_client_type_check
    check (client_type in ('residencial','comercial'));
exception when duplicate_object then null; end $$;

-- 2) Segmento (so faz sentido no comercial)
alter table public.clients add column if not exists business_segment text;
do $$ begin
  alter table public.clients add constraint clients_segment_check
    check (business_segment is null or business_segment in (
      'escritorio','restaurante','loja','galeria','supermercado','academia',
      'clinica','condominio','escola','fabrica','hotel','igreja','outro'
    ));
exception when duplicate_object then null; end $$;

-- 3) Dados que so o comercial usa
alter table public.clients add column if not exists area_sqft int;
alter table public.clients add column if not exists contact_role text;
alter table public.clients add column if not exists access_notes text;
alter table public.clients add column if not exists billing_type text not null default 'por_limpeza';
do $$ begin
  alter table public.clients add constraint clients_billing_type_check
    check (billing_type in ('por_limpeza','mensal_fixo'));
exception when duplicate_object then null; end $$;

alter table public.clients add column if not exists monthly_contract_value numeric(10,2);
alter table public.clients add column if not exists payment_terms text;

-- 4) Catalogo de areas por segmento (a empresa edita)
create table if not exists public.commercial_areas (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  segment text not null,
  name text not null,
  minutes int not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists comm_areas_idx on public.commercial_areas(company_id, segment);
alter table public.commercial_areas enable row level security;

do $$ begin
  create policy "comm_areas_read" on public.commercial_areas
    for select using (company_id = public.current_company_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "comm_areas_manage" on public.commercial_areas
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

-- 5) Catalogo inicial por segmento
insert into public.commercial_areas (company_id, segment, name, minutes)
select c.id, x.segment, x.name, x.minutes
  from public.companies c
 cross join (values
   -- Escritorio
   ('escritorio','Estações de trabalho', 40),
   ('escritorio','Salas de reunião', 25),
   ('escritorio','Copa / cozinha', 30),
   ('escritorio','Banheiros', 35),
   ('escritorio','Recepção e corredores', 25),
   ('escritorio','Vidros internos', 30),
   -- Restaurante
   ('restaurante','Cozinha — fogão e chapa', 60),
   ('restaurante','Cozinha — coifa e exaustor', 75),
   ('restaurante','Cozinha — fritadeira e grill', 45),
   ('restaurante','Cozinha — piso e ralos', 45),
   ('restaurante','Câmara fria', 40),
   ('restaurante','Salão e mesas', 45),
   ('restaurante','Bar', 30),
   ('restaurante','Banheiros de clientes', 40),
   ('restaurante','Área de lixo', 25),
   -- Loja e galeria
   ('loja','Área de vendas', 40),
   ('loja','Provadores', 20),
   ('loja','Vitrines e vidros', 30),
   ('loja','Estoque', 25),
   ('loja','Banheiros', 25),
   ('galeria','Salas de exposição', 45),
   ('galeria','Vidros e superfícies', 35),
   ('galeria','Recepção', 20),
   ('galeria','Banheiros', 25),
   ('galeria','Corredores e escadas', 25),
   -- Supermercado
   ('supermercado','Área de vendas e corredores', 90),
   ('supermercado','Açougue', 50),
   ('supermercado','Padaria', 45),
   ('supermercado','Câmaras frias', 40),
   ('supermercado','Caixas e frente de loja', 35),
   ('supermercado','Banheiros', 40),
   ('supermercado','Estacionamento e carrinhos', 45),
   -- Academia
   ('academia','Equipamentos e aparelhos', 50),
   ('academia','Vestiários e chuveiros', 45),
   ('academia','Espelhos e vidros', 30),
   ('academia','Tatame / área funcional', 30),
   -- Clinica
   ('clinica','Salas de atendimento', 45),
   ('clinica','Recepção e espera', 30),
   ('clinica','Banheiros', 35),
   ('clinica','Área de esterilização', 30),
   -- Condominio
   ('condominio','Hall e portaria', 30),
   ('condominio','Elevadores', 20),
   ('condominio','Garagem', 45),
   ('condominio','Salão de festas', 40),
   ('condominio','Escadas e corredores', 35),
   -- Escola
   ('escola','Salas de aula', 60),
   ('escola','Refeitório', 45),
   ('escola','Banheiros', 45),
   ('escola','Pátio e corredores', 40),
   -- Fabrica
   ('fabrica','Chão de fábrica', 90),
   ('fabrica','Vestiários', 40),
   ('fabrica','Refeitório', 45),
   ('fabrica','Escritório administrativo', 35),
   -- Hotel
   ('hotel','Quartos', 40),
   ('hotel','Lobby e recepção', 35),
   ('hotel','Corredores', 30),
   ('hotel','Área de café da manhã', 40),
   -- Igreja
   ('igreja','Templo / auditório', 60),
   ('igreja','Salas de aula', 40),
   ('igreja','Banheiros', 35),
   ('igreja','Cozinha e copa', 30)
 ) as x(segment, name, minutes)
 where not exists (
   select 1 from public.commercial_areas ca where ca.company_id = c.id
 );

-- 6) Conferencia
select client_type, count(*) from public.clients group by client_type;
