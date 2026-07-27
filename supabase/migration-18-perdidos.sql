-- =============================================================
-- CleanFlow AI - Migracao 18: separar ex-clientes de leads perdidos
-- inativo  = JA FOI cliente e parou (reconquista)
-- perdido  = nunca fechou (visita/estimate que nao virou cliente)
-- Executar no SQL Editor do Supabase.
-- =============================================================

alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients
  add constraint clients_status_check
  check (status in ('lead','ativo','em_espera','inativo','perdido','deletado'));

-- Reclassifica automaticamente o que ja existe:
-- quem esta inativo e NUNCA teve limpeza concluida vira "perdido".
update public.clients c
   set status = 'perdido'
 where c.status = 'inativo'
   and not exists (
     select 1 from public.bookings b
      where b.client_id = c.id
        and b.status = 'concluido'
   );
