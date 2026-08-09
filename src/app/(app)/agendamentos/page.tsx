import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { STATUS_LABEL, type Booking, type BookingStatus } from '@/lib/types';
import { SERVICE_TYPE_LABEL } from '@/lib/pricing';
import { updateBookingStatusAction } from '@/lib/actions';
import BackLink from '@/components/BackLink';
import { getModo, ROTULOS } from '@/lib/mode';

export const dynamic = 'force-dynamic';

const NEXT_STATUS: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  agendado: { to: 'a_caminho', label: 'A caminho' },
  a_caminho: { to: 'em_andamento', label: 'Check-in' },
  em_andamento: { to: 'concluido', label: 'Check-out' },
};

interface Item {
  booking: Booking;
  seriesCount: number; // quantas ocorrencias futuras a serie tem (1 = avulsa)
}

export default async function AgendamentosPage() {
  await requireManager();
  const modo = await getModo();
  const rot = ROTULOS[modo];
  const supabase = createClient();

  // Só os clientes deste modo (residencial ou comercial)
  const { data: idsModo } = await supabase
    .from('clients')
    .select('id')
    .eq('client_type', modo);
  const clientesDoModo = (idsModo ?? []).map((c: any) => c.id);


  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Janela operacional: proximos 14 dias
  const { data } = await supabase
    .from('bookings')
    .select('*, clients(full_name, address), teams(name, color)')
    .in('client_id', clientesDoModo)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at');
  const inWindow = (data ?? []) as Booking[];

  // Contagem futura de cada serie (para a etiqueta 🔁)
  const seriesIds = Array.from(
    new Set(inWindow.map((b) => b.series_id).filter(Boolean))
  ) as string[];

  const seriesCounts = new Map<string, number>();
  if (seriesIds.length > 0) {
    const { data: futureSeries } = await supabase
      .from('bookings')
      .select('series_id')
      .in('client_id', clientesDoModo)
      .in('series_id', seriesIds)
      .gte('scheduled_at', from)
      .neq('status', 'cancelado');
    for (const row of futureSeries ?? []) {
      const id = (row as any).series_id as string;
      seriesCounts.set(id, (seriesCounts.get(id) ?? 0) + 1);
    }
  }

  // Agrupa: de cada serie, apenas a PROXIMA ocorrencia aparece aqui
  const seenSeries = new Set<string>();
  const items: Item[] = [];
  for (const b of inWindow) {
    if (b.series_id) {
      if (seenSeries.has(b.series_id)) continue;
      seenSeries.add(b.series_id);
      items.push({ booking: b, seriesCount: seriesCounts.get(b.series_id) ?? 1 });
    } else {
      items.push({ booking: b, seriesCount: 1 });
    }
  }

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Agendamentos</h1>
        <Link href="/agendamentos/novo" className="btn-primary">+ Nova limpeza</Link>
      </div>
      <p className="mb-6 text-brand-800">
        Visão operacional dos próximos 14 dias. Séries recorrentes aparecem uma vez (a próxima limpeza);
        para ver e editar todas as datas, use o{' '}
        <Link href="/calendario" className="font-semibold text-brand-700 underline">Calendário</Link>.
      </p>

      {items.length === 0 ? (
        <div className="card text-brand-800">Nenhuma limpeza nos próximos 14 dias.</div>
      ) : (
        <div className="space-y-3">
          {items.map(({ booking: b, seriesCount }) => {
            const next = NEXT_STATUS[b.status];
            return (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {b.type === 'visita' ? '👋 ' : ''}
                    {new Date(b.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                    — {b.clients?.full_name}
                  </p>
                  <p className="text-brand-800">{b.clients?.address}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(b as any).service_type && (b as any).service_type !== 'manutencao' && (
                      <span className="rounded-full bg-sun/20 px-3 py-1 text-sm font-medium text-brand-900">
                        ✨ {SERVICE_TYPE_LABEL[(b as any).service_type]}
                      </span>
                    )}
                    {b.series_id && (
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
                        🔁 recorrente · {seriesCount} limpeza{seriesCount === 1 ? '' : 's'} à frente
                      </span>
                    )}
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
                <div className="flex flex-wrap gap-2">
                  {b.type === 'visita' && (
                    <Link href={`/estimates/novo?cliente=${b.client_id}`} className="btn-ghost">
                      🧮 Criar estimate
                    </Link>
                  )}
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
