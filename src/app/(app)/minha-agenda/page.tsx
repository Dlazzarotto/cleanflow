import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { STATUS_LABEL, type BookingStatus } from '@/lib/types';
import { updateMyBookingStatusAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

interface AgendaItem {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: BookingStatus;
  notes: string | null;
  client_name: string;
  address: string | null;
  door_code: string | null;
  has_pets: boolean;
  pets_notes: string | null;
  alarm_notes: string | null;
  preferences: string | null;
  products_notes: string | null;
  team_name: string | null;
  team_color: string | null;
}

const NEXT_STATUS: Partial<Record<BookingStatus, { to: string; label: string }>> = {
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

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400000);

  // Visao segura: apenas limpezas das equipes do usuario, sem valores
  const { data } = await supabase
    .from('team_agenda')
    .select('*')
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .order('scheduled_at');

  const items = (data ?? []) as AgendaItem[];

  const byDay = new Map<string, AgendaItem[]>();
  for (const b of items) {
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

      {items.length === 0 && (
        <div className="card text-brand-800">
          Nenhuma limpeza nos próximos 7 dias. Se você acabou de receber o acesso,
          peça ao administrador para colocar você numa equipe.
        </div>
      )}

      {Array.from(byDay.entries()).map(([day, list]) => (
        <div key={day} className="mb-6">
          <h2 className="mb-2 text-xl font-semibold capitalize text-brand-900">{day}</h2>
          <div className="space-y-3">
            {list.map((b) => {
              const next = NEXT_STATUS[b.status];
              return (
                <div key={b.id} className="card" style={b.team_color ? { borderLeft: `6px solid ${b.team_color}` } : undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xl font-bold">
                      {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                      — {b.client_name}
                    </p>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  <p className="text-sm text-brand-800">
                    Duração prevista: {Math.floor(b.duration_minutes / 60)}h{b.duration_minutes % 60 > 0 ? ` ${b.duration_minutes % 60}min` : ''}
                    {b.team_name ? ` · ${b.team_name}` : ''}
                  </p>
                  {b.address && (
                    <p className="mt-1">
                      📍{' '}
                      <a
                        className="font-medium text-brand-700 underline"
                        href={`https://maps.google.com/?q=${encodeURIComponent(b.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {b.address}
                      </a>
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-brand-800">
                    {b.door_code && <p>🔑 Código da porta: <strong>{b.door_code}</strong></p>}
                    {b.alarm_notes && <p>🚨 Alarme: {b.alarm_notes}</p>}
                    {b.has_pets && <p>🐾 Pets: {b.pets_notes ?? 'Sim'}</p>}
                    {b.preferences && <p>📝 Preferências: {b.preferences}</p>}
                    {b.products_notes && <p>🧴 Produtos: {b.products_notes}</p>}
                    {b.notes && <p>💬 Observações: {b.notes}</p>}
                  </div>
                  {next && (
                    <form action={updateMyBookingStatusAction.bind(null, b.id, next.to)} className="mt-3">
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
