'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyBookingStatusAction } from '@/lib/actions';

interface Target {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
}

function distMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Enquanto a Minha agenda esta aberta, detecta a aproximacao (<150m)
 * de uma casa com limpeza pendente e sugere o check-in com um toque.
 */
export default function ArrivalWatcher({ targets }: { targets: Target[] }) {
  const router = useRouter();
  const [nearby, setNearby] = useState<Target | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!('geolocation' in navigator) || targets.length === 0) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const me = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(me);
        const hit = targets.find(
          (t) =>
            !dismissed.current.has(t.id) &&
            (t.status === 'agendado' || t.status === 'a_caminho') &&
            distMeters(me.lat, me.lng, t.lat, t.lng) < 150
        );
        setNearby(hit ?? null);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [targets]);

  if (!nearby) return null;

  async function confirm() {
    setBusy(true);
    try {
      await updateMyBookingStatusAction(nearby!.id, 'em_andamento', pos?.lat ?? null, pos?.lng ?? null);
      dismissed.current.add(nearby!.id);
      setNearby(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-2xl rounded-card border-2 border-aqua-500 bg-white p-4 shadow-xl">
        <p className="mb-3 font-semibold text-brand-900">
          📍 Você chegou na casa de {nearby.name}?
        </p>
        <div className="flex gap-2">
          <button className="btn-primary grow" type="button" onClick={confirm} disabled={busy}>
            {busy ? 'Registrando…' : '▶️ Confirmar check-in'}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              dismissed.current.add(nearby.id);
              setNearby(null);
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
