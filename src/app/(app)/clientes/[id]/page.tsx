import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABEL, type Booking, type Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const [{ data: client }, { data: bookings }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    supabase
      .from('bookings')
      .select('*, teams(name, color)')
      .eq('client_id', params.id)
      .order('scheduled_at', { ascending: false })
      .limit(20),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const history = (bookings ?? []) as Booking[];

  const info: Array<[string, string | null]> = [
    ['Telefone', c.phone],
    ['Email', c.email],
    ['Endereço', c.address],
    ['Código da porta', c.door_code],
    ['Alarme', c.alarm_notes],
    ['Pets', c.has_pets ? (c.pets_notes ?? 'Sim') : 'Não'],
    ['Produtos', c.products_notes],
    ['Frequência', c.frequency],
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">{c.full_name}</h1>
        <Link href={`/clientes/${c.id}/editar`} className="btn-ghost">✏️ Editar</Link>
      </div>
      <p className="mb-6 text-brand-800 capitalize">Status: {c.status}</p>

      <div className="card mb-6">
        <h2 className="mb-3 text-xl font-semibold text-brand-900">Ficha do cliente</h2>
        <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="font-medium text-brand-800">{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
        {c.preferences && (
          <div className="mt-4 rounded-card bg-brand-50 p-4">
            <p className="font-medium text-brand-800">Preferências (a equipe recebe automaticamente)</p>
            <p>{c.preferences}</p>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-xl font-semibold text-brand-900">Histórico de limpezas</h2>
      {history.length === 0 ? (
        <div className="card text-brand-800">Nenhuma limpeza registrada para este cliente.</div>
      ) : (
        <div className="space-y-3">
          {history.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {new Date(b.scheduled_at).toLocaleDateString('pt-BR')}{' '}
                  {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-brand-800">
                  {Number(b.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · {b.duration_minutes} min
                </p>
              </div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                {STATUS_LABEL[b.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
