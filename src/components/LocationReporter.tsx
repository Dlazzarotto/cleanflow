'use client';
import { useEffect } from 'react';

/**
 * Envia a posicao da pessoa a cada 60s enquanto a Minha agenda
 * esta aberta — alimenta o mapa em tempo real da gestao.
 */
export default function LocationReporter() {
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    let stopped = false;
    async function ping() {
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          if (stopped) return;
          try {
            await fetch('/api/localizacao', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy_m: Math.round(p.coords.accuracy ?? 0),
              }),
            });
          } catch {
            // silencioso: sem rede, tenta no proximo ciclo
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
      );
    }

    ping();
    const interval = setInterval(ping, 60000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
