#!/usr/bin/env bash
# =============================================================
# Testa as migrations do CleanFlow num Postgres de verdade.
#
#   bash supabase/testar-migrations.sh
#
# Cria um banco descartavel, simula o que o Supabase fornece
# (schema auth, auth.uid(), uuid_generate_v4) e aplica schema.sql +
# todas as migrations na ordem numerica. Para no primeiro erro e
# mostra qual arquivo quebrou.
#
# Existe porque a migration-55 foi entregue referenciando uma tabela
# inexistente e o erro so apareceu no SQL Editor do Supabase, com a
# migration ja pela metade. O build do Next valida TypeScript, nao SQL.
#
# O que ESTE teste pega: nome de tabela/coluna errado, sintaxe, ordem
# de dependencia, funcao que nao existe, trigger em tabela que nao
# existe. O que ele NAO pega: comportamento de RLS com usuario real,
# porque aqui nao ha sessao autenticada — auth.uid() devolve null.
# =============================================================
set -euo pipefail

PGDATA=${PGDATA:-/var/lib/postgresql/cf-test}
export PGHOST=${PGHOST:-/tmp}
export PGPORT=${PGPORT:-5433}
export PGUSER=${PGUSER:-postgres}
DB=cleanflow_teste
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql -q -c "drop database if exists $DB;" postgres
psql -q -c "create database $DB;" postgres

# ---- O que o Supabase da pronto e as migrations assumem ----
psql -q -d "$DB" <<'SQL'
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Supabase: schema auth com a tabela de usuarios e auth.uid()
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default uuid_generate_v4(),
  email text,
  last_sign_in_at timestamptz
);
-- No Supabase auth.uid() vem do JWT da requisicao. Aqui le a mesma
-- configuracao de sessao que o PostgREST preenche, para dar para
-- "virar" um usuario no teste com: set request.jwt.claim.sub = '<uuid>'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Supabase Storage: buckets e objects
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default uuid_generate_v4(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  metadata jsonb
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- Papeis que o Supabase cria
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;

-- O Supabase concede isto por padrao. Sem os grants, qualquer teste com
-- "set role authenticated" morre em "permission denied for table X" antes
-- de a RLS sequer ser avaliada — o teste passava a mentir que estava tudo
-- bem porque nunca chegava a exercitar a politica.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
grant select on auth.users   to authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
SQL

echo "── Ambiente Supabase simulado. Aplicando SQL na ordem:"
echo

falhou=0
# schema.sql primeiro; depois as migrations por numero
# Buracos no repo: as migrations 1, 33, 34, 40, 41 e 42 nao existem aqui.
# teste-remendos.sql recria so o que as seguintes precisam, e entra na
# ordem no lugar delas (33). Ver o cabecalho daquele arquivo.
ordem=$( { [ -f "$DIR/schema.sql" ] && echo "0 $DIR/schema.sql"; \
           [ -f "$DIR/teste-remendos.sql" ] && echo "33 $DIR/teste-remendos.sql"; \
           for m in "$DIR"/migration-*.sql; do \
             n=$(basename "$m" | sed 's/migration-\([0-9]*\)-.*/\1/'); echo "$n $m"; \
           done; } | sort -n -k1 | cut -d' ' -f2- )

for f in $ordem; do
  nome=$(basename "$f")
  if saida=$(psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" 2>&1); then
    printf '  ✓ %s\n' "$nome"
  else
    printf '  ✗ %s\n' "$nome"
    echo "$saida" | grep -E 'ERROR|LINE|DETAIL|HINT' | head -6 | sed 's/^/      /'
    falhou=1
    break
  fi
done

echo
if [ "$falhou" -eq 0 ]; then
  echo "── Todas as migrations aplicaram. Conferindo o estado final:"
  psql -q -d "$DB" <<'SQL'
\echo
\echo 'Funcoes que o CLAUDE.md manda conferir:'
select coalesce(string_agg(proname, ', ' order by proname), '(nenhuma)') as encontradas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in
  ('current_company_id','is_manager','is_admin','is_field','can_see_values','sees_team',
   'my_permissions','guard_last_admin','has_commercial','has_reports','current_mode',
   'company_max_clients','company_max_users','company_max_teams','company_monthly_fee');

\echo
\echo 'Planos aceitos pelo constraint:'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'companies_plan_check';

\echo
\echo 'Papeis aceitos pelo constraint:'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'memberships_role_check';

\echo
\echo 'Mensalidade por plano x equipes extras (teto: Base 100, Pro 150, Plus sem teto):'
SQL

  psql -q -d "$DB" <<'SQL'
-- Tabelas criadas pelas migrations nao pegam o default privilege acima
-- (ele so vale para o que for criado depois). Alcanca o que ja existe.
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
SQL

  psql -q -d "$DB" <<'SQL'
insert into public.companies (name, slug, plan, extra_teams)
select 'Teste ' || p || ' ' || e, 'teste-' || p || '-' || e, p, e
  from (values ('base'),('pro'),('plus')) t(p)
 cross join (values (0),(2),(5),(10)) u(e);

select c.plan,
       c.extra_teams as extras,
       public.company_monthly_fee(c.id) as mensalidade,
       public.company_max_teams(c.id)   as equipes,
       public.company_max_clients(c.id) as lim_clientes,
       public.company_max_users(c.id)   as lim_acessos
  from public.companies c
 where c.slug like 'teste-%'
 order by c.plan, c.extra_teams;
SQL

  # ---- RLS: o que a gestora pode e a equipe nao pode ----
  # Esta parte existe porque tudo neste projeto se apoia na RLS ("as travas
  # rodam no banco, nao na tela"). Sem ela o teste so conferia sintaxe.
  echo
  echo "── RLS com usuario de verdade:"
  psql -q -d "$DB" <<'SQL'
set client_min_messages = warning;

insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001','gestora@teste.com'),
 ('10000000-0000-0000-0000-000000000002','equipe@teste.com');

insert into public.companies (id, name, slug, plan)
 values ('20000000-0000-0000-0000-000000000001','RLS Teste','rls-teste','pro');

insert into public.memberships (user_id, company_id, role, full_name, active) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','admin','Gestora',true),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','helper','Equipe',true);

insert into public.user_settings (user_id, active_company_id) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001')
on conflict (user_id) do update set active_company_id = excluded.active_company_id;

alter table public.clients disable trigger clients_guard_price;
insert into public.clients (id, company_id, full_name, default_price, client_type)
 values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Cliente RLS',265,'residencial');
alter table public.clients enable trigger clients_guard_price;

insert into public.bookings (id, company_id, client_id, scheduled_at, duration_minutes, price, status, checkin_at)
 values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
         '30000000-0000-0000-0000-000000000001', now() - interval '30 days', 120, 265,
         'em_andamento', now() - interval '30 days');
