import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABEL, type Booking, type BookingStatus } from '@/lib/types';
import { updateBookingStatusAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const NEXT_STATUS: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  agendado: { to: 'a_caminho', label: 'A caminho' },
  a_caminho: { to: 'em_andamento', label: 'Check-in' },
  em_andamento: { to: 'concluido', label: 'Check-out' },
};

export default async function AgendamentosPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, clients(full_name, address), teams(name, color)')
    .gte('scheduled_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('scheduled_at');
  const bookings = (data ?? []) as Booking[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Agendamentos</h1>
        <Link href="/agendamentos/novo" className="btn-primary">+ Nova limpeza</Link>
      </div>

      {bookings.length === 0 ? (
        <div className="card text-brand-800">Nenhuma limpeza agendada a partir de hoje.</div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const next = NEXT_STATUS[b.status];
            return (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {new Date(b.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                    — {b.clients?.full_name}
                  </p>
                  <p className="text-brand-800">{b.clients?.address}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {b.teams && (
                      <span className="rounded-full px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: b.teams.color }}>
                        {b.teams.name}
                      </span>
                    )}
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                      {STATUS_LABEL[b.status]}
                    </span>
                    <span className="text-sm text-brand-800">
                      {Number(b.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · {b.duration_minutes} min
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {next && (
                    <form action={updateBookingStatusAction.bind(null, b.id, next.to)}>
                      <button className="btn-primary" type="submit">{next.label}</button>
                    </form>
                  )}
                  {b.status !== 'concluido' && b.status !== 'cancelado' && (
                    <form action={updateBookingStatusAction.bind(null, b.id, 'cancelado')}>
                      <button className="btn-ghost" type="submit">Cancelar</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
