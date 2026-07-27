'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L: any;
  }
}

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

const BASEMAPS = {
  clean: {
    label: '🧼 Clean',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap · © CARTO',
    maxZoom: 20,
  },
  ruas: {
    label: '🗺️ Ruas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  satelite: {
    label: '🛰️ Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendada',
  a_caminho: 'Equipe a caminho',
  em_andamento: 'Em andamento',
  concluido: 'Concluída',
};

interface Layers {
  hoje: boolean;
  ativos: boolean;
  espera: boolean;
  inativos: boolean;
  equipe: boolean;
}

export default function LiveMap() {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<Record<string, any>>({});
  const dataRef = useRef<any>(null);
  const layersRef = useRef<Layers>({ hoje: true, ativos: true, espera: true, inativos: false, equipe: true });
  const [layers, setLayers] = useState<Layers>({ hoje: true, ativos: true, espera: true, inativos: false, equipe: true });
  const [counts, setCounts] = useState({ hoje: 0, ativos: 0, espera: 0, inativos: 0, equipe: 0 });
  const [loading, setLoading] = useState(true);
  const [basemap, setBasemap] = useState<BasemapKey>('clean');
  const tileRef = useRef<any>(null);

  const draw = useCallback((data: any, visible: Layers) => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    const g = groupsRef.current;
    Object.values(g).forEach((layer: any) => layer.clearLayers());

    const bounds: [number, number][] = [];

    if (data.base) {
      bounds.push([data.base.lat, data.base.lng]);
      L.marker([data.base.lat, data.base.lng], {
        icon: L.divIcon({
          html: '<div style="font-size:26px;line-height:26px;">🏢</div>',
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .bindTooltip('🏢 ' + data.base.name + ' (sede)', { direction: 'top', offset: [0, -12] })
        .bindPopup('<strong>' + data.base.name + '</strong><br/>Sede')
        .addTo(g.base);
    }

    const CLIENT_STYLE: Record<string, { group: string; color: string; opacity: number; label: string }> = {
      ativo: { group: 'ativos', color: '#2BB3A3', opacity: 0.9, label: 'Cliente ativo' },
      em_espera: { group: 'espera', color: '#F2A03D', opacity: 0.9, label: 'Em espera (aguardando resposta)' },
      inativo: { group: 'inativos', color: '#9AA8A6', opacity: 0.6, label: 'Cliente inativo' },
    };

    for (const c of data.clients ?? []) {
      if (c.has_today && visible.hoje) continue;
      const st = CLIENT_STYLE[c.status];
      if (!st) continue;
      const on =
        (st.group === 'ativos' && visible.ativos) ||
        (st.group === 'espera' && visible.espera) ||
        (st.group === 'inativos' && visible.inativos);
      if (!on) continue;
      bounds.push([c.lat, c.lng]);
      L.circleMarker([c.lat, c.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 1.5,
        fillColor: st.color,
        fillOpacity: st.opacity,
      })
        .bindTooltip(
          c.name + (c.unit ? ' · ' + c.unit : '') + (c.status === 'ativo' ? '' : ' (' + st.label + ')'),
          { direction: 'top', offset: [0, -6] }
        )
        .bindPopup(
          '<strong>' + c.name + '</strong>' + (c.unit ? ' · ' + c.unit : '') + '<br/>' +
          st.label + (c.frequency ? ' · ' + c.frequency : '') + '<br/>' + (c.address ?? '')
        )
        .addTo(g[st.group]);
    }

    if (visible.hoje) {
      for (const h of data.houses ?? []) {
        bounds.push([h.lat, h.lng]);
        L.circleMarker([h.lat, h.lng], {
          radius: 13,
          color: '#ffffff',
          weight: 3,
          fillColor: h.team_color ?? '#8AA6A3',
          fillOpacity: h.status === 'concluido' ? 0.45 : 0.95,
        })
          .bindTooltip(
            '<strong>' + h.client + '</strong>' + (h.unit ? ' · ' + h.unit : '') + '<br/>' +
            new Date(h.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
            (h.team_name ? ' · ' + h.team_name : '') + ' · ' + (STATUS_LABEL[h.status] ?? h.status),
            { direction: 'top', offset: [0, -12] }
          )
          .bindPopup(
            '<strong>' + h.client + '</strong>' + (h.unit ? ' · ' + h.unit : '') + '<br/>' +
            new Date(h.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
            (h.team_name ? ' · ' + h.team_name : ' · sem equipe') + '<br/>' +
            (STATUS_LABEL[h.status] ?? h.status) + '<br/>' + (h.address ?? '')
          )
          .addTo(g.hoje);
      }
    }

    if (visible.equipe) {
      for (const p of data.people ?? []) {
        bounds.push([p.lat, p.lng]);
        const initials = String(p.name)
          .split(' ')
          .map((w: string) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            html:
              '<div style="width:30px;height:30px;border-radius:50%;background:' + p.team_color +
              ';border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);color:#fff;' +
              'font:700 12px system-ui;display:flex;align-items:center;justify-content:center;">' +
              initials + '</div>',
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        })
          .bindTooltip(
            '🧍 ' + p.name + (p.team_name ? ' · ' + p.team_name : '') + ' · há ' + p.minutes_ago + ' min',
            { direction: 'top', offset: [0, -16] }
          )
          .bindPopup(
            '<strong>' + p.name + '</strong>' + (p.team_name ? ' · ' + p.team_name : '') +
            '<br/>há ' + p.minutes_ago + ' min'
          )
          .addTo(g.equipe);
      }
    }

    if (bounds.length > 0 && !mapRef.current._fitted) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      mapRef.current._fitted = true;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/mapa');
      const data = await res.json();
      dataRef.current = data;
      const clients = data.clients ?? [];
      setCounts({
        hoje: (data.houses ?? []).length,
        ativos: clients.filter((c: any) => c.status === 'ativo').length,
        espera: clients.filter((c: any) => c.status === 'em_espera').length,
        inativos: clients.filter((c: any) => c.status === 'inativo').length,
        equipe: (data.people ?? []).length,
      });
      setLoading(false);
      draw(data, layersRef.current);
    } catch {
      setLoading(false);
    }
  }, [draw]);

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

    (async () => {
      await loadLeaflet();
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = window.L;
      mapRef.current = L.map(containerRef.current).setView([42.42, -71.06], 11);
      const bm = BASEMAPS.clean;
      tileRef.current = L.tileLayer(bm.url, {
        attribution: bm.attribution,
        maxZoom: bm.maxZoom,
      }).addTo(mapRef.current);
      groupsRef.current = {
        base: L.layerGroup().addTo(mapRef.current),
        inativos: L.layerGroup().addTo(mapRef.current),
        espera: L.layerGroup().addTo(mapRef.current),
        ativos: L.layerGroup().addTo(mapRef.current),
        hoje: L.layerGroup().addTo(mapRef.current),
        equipe: L.layerGroup().addTo(mapRef.current),
      };
      refresh();
      interval = setInterval(refresh, 60000);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [refresh]);

  useEffect(() => {
    layersRef.current = layers;
    if (dataRef.current) draw(dataRef.current, layers);
  }, [layers, draw]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !tileRef.current) return;
    const bm = BASEMAPS[basemap];
    mapRef.current.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(bm.url, {
      attribution: bm.attribution,
      maxZoom: bm.maxZoom,
    }).addTo(mapRef.current);
    tileRef.current.bringToBack();
  }, [basemap]);

  const toggle = (key: keyof Layers) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const chip = (key: keyof Layers, dot: string, label: string, count: number) => (
    <button
      type="button"
      onClick={() => toggle(key)}
      className={`flex min-h-touch items-center gap-2 rounded-card border px-4 py-2 text-sm font-medium ${
        layers[key]
          ? 'border-brand-700 bg-brand-50 text-brand-900'
          : 'border-brand-100 bg-white text-brand-800 opacity-60'
      }`}
    >
      <span aria-hidden>{dot}</span>
      {label} ({count})
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setBasemap(k)}
            className={`flex min-h-touch items-center gap-2 rounded-card border px-4 py-2 text-sm font-medium ${
              basemap === k
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            {BASEMAPS[k].label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {chip('hoje', '🔵', 'Limpezas de hoje', counts.hoje)}
        {chip('ativos', '🟢', 'Clientes ativos', counts.ativos)}
        {chip('espera', '🟡', 'Em espera', counts.espera)}
        {chip('inativos', '⚪', 'Clientes inativos', counts.inativos)}
        {chip('equipe', '🧍', 'Equipe agora', counts.equipe)}
      </div>

      {loading && <p className="mb-2 text-brand-800">Carregando o mapa…</p>}

      <div ref={containerRef} className="h-[70vh] w-full rounded-card border border-brand-100" />

      <p className="mt-2 text-sm text-brand-800">
        🏢 sede · círculos grandes = limpezas de hoje na <strong>cor da equipe</strong> responsável
        (mais claras quando concluídas) · pontos verdes = clientes ativos · amarelos = em espera · cinzas = inativos ·
        marcadores com iniciais = pessoas da equipe nos últimos 15 minutos. Atualiza a cada 60s;
        Passe o mouse sobre um ponto para ver o cliente; toque ou clique para os detalhes.
        Use as etiquetas para ligar e desligar camadas.
      </p>
    </div>
  );
}
