'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClientCoordsAction } from '@/lib/actions';

interface Pending {
  id: string;
  full_name: string;
  address: string;
}

/**
 * Busca as coordenadas dos clientes que ainda nao tem lat/lng,
 * usando a Places API (mesma chave do autocomplete).
 */
export default function GeocodeBatch({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (pending.length === 0) return null;

  async function run() {
    if (!apiKey) return;
    setRunning(true);
    setDone(0);
    setFailed([]);
    const misses: string[] = [];

    for (const c of pending) {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.formattedAddress,places.location',
          },
          body: JSON.stringify({ textQuery: c.address, regionCode: 'US', maxResultCount: 1 }),
        });
        const data = await res.json();
        const place = data.places?.[0];
        if (place?.location?.latitude) {
          await saveClientCoordsAction(
            c.id,
            place.location.latitude,
            place.location.longitude,
            place.formattedAddress
          );
          setDone((n) => n + 1);
        } else {
          misses.push(c.full_name);
        }
      } catch {
        misses.push(c.full_name);
      }
      await new Promise((r) => setTimeout(r, 250)); // respeita limites da API
    }

    setFailed(misses);
    setFinished(true);
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="card mb-6 border-sun">
      <p className="mb-2 font-semibold text-brand-900">
        📍 {pending.length} cliente{pending.length === 1 ? '' : 's'} sem coordenadas
      </p>
      <p className="mb-3 text-brand-800">
        Sem coordenadas, esses clientes não entram nas sugestões de rota nem aparecem no mapa.
        Buscar automaticamente pelo endereço cadastrado resolve todos de uma vez.
      </p>
      <button className="btn-primary" type="button" onClick={run} disabled={running}>
        {running ? `Buscando… ${done}/${pending.length}` : '🔍 Buscar coordenadas de todos'}
      </button>
      {finished && (
        <div className="mt-3">
          <p className="font-medium text-brand-700">{done} cliente(s) atualizados.</p>
          {failed.length > 0 && (
            <p className="mt-1 text-brand-800">
              Não encontrados (revise o endereço manualmente): {failed.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
