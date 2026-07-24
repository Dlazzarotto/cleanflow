'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    L: any;
  }
}

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

const STATUS_ICON: Record<string, string> = {
  agendado: '🏠',
  a_caminho: '🚗',
  em_andamento: '🧹',
  concluido: '✅',
};

export default function LiveMap() {
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function loadLeaflet(): Promise<void> {
      return new Promise((resolve) => {
        if (window.L) return resolve();
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
        const script = document.createElement('script');
        script.src = LEAFLET_JS;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    async function refresh() {
      try {
        const res = await fetch('/api/mapa');
        const data = await res.json();
        if (cancelled || !mapRef.current) return;
        const L = window.L;

        layerRef.current.clearLayers();
        const bounds: [number, number][] = [];

        for (const h of data.houses ?? []) {
          bounds.push([h.lat, h.lng]);
          const icon = L.divIcon({
            html: `<div style="font-size:22px;line-height:22px;">${STATUS_ICON[h.status] ?? '🏠'}</div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker([h.lat, h.lng], { icon })
            .bindPopup(
              `<strong>${h.client}</strong>${h.unit ? ` · ${h.unit}` : ''}<br/>` +
              `${new Date(h.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` +
              `${h.team_name ? ` · ${h.team_name}` : ''}<br/>${h.address ?? ''}`
            )
            .addTo(layerRef.current);
        }

        for (const p of data.people ?? []) {
          bounds.push([p.lat, p.lng]);
          L.circleMarker([p.lat, p.lng], {
            radius: 10,
            color: '#ffffff',
            weight: 2,
            fillColor: p.team_color,
            fillOpacity: 0.95,
          })
            .bindPopup(
              `<strong>${p.name}</strong>${p.team_name ? ` · ${p.team_name}` : ''}<br/>` +
              `há ${p.minutes_ago} min`
            )
            .addTo(layerRef.current);
        }

        if (bounds.length > 0 && !mapRef.current._fitted) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
          mapRef.current._fitted = true;
        }
      } catch {
        // proxima atualizacao tenta de novo
      }
    }

    (async () => {
      await loadLeaflet();
      if (cancelled || !containerRef.current) return;
      const L = window.L;
      mapRef.current = L.map(containerRef.current).setView([42.42, -71.06], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
      refresh();
      interval = setInterval(refresh, 60000);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} className="h-[70vh] w-full rounded-card border border-brand-100" />
      <p className="mt-2 text-sm text-brand-800">
        🧹 casas de hoje (ícone conforme o status) · círculos coloridos = pessoas da equipe (cor da equipe),
        posição dos últimos 15 minutos, atualizada a cada 60s enquanto elas estão com a Minha agenda aberta.
      </p>
    </div>
  );
}