SQL

  psql -q -d "$DB" <<'SQL'
with gestora as (
  select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false)
)
select 'gestora' as quem,
       public.is_manager()     as gerencia,
       public.can_see_values() as ve_valores
  from gestora;
SQL

  psql -q -d "$DB" <<'SQL'
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set role authenticated;
select 'equipe' as quem,
       public.is_manager()     as gerencia,
       public.is_field()       as e_de_campo,
       public.can_see_values() as ve_valores;
SQL

  echo "  (esperado: gestora gerencia=t ve_valores=t · equipe gerencia=f e_de_campo=t ve_valores=f)"

  echo
  echo "  A equipe consegue fechar uma limpeza? (tem que vir 0 linhas)"
  psql -q -d "$DB" <<'SQL'
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set role authenticated;
update public.bookings set status = 'concluido'
 where id = '40000000-0000-0000-0000-000000000001'
 returning id;
SQL

  echo
  echo "  A equipe ve o preco do cliente? (default_price tem que vir vazio ou 0 linhas)"
  psql -q -d "$DB" <<'SQL'
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set role authenticated;
select full_name, default_price from public.clients_safe
 where id = '30000000-0000-0000-0000-000000000001';
SQL

  echo
  echo "  A gestora consegue fechar? (tem que vir 1 linha, com a fatura em seguida)"
  psql -q -d "$DB" <<'SQL'
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set role authenticated;
update public.bookings
   set status = 'concluido',
       checkout_at = scheduled_at + (duration_minutes || ' minutes')::interval,
       checkout_by_office = true,
       checkout_closed_by = '10000000-0000-0000-0000-000000000001'
 where id = '40000000-0000-0000-0000-000000000001'
 returning id, checkout_by_office;

select number, amount, due_at from public.invoices
 where booking_id = '40000000-0000-0000-0000-000000000001';
SQL

else
  echo "── Parou no primeiro erro. Corrija e rode de novo."
  exit 1
fi
