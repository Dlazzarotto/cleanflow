import { createClient } from '@/lib/supabase/server';
import { etTodayRange, etMonthStart } from '@/lib/tz';
import { STATUS_LABEL, type Booking } from '@/lib/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const { start: startOfDay, end: endOfDay } = etTodayRange();
  const startOfMonth = etMonthStart();

  const [todayRes, monthRes, clientsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, clients(full_name, address), teams(name, color)')
      .gte('scheduled_at', startOfDay)
      .lt('scheduled_at', endOfDay)
      .order('scheduled_at'),
    supabase
      .from('bookings')
      .select('price, status')
      .gte('scheduled_at', startOfMonth),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
  ]);

  const todayBookings = (todayRes.data ?? []) as Booking[];
  const monthBookings = monthRes.data ?? [];
  const revenue = monthBookings
    .filter((b) => b.status === 'concluido')
    .reduce((sum, b) => sum + Number(b.price), 0);
  const cancelled = monthBookings.filter((b) => b.status === 'cancelado').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Dashboard</h1>
        <Link href="/agendamentos/novo" className="btn-primary">+ Nova limpeza</Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Limpezas hoje</p>
          <p className="text-3xl font-bold">{todayBookings.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Receita do mês</p>
          <p className="text-3xl font-bold">
            {revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
        </div>
        <div className="card">
          <p className="text-brand-800">Clientes ativos</p>
          <p className="text-3xl font-bold">{clientsRes.count ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Cancelamentos no mês</p>
          <p className="text-3xl font-bold">{cancelled}</p>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-semibold text-brand-900">Agenda de hoje</h2>
      {todayBookings.length === 0 ? (
        <div className="card text-brand-800">
          Nenhuma limpeza agendada para hoje.{' '}
          <Link href="/agendamentos/novo" className="font-semibold text-brand-700 underline">
            Agendar a primeira
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {todayBookings.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  — {b.clients?.full_name}
                </p>
                <p className="text-brand-800">{b.clients?.address}</p>
              </div>
              <div className="flex items-center gap-3">
                {b.teams && (
                  <span
                    className="rounded-full px-3 py-1 text-sm font-medium text-white"
                    style={{ backgroundColor: b.teams.color }}
                  >
                    {b.teams.name}
                  </span>
                )}
                <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
