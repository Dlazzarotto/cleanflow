import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Client } from '@/lib/types';
import GeocodeBatch from '@/components/GeocodeBatch';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  await requireManager();
  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  const clients = (data ?? []) as Client[];
  const pending = clients
    .filter((c) => !c.lat && c.address)
    .map((c) => ({ id: c.id, full_name: c.full_name, address: c.address as string }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Clientes</h1>
        <Link href="/clientes/novo" className="btn-primary">+ Novo cliente</Link>
      </div>

      <GeocodeBatch pending={pending} />

      {clients.length === 0 ? (
        <div className="card text-brand-800">
          Nenhum cliente cadastrado ainda. Cadastre o primeiro para começar a agendar limpezas.
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
