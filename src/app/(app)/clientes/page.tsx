import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { CLIENT_STATUS_LABEL, type Client, type ClientStatus } from '@/lib/types';
import GeocodeBatch from '@/components/GeocodeBatch';

export const dynamic = 'force-dynamic';

const TABS: { key: ClientStatus; label: string; icon: string }[] = [
  { key: 'ativo', label: 'Ativos', icon: '🟢' },
  { key: 'em_espera', label: 'Em espera', icon: '🟡' },
  { key: 'inativo', label: 'Inativos', icon: '⚪' },
  { key: 'deletado', label: 'Deletados', icon: '🗑️' },
];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireManager();
  const active: ClientStatus = (TABS.some((t) => t.key === searchParams.status)
    ? searchParams.status
    : 'ativo') as ClientStatus;

  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('full_name');
  const all = (data ?? []) as Client[];

  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = all.filter((c) => c.status === t.key).length;
    return acc;
  }, {});

  const clients = all.filter((c) => c.status === active);

  // Geocodificacao: todos os que ainda nao tem coordenadas (menos deletados)
  const pending = all
    .filter((c) => !c.lat && c.address && c.status !== 'deletado')
    .map((c) => ({ id: c.id, full_name: c.full_name, address: c.address as string }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Clientes</h1>
        <Link href="/clientes/novo" className="btn-primary">+ Novo cliente</Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clientes?status=${t.key}`}
            className={`flex min-h-touch items-center gap-2 rounded-card border px-4 py-2 font-medium ${
              active === t.key
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label} ({counts[t.key] ?? 0})
          </Link>
        ))}
      </div>

      <GeocodeBatch pending={pending} />

      {clients.length === 0 ? (
        <div className="card text-brand-800">
          {active === 'ativo'
            ? 'Nenhum cliente ativo ainda. Cadastre o primeiro para começar a agendar limpezas.'
            : active === 'em_espera'
              ? 'Nenhum cliente aguardando resposta. Clientes entram aqui automaticamente quando um estimate é enviado a eles.'
              : `Nenhum cliente com status "${CLIENT_STATUS_LABEL[active]}".`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="card block hover:border-aqua-500">
              <p className="text-xl font-semibold">{c.full_name}</p>
              <p className="text-brand-800">{c.address ?? 'Sem endereço'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {c.frequency && (
                  <span className="rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-900 capitalize">
                    {c.frequency}
                  </span>
                )}
                {!c.lat && (
                  <span className="rounded-full bg-sun/20 px-3 py-1 font-medium text-brand-900">
                    📍 sem coordenadas
                  </span>
                )}
                {c.has_pets && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                    🐾 Pets
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
