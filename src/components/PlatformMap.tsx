'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L: any;
  }
}

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

export interface CompanyPin {
  id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  plan: string;
  account_status: string;
  billing_status: string;
  clients_active: number;
  bookings_month: number;
  monthly_fee: number;
}

const COR: Record<string, string> = {
  ativa: '#2BB3A3',
  teste: '#F2A03D',
  suspensa: '#B91C1C',
  cancelada: '#9AA8A6',
};

const LABEL: Record<string, string> = {
  ativa: 'Ativa',
  teste: 'Em teste',
  suspensa: 'Suspensa',
  cancelada: 'Cancelada',
};

export default function PlatformMap({ companies }: { companies: CompanyPin[] }) {
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [semLocal, setSemLocal] = useState<string[]>([]);

  const desenhar = useCallback(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    layerRef.current.clearLayers();

    const bounds: [number, number][] = [];
    const faltando: string[] = [];

    for (const c of companies) {
      if (c.lat == null || c.lng == null) {
        faltando.push(c.name);
        continue;
      }
      bounds.push([c.lat, c.lng]);
      const cor = COR[c.account_status] ?? COR.ativa;
      const raio = 8 + Math.min(Math.sqrt(c.clients_active || 1) * 2, 14);

      L.circleMarker([c.lat, c.lng], {
        radius: raio,
        color: '#ffffff',
        weight: 2,
        fillColor: cor,
        fillOpacity: 0.9,
      })
        .bindTooltip(`${c.name}${c.city ? ` · ${c.city}` : ''}`, { direction: 'top' })
        .bindPopup(
          `<strong>${c.name}</strong><br/>` +
            `${c.city ?? ''}<br/>` +
            `${LABEL[c.account_status] ?? c.account_status} · plano ${c.plan}<br/>` +
            `${c.clients_active} clientes ativos · ${c.bookings_month} limpezas no mês<br/>` +
            `$${Number(c.monthly_fee).toFixed(0)}/mês` +
            (c.billing_status === 'atrasado' ? '<br/><strong>⚠️ pagamento atrasado</strong>' : '')
        )
        .addTo(layerRef.current);
    }

    setSemLocal(faltando);

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
    }
  }, [companies]);

  useEffect(() => {
    let cancelado = false;

    function carregarLeaflet(): Promise<void> {
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

    (async () => {
      await carregarLeaflet();
      if (cancelado || !containerRef.current || mapRef.current) return;
      const L = window.L;
      // Centro dos EUA continentais
      mapRef.current = L.map(containerRef.current).setView([39.5, -96], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · © CARTO',
        maxZoom: 20,
      }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
      desenhar();
    })();

    return () => {
      cancelado = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [desenhar]);

  useEffect(() => {
    if (mapRef.current) desenhar();
  }, [companies, desenhar]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-sm">
        {Object.entries(LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: COR[k] }}
              aria-hidden
            />
            {v}
          </span>
        ))}
        <span className="text-brand-800">· tamanho do ponto = clientes ativos</span>
      </div>

      <div ref={containerRef} className="h-[420px] w-full rounded-card border border-brand-100" />

      {semLocal.length > 0 && (
        <p className="mt-2 text-sm text-brand-800">
          Sem endereço no mapa ({semLocal.length}): {semLocal.join(', ')} — peça à empresa para
          preencher o endereço da sede em Configurações.
        </p>
      )}
    </div>
  );
}
