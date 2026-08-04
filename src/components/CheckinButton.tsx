'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyBookingStatusAction } from '@/lib/actions';
import { distanceMeters, getPosition } from '@/lib/geo';

/** Raio aceito para check-in e check-out. */
const WORK_RADIUS = 250;

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

    // Sem GPS o registro acontece mesmo assim: o trabalho não pode parar.
    // A ausência de localização fica visível para a gestão.
    if (precisaEstarNaCasa && pos && clientLat != null && clientLng != null) {
      const dist = distanceMeters(pos.lat, pos.lng, clientLat, clientLng);
      // Tolerância considera o erro que o próprio aparelho informa
      const limite = WORK_RADIUS + Math.min(pos.accuracy ?? 0, 250);
      if (dist > limite) {
        setError(
          `Você está a ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'} da casa. ` +
            `O ${to === 'concluido' ? 'check-out' : 'check-in'} só pode ser feito no local do serviço.`
        );
        setBusy(false);
        return;
      }
    }

    try {
      await updateMyBookingStatusAction(
        bookingId,
        to,
        pos?.lat ?? null,
        pos?.lng ?? null,
        pos?.accuracy ?? null
      );

      // Check-out: a fatura nasce no banco; dispara o email ao cliente
      if (to === 'concluido') {
        try {
          await fetch('/api/faturas/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id: bookingId }),
          });
        } catch {
          // sem rede: a gestao envia depois pela tela de Faturas
        }
      }

      router.refresh();
    } catch (e) {
      const bruto = (e as Error)?.message ?? '';
      // Mensagens vindas do banco são escritas para a equipe entender
      setError(bruto || 'Não foi possível registrar agora. Tente de novo.');
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
