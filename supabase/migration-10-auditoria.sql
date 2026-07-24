-- =============================================================
-- CleanFlow AI - Migracao 10: fechamento de auditoria
-- Principio do minimo necessario para papeis de equipe.
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- 1) Vinculos: equipe ve apenas o proprio; so gestao lista e altera
drop policy if exists "memberships_select" on public.memberships;
create policy "memberships_select" on public.memberships
  for select using (
    user_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_manager())
  );

drop policy if exists "memberships_admin_write" on public.memberships;
create policy "memberships_admin_write" on public.memberships
  for update using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());

-- 2) Dados da empresa: so gestao edita (leitura continua para todos os vinculados)
drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update using (id = public.current_company_id() and public.is_manager())
  with check (id = public.current_company_id() and public.is_manager());

-- 3) Conversas do bot (clientes/leads): so gestao
drop policy if exists "bot_conversations_all" on public.bot_conversations;
create policy "bot_conversations_manager_all" on public.bot_conversations
  for all using (company_id = public.current_company_id() and public.is_manager())
  with check (company_id = public.current_company_id() and public.is_manager());
