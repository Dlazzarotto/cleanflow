-- =============================================================
-- CleanFlow AI - Migracao 51: catalogo detalhado por segmento
--
-- Ao escolher o tipo de comercio, o sistema traz TUDO que pode
-- ser limpo naquele lugar. A pessoa marca o que entra, informa
-- a quantidade e o grau de sujeira — e o tempo e o preco saem
-- calculados.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- Substitui a tabela simples anterior por uma com itens detalhados
alter table public.commercial_areas add column if not exists item text;
alter table public.commercial_areas add column if not exists unit text not null default 'unidade';
alter table public.commercial_areas add column if not exists minutes_per_unit numeric(6,2) not null default 15;
alter table public.commercial_areas add column if not exists default_qty numeric(8,2) not null default 1;
alter table public.commercial_areas add column if not exists sort_order int not null default 0;
alter table public.commercial_areas add column if not exists notes text;

do $$ begin
  alter table public.commercial_areas add constraint comm_areas_unit_check
    check (unit in ('unidade','sqft','metro','carga','conjunto'));
exception when duplicate_object then null; end $$;

-- Limpa o catalogo antigo (era generico demais) e recria detalhado
delete from public.commercial_areas where item is null;

-- Orcamentos comerciais
create table if not exists public.commercial_estimates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  lead_name text,
  lead_phone text,
  lead_email text,
  address text,
  segment text not null,
  area_sqft int,
  frequency text not null default 'semanal',
  visits_per_month numeric(4,2) not null default 4.3,
  soil_level text not null default 'medio'
    check (soil_level in ('leve','medio','pesado')),
  crew_size int not null default 2,
  night_shift boolean not null default false,
  supplies_included boolean not null default true,
  total_minutes numeric(8,2) not null default 0,
  hourly_rate numeric(8,2) not null default 45,
  price_per_visit numeric(10,2) not null default 0,
  price_monthly numeric(10,2) not null default 0,
  final_monthly numeric(10,2),
  status text not null default 'rascunho'
    check (status in ('rascunho','enviado','aprovado','recusado')),
  notes text,
  language text not null default 'pt',
  public_token uuid not null default uuid_generate_v4(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists com_est_company_idx on public.commercial_estimates(company_id, created_at desc);
create unique index if not exists com_est_token_idx on public.commercial_estimates(public_token);

-- Itens escolhidos em cada orcamento
create table if not exists public.commercial_estimate_items (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references public.commercial_estimates(id) on delete cascade,
  area text not null,
  item text not null,
  unit text not null default 'unidade',
  qty numeric(8,2) not null default 1,
  minutes_per_unit numeric(6,2) not null default 15,
  soil_multiplier numeric(4,2) not null default 1,
  minutes numeric(8,2) not null default 0,
  sort_order int not null default 0
);

create index if not exists com_est_items_idx on public.commercial_estimate_items(estimate_id, sort_order);

alter table public.commercial_estimates enable row level security;
alter table public.commercial_estimate_items enable row level security;

do $$ begin
  create policy "com_est_manage" on public.commercial_estimates
    for all using (company_id = public.current_company_id() and public.is_manager())
    with check (company_id = public.current_company_id() and public.is_manager());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "com_est_items_manage" on public.commercial_estimate_items
    for all using (
      estimate_id in (select id from public.commercial_estimates
                       where company_id = public.current_company_id())
      and public.is_manager()
    )
    with check (
      estimate_id in (select id from public.commercial_estimates
                       where company_id = public.current_company_id())
      and public.is_manager()
    );
exception when duplicate_object then null; end $$;

-- Proposta publica para o cliente
create or replace function public.get_commercial_estimate(p_token uuid)
returns table (
  id uuid, segment text, address text, frequency text,
  total_minutes numeric, price_per_visit numeric, price_monthly numeric,
  final_monthly numeric, notes text, language text, created_at timestamptz,
  client_name text, company_name text, company_phone text, company_email text,
  crew_size int, visits_per_month numeric
) language sql stable security definer set search_path = public as $func$
  select
    e.id, e.segment, e.address, e.frequency,
    e.total_minutes, e.price_per_visit, e.price_monthly,
    e.final_monthly, e.notes, e.language, e.created_at,
    coalesce(c.full_name, e.lead_name),
    co.name, co.phone, co.email,
    e.crew_size, e.visits_per_month
  from public.commercial_estimates e
  left join public.clients c on c.id = e.client_id
  join public.companies co on co.id = e.company_id
  where e.public_token = p_token;
$func$;

grant execute on function public.get_commercial_estimate(uuid) to anon, authenticated;

create or replace function public.get_commercial_estimate_items(p_token uuid)
returns table (area text, item text, qty numeric, unit text, minutes numeric)
language sql stable security definer set search_path = public as $func$
  select i.area, i.item, i.qty, i.unit, i.minutes
    from public.commercial_estimate_items i
    join public.commercial_estimates e on e.id = i.estimate_id
   where e.public_token = p_token
   order by i.sort_order, i.area, i.item;
$func$;

grant execute on function public.get_commercial_estimate_items(uuid) to anon, authenticated;

-- =============================================================
-- Catalogo detalhado: o que existe em cada tipo de comercio
-- =============================================================
do $$
declare v_company uuid;
begin
  for v_company in select id from public.companies loop
    insert into public.commercial_areas
      (company_id, segment, name, item, unit, minutes_per_unit, default_qty, sort_order)
    select v_company, x.segment, x.area, x.item, x.unit, x.minutos, x.qtd, x.ord
      from (values
  ('restaurante', 'Cozinha', 'Fogão industrial', 'unidade', 25, 1, 1),
  ('restaurante', 'Cozinha', 'Chapa / grill', 'unidade', 30, 1, 2),
  ('restaurante', 'Cozinha', 'Fritadeira', 'unidade', 20, 1, 3),
  ('restaurante', 'Cozinha', 'Coifa e filtros', 'unidade', 45, 1, 4),
  ('restaurante', 'Cozinha', 'Forno combinado', 'unidade', 35, 1, 5),
  ('restaurante', 'Cozinha', 'Bancadas de inox', 'metro', 8, 5, 6),
  ('restaurante', 'Cozinha', 'Pia e cuba industrial', 'unidade', 15, 2, 7),
  ('restaurante', 'Cozinha', 'Piso com desengordurante', 'sqft', 0.04, 400, 8),
  ('restaurante', 'Cozinha', 'Ralos e canaletas', 'unidade', 12, 3, 9),
  ('restaurante', 'Cozinha', 'Azulejos e paredes', 'sqft', 0.03, 300, 10),
  ('restaurante', 'Cozinha', 'Geladeira / freezer por fora', 'unidade', 15, 2, 11),
  ('restaurante', 'Câmara fria', 'Piso e prateleiras', 'unidade', 40, 1, 12),
  ('restaurante', 'Câmara fria', 'Porta e vedação', 'unidade', 10, 1, 13),
  ('restaurante', 'Salão', 'Mesas e cadeiras', 'unidade', 3, 20, 14),
  ('restaurante', 'Salão', 'Piso', 'sqft', 0.025, 800, 15),
  ('restaurante', 'Salão', 'Vidros e janelas', 'sqft', 0.05, 200, 16),
  ('restaurante', 'Salão', 'Balcão de atendimento', 'metro', 6, 4, 17),
  ('restaurante', 'Bar', 'Balcão e pia', 'metro', 10, 3, 18),
  ('restaurante', 'Bar', 'Geladeiras e expositores', 'unidade', 12, 3, 19),
  ('restaurante', 'Banheiros', 'Vaso sanitário', 'unidade', 8, 4, 20),
  ('restaurante', 'Banheiros', 'Pia e bancada', 'unidade', 6, 4, 21),
  ('restaurante', 'Banheiros', 'Espelhos', 'unidade', 4, 4, 22),
  ('restaurante', 'Banheiros', 'Piso e azulejos', 'sqft', 0.05, 120, 23),
  ('restaurante', 'Banheiros', 'Reposição de papel e sabonete', 'unidade', 3, 4, 24),
  ('restaurante', 'Área externa', 'Contentores de lixo', 'unidade', 10, 2, 25),
  ('restaurante', 'Área externa', 'Calçada e entrada', 'sqft', 0.02, 200, 26),
  ('escritorio', 'Estações de trabalho', 'Mesa e superfície', 'unidade', 3, 20, 1),
  ('escritorio', 'Estações de trabalho', 'Cadeira', 'unidade', 2, 20, 2),
  ('escritorio', 'Estações de trabalho', 'Lixeira individual', 'unidade', 1, 20, 3),
  ('escritorio', 'Estações de trabalho', 'Piso / carpete aspirado', 'sqft', 0.015, 1500, 4),
  ('escritorio', 'Salas de reunião', 'Mesa grande e cadeiras', 'unidade', 15, 2, 5),
  ('escritorio', 'Salas de reunião', 'Quadro branco / TV', 'unidade', 5, 2, 6),
  ('escritorio', 'Recepção', 'Balcão', 'metro', 6, 3, 7),
  ('escritorio', 'Recepção', 'Sofás e poltronas', 'unidade', 8, 4, 8),
  ('escritorio', 'Recepção', 'Piso', 'sqft', 0.02, 300, 9),
  ('escritorio', 'Copa', 'Bancada e pia', 'metro', 8, 3, 10),
  ('escritorio', 'Copa', 'Micro-ondas', 'unidade', 8, 2, 11),
  ('escritorio', 'Copa', 'Geladeira por fora', 'unidade', 10, 1, 12),
  ('escritorio', 'Copa', 'Mesas e cadeiras', 'unidade', 3, 6, 13),
  ('escritorio', 'Banheiros', 'Vaso sanitário', 'unidade', 8, 6, 14),
  ('escritorio', 'Banheiros', 'Pia e bancada', 'unidade', 6, 6, 15),
  ('escritorio', 'Banheiros', 'Espelhos', 'unidade', 4, 6, 16),
  ('escritorio', 'Banheiros', 'Piso e azulejos', 'sqft', 0.05, 200, 17),
  ('escritorio', 'Banheiros', 'Reposição de suprimentos', 'unidade', 3, 6, 18),
  ('escritorio', 'Circulação', 'Corredores', 'sqft', 0.015, 500, 19),
  ('escritorio', 'Circulação', 'Escadas', 'unidade', 12, 2, 20),
  ('escritorio', 'Circulação', 'Elevadores', 'unidade', 10, 2, 21),
  ('escritorio', 'Vidros', 'Vidros internos e divisórias', 'sqft', 0.04, 400, 22),
  ('escritorio', 'Geral', 'Retirada de lixo', 'unidade', 10, 1, 23),
  ('hotel', 'Quartos', 'Quarto padrão completo', 'unidade', 35, 20, 1),
  ('hotel', 'Quartos', 'Suíte', 'unidade', 50, 5, 2),
  ('hotel', 'Quartos', 'Troca de roupa de cama', 'unidade', 8, 20, 3),
  ('hotel', 'Quartos', 'Banheiro do quarto', 'unidade', 15, 20, 4),
  ('hotel', 'Lobby', 'Piso e tapetes', 'sqft', 0.02, 800, 5),
  ('hotel', 'Lobby', 'Balcão de recepção', 'metro', 6, 5, 6),
  ('hotel', 'Lobby', 'Sofás e poltronas', 'unidade', 8, 8, 7),
  ('hotel', 'Lobby', 'Vidros e portas', 'sqft', 0.04, 300, 8),
  ('hotel', 'Café da manhã', 'Buffet e balcões', 'metro', 10, 6, 9),
  ('hotel', 'Café da manhã', 'Mesas e cadeiras', 'unidade', 3, 20, 10),
  ('hotel', 'Café da manhã', 'Cozinha de apoio', 'unidade', 45, 1, 11),
  ('hotel', 'Corredores', 'Piso e carpete', 'sqft', 0.015, 1200, 12),
  ('hotel', 'Corredores', 'Elevadores', 'unidade', 10, 2, 13),
  ('hotel', 'Áreas comuns', 'Academia', 'unidade', 40, 1, 14),
  ('hotel', 'Áreas comuns', 'Piscina (borda e deck)', 'unidade', 45, 1, 15),
  ('hotel', 'Áreas comuns', 'Banheiros públicos', 'unidade', 25, 4, 16),
  ('hotel', 'Lavanderia', 'Área de lavagem', 'unidade', 30, 1, 17),
  ('condominio', 'Hall', 'Piso e entrada', 'sqft', 0.02, 400, 1),
  ('condominio', 'Hall', 'Portaria e balcão', 'unidade', 20, 1, 2),
  ('condominio', 'Hall', 'Vidros e portas', 'sqft', 0.04, 200, 3),
  ('condominio', 'Elevadores', 'Cabine completa', 'unidade', 15, 2, 4),
  ('condominio', 'Elevadores', 'Portas e frisos externos', 'unidade', 8, 2, 5),
  ('condominio', 'Circulação', 'Corredores por andar', 'unidade', 12, 8, 6),
  ('condominio', 'Circulação', 'Escadas por lance', 'unidade', 10, 8, 7),
  ('condominio', 'Garagem', 'Varrição', 'sqft', 0.008, 5000, 8),
  ('condominio', 'Garagem', 'Lavagem de piso', 'sqft', 0.02, 5000, 9),
  ('condominio', 'Salão de festas', 'Salão completo', 'unidade', 60, 1, 10),
  ('condominio', 'Salão de festas', 'Cozinha de apoio', 'unidade', 30, 1, 11),
  ('condominio', 'Áreas comuns', 'Academia', 'unidade', 40, 1, 12),
  ('condominio', 'Áreas comuns', 'Piscina (borda e deck)', 'unidade', 45, 1, 13),
  ('condominio', 'Áreas comuns', 'Playground', 'unidade', 25, 1, 14),
  ('condominio', 'Áreas comuns', 'Banheiros comuns', 'unidade', 20, 2, 15),
  ('condominio', 'Externo', 'Calçada e entrada', 'sqft', 0.015, 600, 16),
  ('condominio', 'Externo', 'Área de lixo', 'unidade', 20, 1, 17),
  ('supermercado', 'Vendas', 'Corredores e piso', 'sqft', 0.012, 6000, 1),
  ('supermercado', 'Vendas', 'Gôndolas (limpeza externa)', 'unidade', 6, 30, 2),
  ('supermercado', 'Vendas', 'Expositores refrigerados', 'unidade', 12, 10, 3),
  ('supermercado', 'Frente de loja', 'Caixas', 'unidade', 8, 8, 4),
  ('supermercado', 'Frente de loja', 'Vitrines e vidros', 'sqft', 0.04, 300, 5),
  ('supermercado', 'Açougue', 'Bancadas e equipamentos', 'unidade', 50, 1, 6),
  ('supermercado', 'Açougue', 'Piso com desengordurante', 'sqft', 0.04, 400, 7),
  ('supermercado', 'Padaria', 'Fornos e bancadas', 'unidade', 45, 1, 8),
  ('supermercado', 'Padaria', 'Vitrine e expositores', 'unidade', 15, 2, 9),
  ('supermercado', 'Câmaras frias', 'Piso e prateleiras', 'unidade', 40, 2, 10),
  ('supermercado', 'Banheiros', 'Banheiro completo', 'unidade', 25, 4, 11),
  ('supermercado', 'Depósito', 'Piso e organização', 'sqft', 0.01, 1500, 12),
  ('supermercado', 'Externo', 'Estacionamento (varrição)', 'sqft', 0.006, 8000, 13),
  ('supermercado', 'Externo', 'Carrinhos', 'unidade', 2, 40, 14),
  ('academia', 'Equipamentos', 'Aparelho de musculação', 'unidade', 3, 30, 1),
  ('academia', 'Equipamentos', 'Esteira / bike', 'unidade', 5, 15, 2),
  ('academia', 'Equipamentos', 'Halteres e anilhas', 'conjunto', 15, 2, 3),
  ('academia', 'Equipamentos', 'Colchonetes', 'unidade', 2, 20, 4),
  ('academia', 'Vestiários', 'Chuveiros', 'unidade', 10, 8, 5),
  ('academia', 'Vestiários', 'Armários (externo)', 'unidade', 2, 40, 6),
  ('academia', 'Vestiários', 'Vasos e pias', 'unidade', 8, 6, 7),
  ('academia', 'Vestiários', 'Piso e azulejos', 'sqft', 0.05, 400, 8),
  ('academia', 'Salas', 'Espelhos', 'sqft', 0.04, 300, 9),
  ('academia', 'Salas', 'Piso de sala de aula', 'sqft', 0.02, 800, 10),
  ('academia', 'Salas', 'Tatame', 'sqft', 0.03, 400, 11),
  ('academia', 'Recepção', 'Balcão e espera', 'unidade', 20, 1, 12),
  ('academia', 'Geral', 'Bebedouros', 'unidade', 5, 3, 13),
  ('academia', 'Geral', 'Retirada de lixo', 'unidade', 12, 1, 14),
  ('clinica', 'Atendimento', 'Sala de consulta', 'unidade', 25, 6, 1),
  ('clinica', 'Atendimento', 'Maca e mobiliário', 'unidade', 8, 6, 2),
  ('clinica', 'Atendimento', 'Piso hospitalar', 'sqft', 0.03, 800, 3),
  ('clinica', 'Esterilização', 'Bancadas e equipamentos', 'unidade', 35, 1, 4),
  ('clinica', 'Recepção', 'Balcão e espera', 'unidade', 25, 1, 5),
  ('clinica', 'Recepção', 'Cadeiras de espera', 'unidade', 2, 20, 6),
  ('clinica', 'Banheiros', 'Banheiro completo', 'unidade', 25, 3, 7),
  ('clinica', 'Banheiros', 'Banheiro acessível', 'unidade', 30, 1, 8),
  ('clinica', 'Circulação', 'Corredores', 'sqft', 0.02, 400, 9),
  ('clinica', 'Geral', 'Descarte de resíduos', 'unidade', 20, 1, 10),
  ('clinica', 'Geral', 'Vidros e portas', 'sqft', 0.04, 200, 11),
  ('escola', 'Salas de aula', 'Sala completa', 'unidade', 30, 12, 1),
  ('escola', 'Salas de aula', 'Carteiras e cadeiras', 'unidade', 1.5, 300, 2),
  ('escola', 'Salas de aula', 'Quadro e murais', 'unidade', 5, 12, 3),
  ('escola', 'Refeitório', 'Mesas e bancos', 'unidade', 4, 20, 4),
  ('escola', 'Refeitório', 'Cozinha', 'unidade', 60, 1, 5),
  ('escola', 'Refeitório', 'Piso', 'sqft', 0.025, 1000, 6),
  ('escola', 'Banheiros', 'Banheiro infantil', 'unidade', 30, 4, 7),
  ('escola', 'Banheiros', 'Banheiro de funcionários', 'unidade', 20, 2, 8),
  ('escola', 'Circulação', 'Corredores', 'sqft', 0.015, 1500, 9),
  ('escola', 'Circulação', 'Escadas', 'unidade', 12, 4, 10),
  ('escola', 'Externo', 'Pátio', 'sqft', 0.01, 3000, 11),
  ('escola', 'Externo', 'Playground', 'unidade', 30, 1, 12),
  ('escola', 'Geral', 'Secretaria e diretoria', 'unidade', 25, 2, 13),
  ('loja', 'Vendas', 'Piso da loja', 'sqft', 0.02, 1200, 1),
  ('loja', 'Vendas', 'Araras e expositores', 'unidade', 4, 20, 2),
  ('loja', 'Vendas', 'Prateleiras', 'metro', 5, 20, 3),
  ('loja', 'Vitrine', 'Vidros externos', 'sqft', 0.05, 200, 4),
  ('loja', 'Vitrine', 'Manequins e display', 'unidade', 5, 6, 5),
  ('loja', 'Provadores', 'Cabine completa', 'unidade', 8, 6, 6),
  ('loja', 'Provadores', 'Espelhos', 'unidade', 4, 6, 7),
  ('loja', 'Caixa', 'Balcão', 'metro', 6, 3, 8),
  ('loja', 'Estoque', 'Piso e prateleiras', 'sqft', 0.012, 500, 9),
  ('loja', 'Banheiros', 'Banheiro completo', 'unidade', 20, 2, 10),
  ('galeria', 'Exposição', 'Salas de exposição', 'sqft', 0.025, 1500, 1),
  ('galeria', 'Exposição', 'Vitrines de vidro', 'unidade', 10, 10, 2),
  ('galeria', 'Exposição', 'Pedestais e bases', 'unidade', 4, 15, 3),
  ('galeria', 'Exposição', 'Iluminação (spots)', 'unidade', 3, 20, 4),
  ('galeria', 'Recepção', 'Balcão e entrada', 'unidade', 20, 1, 5),
  ('galeria', 'Circulação', 'Corredores e escadas', 'sqft', 0.02, 500, 6),
  ('galeria', 'Vidros', 'Portas e janelas', 'sqft', 0.05, 300, 7),
  ('galeria', 'Banheiros', 'Banheiro completo', 'unidade', 20, 2, 8),
  ('galeria', 'Geral', 'Piso especial (madeira/epóxi)', 'sqft', 0.03, 800, 9),
  ('igreja', 'Templo', 'Nave / auditório', 'sqft', 0.02, 3000, 1),
  ('igreja', 'Templo', 'Bancos ou cadeiras', 'unidade', 1.5, 200, 2),
  ('igreja', 'Templo', 'Altar e púlpito', 'unidade', 20, 1, 3),
  ('igreja', 'Salas', 'Sala de aula / EBD', 'unidade', 20, 6, 4),
  ('igreja', 'Cozinha', 'Cozinha e copa', 'unidade', 40, 1, 5),
  ('igreja', 'Banheiros', 'Banheiro completo', 'unidade', 22, 4, 6),
  ('igreja', 'Circulação', 'Hall e corredores', 'sqft', 0.015, 800, 7),
  ('igreja', 'Externo', 'Calçada e entrada', 'sqft', 0.012, 500, 8),
  ('igreja', 'Externo', 'Estacionamento (varrição)', 'sqft', 0.006, 3000, 9),
  ('fabrica', 'Produção', 'Chão de fábrica (varrição)', 'sqft', 0.008, 10000, 1),
  ('fabrica', 'Produção', 'Lavagem de piso industrial', 'sqft', 0.02, 10000, 2),
  ('fabrica', 'Produção', 'Limpeza externa de máquinas', 'unidade', 15, 10, 3),
  ('fabrica', 'Vestiários', 'Chuveiros e armários', 'unidade', 10, 10, 4),
  ('fabrica', 'Vestiários', 'Vasos e pias', 'unidade', 8, 8, 5),
  ('fabrica', 'Refeitório', 'Mesas e bancos', 'unidade', 4, 20, 6),
  ('fabrica', 'Refeitório', 'Cozinha industrial', 'unidade', 60, 1, 7),
  ('fabrica', 'Administrativo', 'Escritórios', 'sqft', 0.02, 1500, 8),
  ('fabrica', 'Administrativo', 'Sala de reunião', 'unidade', 20, 2, 9),
  ('fabrica', 'Geral', 'Doca e recebimento', 'sqft', 0.01, 2000, 10),
  ('fabrica', 'Geral', 'Descarte de resíduos', 'unidade', 25, 1, 11)
      ) as x(segment, area, item, unit, minutos, qtd, ord)
     where not exists (
       select 1 from public.commercial_areas ca
        where ca.company_id = v_company
          and ca.segment = x.segment
          and ca.item = x.item
     );
  end loop;
end $$;

-- Conferencia
select segment, count(*) as itens, count(distinct name) as areas
  from public.commercial_areas
 where item is not null
 group by segment order by segment;
