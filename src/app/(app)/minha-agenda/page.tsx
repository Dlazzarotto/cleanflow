import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { STATUS_LABEL, type Booking, type BookingStatus } from '@/lib/types';
import { updateBookingStatusAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const NEXT_STATUS: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  agendado: { to: 'a_caminho', label: '🚗 A caminho' },
  a_caminho: { to: 'em_andamento', label: '▶️ Check-in' },
  em_andamento: { to: 'concluido', label: '✅ Check-out' },
};

export default async function MinhaAgendaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Equipes das quais o usuario faz parte
  const { data: myTeams } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('profile_id', user.id);
  const teamIds = (myTeams ?? []).map((t) => t.team_id);

  let bookings: Booking[] = [];
  if (teamIds.length > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 86400000);
    const { data } = await supabase
      .from('bookings')
      .select('*, clients(full_name, address, door_code, has_pets, pets_notes, alarm_notes, preferences, products_notes), teams(name, color)')
      .in('team_id', teamIds)
      .gte('scheduled_at', start.toISOString())
      .lt('scheduled_at', end.toISOString())
      .neq('status', 'cancelado')
      .order('scheduled_at');
    bookings = (data ?? []) as Booking[];
  }

  const byDay = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = new Date(b.scheduled_at).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });
    const arr = byDay.get(key) ?? [];
    arr.push(b);
    byDay.set(key, arr);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Minha agenda</h1>

      {teamIds.length === 0 && (
        <div className="card text-brand-800">
          Você ainda não foi adicicionado(a) a nenhuma equipe. Fale com o administrador.
        </div>
      )}

      {teamIds.length > 0 && bookings.length === 0 && (
        <div className="card text-brand-800">Nenhuma limpeza nos próximos 7 dias. 🎉</div>
      )}

      {Array.from(byDay.entries()).map(([day, items]) => (
        <div key={day} className="mb-6">
          <h2 className="mb-2 text-xl font-semibold capitalize text-brand-900">{day}</h2>
          <div className="space-y-3">
            {items.map((b) => {
              const c = b.clients as any;
              const next = NEXT_STATUS[b.status];
              return (
                <div key={b.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xl font-bold">
                      {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                      — {c?.full_name}
                    </p>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  {c?.address && (
                    <p className="mt-1">
                      📍{' '}
                      <a
                        className="font-medium text-brand-700 underline"
                        href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.address}
                      </a>
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-brand-800">
                    {c?.door_code && <p>🔑 Código da porta: <strong>{c.door_code}</strong></p>}
                    {c?.alarm_notes && <p>🚨 Alarme: {c.alarm_notes}</p>}
                    {c?.has_pets && <p>🐾 Pets: {c.pets_notes ?? 'Sim'}</p>}
                    {c?.preferences && <p>📝 Preferências: {c.preferences}</p>}
                    {c?.products_notes && <p>🧴 Produtos: {c.products_notes}</p>}
                    {b.notes && <p>💬 Observações: {b.notes}</p>}
                  </div>
                  {next && (
                    <form action={updateBookingStatusAction.bind(null, b.id, next.to)} className="mt-3">
                      <button className="btn-primary w-full" type="submit">{next.label}</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
