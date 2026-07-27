-- =============================================================
-- CleanFlow AI - Migracao 15: novos status de cliente
-- ativo · em_espera · inativo · deletado
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (status in ('ativo','em_espera','inativo','deletado'));
