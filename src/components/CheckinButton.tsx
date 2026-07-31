'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyBookingStatusAction } from '@/lib/actions';
import { distanceMeters, getPosition } from '@/lib/geo';

/** Raio aceito para check-in e check-out. */
const WORK_RADIUS = 100;

export default function CheckinButton({
  bookingId,
  to,
  label,
  clientLat,
  clientLng,
}: {
  bookingId: string;
  to: string;
  label: string;
  clientLat?: number | null;
  clientLng?: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const precisaEstarNaCasa = to === 'em_andamento' || to === 'concluido';

  async function run() {
    setBusy(true);
    setError('');
    const pos = await getPosition();

    if (precisaEstarNaCasa) {
      if (!pos) {
        setError('Ative o GPS e permita o acesso à localização para registrar aqui.');
        setBusy(false);
        return;
      }
      if (clientLat != null && clientLng != null) {
        const dist = distanceMeters(pos.lat, pos.lng, clientLat, clientLng);
        if (dist > WORK_RADIUS) {
          setError(
            `Você está a ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'} da casa. ` +
              `O ${to === 'concluido' ? 'check-out' : 'check-in'} só pode ser feito no local do serviço.`
          );
          setBusy(false);
          return;
        }
      }
    }

    try {
      await updateMyBookingStatusAction(bookingId, to, pos?.lat ?? null, pos?.lng ?? null);
      router.refresh();
    } catch (e) {
      setError(
        (e as Error).message.includes('m da casa')
          ? (e as Error).message
          : 'Não foi possível registrar agora. Tente de novo.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn-primary w-full" type="button" onClick={run} disabled={busy}>
        {busy ? 'Registrando…' : label}
      </button>
      {error && <p className="mt-2 rounded-card bg-red-50 p-3 text-red-800">{error}</p>}
    </div>
  );
}
