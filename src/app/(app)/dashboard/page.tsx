import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { etTodayRange, etMonthStart } from '@/lib/tz';
import { STATUS_LABEL } from '@/lib/types';
import Link from 'next/link';
import HealthPanel from '@/components/HealthPanel';
import DashboardWidgets, { type Widget } from '@/components/DashboardWidgets';
import DayAgenda, { type AgendaItem } from '@/components/DayAgenda';
import { SERVICE_TYPE_LABEL } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const TZ = 'America/New_York';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dia(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
  });
}

export default async function DashboardPage() {
  await requireManager();
  const supabase = createClient();
  const { start: startOfDay, end: endOfDay } = etTodayRange();
  const startOfMonth = etMonthStart();

  const [todayRes, monthRes, clientsRes, shiftsRes, invoicesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, clients(full_name, address), teams(name, color)')
      .gte('scheduled_at', startOfDay)
      .lt('scheduled_at', endOfDay)
      .order('scheduled_at'),
    supabase
      .from('bookings')
      .select('price, status, scheduled_at')
      .gte('scheduled_at', startOfMonth),
    supabase.from('clients').select('id').eq('status', 'ativo'),
    supabase
      .from('work_shifts')
      .select('person_name, started_at, ended_at')
      .gte('started_at', startOfDay)
      .order('started_at'),
    supabase
      .from('invoices')
      .select('id, number, amount, status, due_at, paid_at, paid_method, clients(full_name)')
      .order('number', { ascending: false })
      .limit(200),
  ]);

  const hojeBookings = (todayRes.data ?? []) as any[];
  const mesBookings = (monthRes.data ?? []) as any[];
  const clientesAtivos = clientsRes.data ?? [];
  const shifts = (shiftsRes.data ?? []) as any[];
  const invoices = (invoicesRes.data ?? []) as any[];

  const receitaMes = mesBookings
    .filter((b) => b.status === 'concluido')
    .reduce((s, b) => s + Number(b.price), 0);

  const abertas = invoices.filter((i) => i.status === 'aberta' || i.status === 'vencida');
  const aReceber = abertas.reduce((s, i) => s + Number(i.amount), 0);
  const vencidas = invoices.filter((i) => i.status === 'vencida');

  const pagasMes = invoices.filter(
    (i) => i.status === 'paga' && i.paid_at && i.paid_at >= startOfMonth
  );
  const recebidoMes = pagasMes.reduce((s, i) => s + Number(i.amount), 0);

  const concluidasHoje = hojeBookings.filter((b) => b.status === 'concluido').length;
  const previstoHoje = hojeBookings
    .filter((b) => b.status !== 'cancelado')
    .reduce((s, b) => s + Number(b.price), 0);

  const widgets: Widget[] = [
    {
      chave: 'hoje',
      rotulo: 'Limpezas hoje',
      valor: String(hojeBookings.length),
      nota: `${concluidasHoje} concluída(s) · ${usd(previstoHoje)} previsto`,
      cor: 'destaque',
      vazio: 'Nenhuma limpeza agendada para hoje.',
      verTudo: { href: '/agendamentos', texto: 'Ver agendamentos' },
      itens: hojeBookings.map((b) => ({
        id: b.id,
        titulo: b.clients?.full_name ?? 'Cliente',
        detalhe: `${hora(b.scheduled_at)} · ${b.teams?.name ?? 'sem equipe'}`,
        valor: STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status,
        destaque: (b.status === 'concluido'
          ? 'ok'
          : b.status === 'sem_acesso'
            ? 'alerta'
            : 'neutro') as 'ok' | 'alerta' | 'neutro',
        href: `/calendario?abrir=${b.id}`,
      })),
    },
    {
      chave: 'receber',
      rotulo: 'A receber',
      valor: usd(aReceber),
      nota: `${abertas.length} fatura(s) em aberto`,
      cor: aReceber > 0 ? 'alerta' : 'ok',
      vazio: 'Nenhuma fatura em aberto. Tudo recebido!',
      verTudo: { href: '/faturas', texto: 'Ver faturas' },
      itens: abertas.slice(0, 40).map((i) => ({
        id: i.id,
        titulo: `#${i.number} · ${i.clients?.full_name ?? 'Cliente'}`,
        detalhe:
          i.status === 'vencida'
            ? `vencida em ${i.due_at ? dia(i.due_at + 'T12:00:00') : '—'}`
            : `vence em ${i.due_at ? dia(i.due_at + 'T12:00:00') : '—'}`,
        valor: usd(i.amount),
        destaque: (i.status === 'vencida' ? 'alerta' : 'neutro') as 'alerta' | 'neutro',
        href: '/faturas',
      })),
    },
    {
      chave: 'recebido',
      rotulo: 'Recebido no mês',
      valor: usd(recebidoMes),
      nota: `${pagasMes.length} fatura(s) paga(s)`,
      cor: 'ok',
      vazio: 'Nenhum pagamento registrado neste mês.',
      verTudo: { href: '/faturas?status=paga', texto: 'Ver pagamentos' },
      itens: pagasMes.slice(0, 40).map((i) => ({
        id: i.id,
        titulo: `#${i.number} · ${i.clients?.full_name ?? 'Cliente'}`,
        detalhe: `pago em ${i.paid_at ? dia(i.paid_at) : '—'}`,
        valor: usd(i.amount),
        destaque: 'ok' as const,
        href: '/faturas?status=paga',
      })),
    },
    {
      chave: 'equipe',
      rotulo: 'Equipe em campo',
      valor: String(shifts.filter((s) => !s.ended_at).length),
      nota:
        shifts.length === 0
          ? 'ninguém iniciou o dia'
          : `${shifts.length} pessoa(s) hoje`,
      cor: 'neutro',
      vazio: 'Ninguém iniciou o dia ainda.',
      verTudo: { href: '/equipes', texto: 'Ver equipes' },
      itens: shifts.map((s, idx) => ({
        id: `shift-${idx}`,
        titulo: s.person_name,
        detalhe: `início ${hora(s.started_at)}${s.ended_at ? ` · fim ${hora(s.ended_at)}` : ''}`,
        valor: s.ended_at ? 'encerrou' : 'em campo',
        destaque: (s.ended_at ? 'neutro' : 'ok') as 'neutro' | 'ok',
      })),
    },
  ];

  const agenda: AgendaItem[] = hojeBookings.map((b) => {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(b.scheduled_at));
    const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);

    return {
      id: b.id,
      hora: hora(b.scheduled_at),
      minutoInicio: h * 60 + m,
      duracao: b.duration_minutes ?? 120,
      cliente: b.clients?.full_name ?? 'Cliente',
      endereco: b.clients?.address ?? null,
      equipe: b.teams?.name ?? null,
      cor: b.teams?.color ?? '#13706B',
      status: b.status,
      statusRotulo: STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status,
      valor: Number(b.price) > 0 ? usd(b.price) : null,
      tipo:
        b.service_type && b.service_type !== 'manutencao'
          ? SERVICE_TYPE_LABEL[b.service_type] ?? null
          : null,
    };
  });

  const dataLabel = new Date().toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Dashboard</h1>
        <Link href="/agendamentos/novo" className="btn-primary">+ Nova limpeza</Link>
      </div>

      <HealthPanel />

      <DashboardWidgets widgets={widgets} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DayAgenda itens={agenda} dataLabel={dataLabel} />
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">Resumo do mês</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Faturado</span>
                <span className="text-xl font-bold text-brand-900">{usd(receitaMes)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Concluídas</span>
                <span className="text-xl font-bold">
                  {mesBookings.filter((b) => b.status === 'concluido').length}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Cancelamentos</span>
                <span className="text-xl font-bold">
                  {mesBookings.filter((b) => b.status === 'cancelado').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-800">Clientes ativos</span>
                <span className="text-xl font-bold">{clientesAtivos.length}</span>
              </div>
            </div>
          </div>

          {vencidas.length > 0 && (
            <Link
              href="/faturas?status=vencida"
              className="card block border-2 border-red-700 hover:opacity-90"
            >
              <p className="font-semibold text-red-800">
                ⚠️ {vencidas.length} fatura(s) vencida(s)
              </p>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {usd(vencidas.reduce((s, i) => s + Number(i.amount), 0))}
              </p>
              <p className="mt-1 text-sm text-brand-800">Toque para cobrar</p>
            </Link>
          )}

          <div className="card">
            <p className="mb-3 font-semibold text-brand-900">Atalhos</p>
            <div className="space-y-2">
              <Link href="/clientes/novo" className="btn-ghost block text-center">
                👤 Novo cliente
              </Link>
              <Link href="/estimates/novo" className="btn-ghost block text-center">
                🧮 Novo orçamento
              </Link>
              <Link href="/mapa" className="btn-ghost block text-center">
                🗺️ Mapa das equipes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
