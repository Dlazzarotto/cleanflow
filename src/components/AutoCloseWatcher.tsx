'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { autoCloseBookingAction } from '@/lib/actions/incidents';
import { distanceMeters } from '@/lib/geo';

interface Active {
  id: string;
  clientId: string | null;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Servico em andamento: se a equipe se afastar mais de 100 m da casa,
 * encerra sozinho e avisa a gestao (abre o tempo de trajeto seguinte).
 * Duas leituras seguidas fora do raio para evitar erro de GPS.
 */
export default function AutoCloseWatcher({ active }: { active: Active[] }) {
  const router = useRouter();
  const strikes = useRef<Record<string, number>>({});
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (active.length === 0 || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (p) => {
        for (const b of active) {
          const dist = distanceMeters(p.coords.latitude, p.coords.longitude, b.lat, b.lng);
          if (dist > 100) {
            strikes.current[b.id] = (strikes.current[b.id] ?? 0) + 1;
            if (strikes.current[b.id] >= 2) {
              strikes.current[b.id] = -99; // evita repetir
              const res = await autoCloseBookingAction({
                booking_id: b.id,
                client_id: b.clientId,
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                distance_m: dist,
              });
              if (res.ok) {
                setAviso(
                  `A limpeza de ${b.name} foi encerrada automaticamente porque você saiu do local. ` +
                    `Se ainda não terminou, avise o escritório.`
                );
                router.refresh();
              }
            }
          } else {
            strikes.current[b.id] = 0;
          }
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, router]);

  if (!aviso) return null;

  return (
    <div className="mb-4 rounded-card border-2 border-sun bg-white p-4">
      <p className="font-semibold text-brand-900">⏱️ {aviso}</p>
      <button className="btn-ghost mt-2" type="button" onClick={() => setAviso('')}>
        Entendi
      </button>
    </div>
  );
}
