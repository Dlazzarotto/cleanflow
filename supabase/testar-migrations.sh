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
create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

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
else
  echo "── Parou no primeiro erro. Corrija e rode de novo."
  exit 1
fi
