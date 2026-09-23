-- =============================================================
-- CleanFlow AI - Migracao 57: check-out fechado pelo escritorio
--
-- PROBLEMA
--   Limpeza que a equipe esqueceu de fechar fica 'em_andamento'
--   para sempre. A fatura nao nasce (regra da migration-44: fatura
--   so vem no check-out), e o painel do dashboard so avisa — nao
--   deixa resolver. Tem limpeza de agosto aberta ate hoje.
--
-- SOLUCAO
--   A gestora fecha pelo dashboard, num clique. Mas isso NAO e um
--   check-out de verdade: ninguem estava na casa marcando a hora.
--   Entao o registro precisa dizer que foi o escritorio, senao o
--   relatorio passa a medir um tempo que nunca foi cronometrado.
--
--   checkout_at nesse caso recebe o FIM PREVISTO da limpeza
--   (scheduled_at + duration_minutes), nao o now() — carimbar agora
--   faria uma limpeza de 14/08 aparecer com 40 dias de duracao.
--
-- Aditiva e idempotente: nao depende das migrations 47/52-56 e pode
-- rodar antes ou depois delas, em qualquer ordem.
--
-- Executar no SQL Editor do Supabase.
-- =============================================================

-- Quem fechou e quando. NULL nas duas = check-out normal, feito em campo.
alter table public.bookings
  add column if not exists checkout_by_office boolean not null default false;

alter table public.bookings
  add column if not exists checkout_closed_by uuid references auth.users(id);

comment on column public.bookings.checkout_by_office is
  'true = o escritorio fechou a limpeza porque a equipe esqueceu o check-out. '
  'checkout_at e o fim previsto, nao a hora real de saida — o relatorio nao '
  'deve usar esta linha para medir duracao nem trajeto.';

comment on column public.bookings.checkout_closed_by is
  'Usuario do escritorio que fechou. NULL quando o check-out foi feito em campo.';
