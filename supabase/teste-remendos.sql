-- =============================================================
-- REMENDOS PARA O TESTE — nao rodar no Supabase de producao.
--
-- O repositorio esta SEM as migrations 1, 33, 34, 40, 41 e 42. O banco
-- de producao tem todas (foram rodadas no SQL Editor), mas os arquivos
-- nunca foram commitados. Sem eles nao da para reconstruir o banco do
-- zero — nem para testar as migrations novas, que rodam depois delas.
--
-- Este arquivo recria APENAS o que as migrations seguintes precisam
-- para aplicar: colunas e objetos deduzidos do uso. NAO e a migration
-- perdida — nao tem os dados, os defaults originais nem os triggers
-- que elas possam ter criado. Serve so para o testar-migrations.sh
-- conseguir chegar ate a 52-56 e validar o que foi escrito agora.
--
-- Assim que os arquivos originais aparecerem (backup, historico do SQL
-- Editor do Supabase, outra maquina), este remendo deve ser apagado.
-- =============================================================

-- --- da migration-33 ou 34: presenca da pessoa no app ---
alter table public.memberships add column if not exists last_seen_at timestamptz;
alter table public.memberships add column if not exists invite_sent_at timestamptz;
alter table public.memberships add column if not exists invite_sent_to text;
alter table public.memberships add column if not exists invite_opened_at timestamptz;
alter table public.memberships add column if not exists first_login_at timestamptz;

-- --- da migration-40, 41 ou 42: preco por limpeza ---
-- A 43 assume que a limpeza pode ter preco proprio e uma marca dizendo
-- que ele foi definido a mao (e por isso nao e sobrescrito pelo cadastro).
alter table public.bookings add column if not exists price numeric(10,2);
alter table public.bookings add column if not exists price_manual boolean not null default false;
