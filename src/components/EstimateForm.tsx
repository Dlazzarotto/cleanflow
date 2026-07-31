'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveEstimateAction, updateEstimateAction } from '@/lib/actions/estimates';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { DOC_LANGS } from '@/lib/i18n/documents';
import {
  BEDROOM_TASKS,
  BATHROOM_TASKS,
  EXTRA_ROOMS,
  calcEstimate,
  formatMinutes,
  type EstimateInput,
  type PricingSettings,
} from '@/lib/pricing';

interface Option {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  language?: string | null;
}

interface Market {
  hourly_low: number;
  hourly_high: number;
  visit_low: number;
  visit_high: number;
  deep_low: number;
  deep_high: number;
  resumo: string;
}

function usd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 12,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium text-brand-800">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-ghost !px-4"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Diminuir ${label}`}
        >
          −
        </button>
        <span className="w-8 text-center text-xl font-bold">{value}</span>
        <button
          type="button"
          className="btn-ghost !px-4"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function TaskCheck({
  checked,
  onToggle,
  label,
  min,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  min: number;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded-lg px-2 hover:bg-brand-50">
      <span className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={checked} onChange={onToggle} />
        {label}
      </span>
      <span className="text-sm text-brand-800">{min} min</span>
    </label>
  );
}

export interface EstimateInitial {
  id: string;
  client_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  frequency: string | null;
  language?: string | null;
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  bedroom_tasks: string[];
  bathroom_tasks: string[];
  extras: Record<string, string[]>;
  laundry: boolean;
  laundry_loads: number;
  deep_clean: boolean;
}

export default function EstimateForm({
  clients,
  settings,
  initial,
  preselectClientId,
}: {
  clients: Option[];
  settings: PricingSettings;
  initial?: EstimateInitial;
  preselectClientId?: string;
}) {
  const router = useRouter();
  const preselected = preselectClientId ? clients.find((c) => c.id === preselectClientId) : undefined;
  const [clientId, setClientId] = useState(initial?.client_id ?? preselected?.id ?? '');
  const [address, setAddress] = useState(initial?.address ?? preselected?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: initial?.lat ?? preselected?.lat ?? null,
    lng: initial?.lng ?? preselected?.lng ?? null,
  });
  const [leadName, setLeadName] = useState(initial?.lead_name ?? '');
  const [leadPhone, setLeadPhone] = useState(initial?.lead_phone ?? '');
  const [leadEmail, setLeadEmail] = useState(initial?.lead_email ?? '');

  const [bedrooms, setBedrooms] = useState(initial?.bedrooms ?? 3);
  const [fullBaths, setFullBaths] = useState(initial?.full_baths ?? 2);
  const [halfBaths, setHalfBaths] = useState(initial?.half_baths ?? 0);
  const [bedroomTasks, setBedroomTasks] = useState<string[]>(
    initial?.bedroom_tasks ?? BEDROOM_TASKS.filter((t) => t.default).map((t) => t.id)
  );
  const [bathroomTasks, setBathroomTasks] = useState<string[]>(
    initial?.bathroom_tasks ?? BATHROOM_TASKS.filter((t) => t.default).map((t) => t.id)
  );
  const [extras, setExtras] = useState<Record<string, string[]>>(
    initial?.extras ?? {
      cozinha: EXTRA_ROOMS.find((r) => r.id === 'cozinha')!.tasks.filter((t) => t.default).map((t) => t.id),
      sala: EXTRA_ROOMS.find((r) => r.id === 'sala')!.tasks.filter((t) => t.default).map((t) => t.id),
    }
  );
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'quinzenal');
  const [language, setLanguage] = useState((initial as any)?.language ?? 'pt');
  const [laundry, setLaundry] = useState(initial?.laundry ?? false);
  const [laundryLoads, setLaundryLoads] = useState(initial?.laundry_loads ?? 1);
  const [deepClean, setDeepClean] = useState(initial?.deep_clean ?? false);

  const [market, setMarket] = useState<Market | null>(null);
  const [marketError, setMarketError] = useState('');
  const [loadingMarket, setLoadingMarket] = useState(false);
  const lastSearchedCity = useRef('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const input: EstimateInput = useMemo(
    () => ({
      bedrooms,
      full_baths: fullBaths,
      half_baths: halfBaths,
      bedroom_tasks: bedroomTasks,
      bathroom_tasks: bathroomTasks,
      extras,
      laundry,
      laundry_loads: laundryLoads,
      deep_clean: deepClean,
    }),
    [bedrooms, fullBaths, halfBaths, bedroomTasks, bathroomTasks, extras, laundry, laundryLoads, deepClean]
  );

  // Manutenção (recorrente) e primeira limpeza (profunda)
  const manutencao = useMemo(
    () => calcEstimate({ ...input, deep_clean: false }, settings),
    [input, settings]
  );
  const primeira = useMemo(
    () => calcEstimate({ ...input, deep_clean: true }, settings),
    [input, settings]
  );
  const recorrente = frequency !== 'unica';
  const result = deepClean || !recorrente ? (deepClean ? primeira : manutencao) : manutencao;

  function toggleIn(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function toggleRoom(roomId: string) {
    setExtras((prev) => {
      const next = { ...prev };
      if (roomId in next) {
        delete next[roomId];
      } else {
        const room = EXTRA_ROOMS.find((r) => r.id === roomId)!;
        next[roomId] = room.tasks.filter((t) => t.default).map((t) => t.id);
      }
      return next;
    });
  }

  function toggleRoomTask(roomId: string, taskId: string) {
    setExtras((prev) => ({ ...prev, [roomId]: toggleIn(prev[roomId] ?? [], taskId) }));
  }

  function handleClientChange(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c?.address) {
      setAddress(c.address);
      const parts = c.address.split(',').map((p) => p.trim());
      if (parts.length >= 2) setCity(parts[1]);
    }
    setCoords({ lat: c?.lat ?? null, lng: c?.lng ?? null });
    if (c?.language) setLanguage(c.language);
  }

  // Dispara a pesquisa sozinha quando a cidade e definida (com debounce)
  useEffect(() => {
    const c = city.trim();
    if (c.length < 3 || c === lastSearchedCity.current) return;
    const t = setTimeout(() => {
      lastSearchedCity.current = c;
      searchMarket();
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  async function searchMarket() {
    if (!city.trim()) {
      setMarketError('Informe a cidade para pesquisar os preços da região.');
      return;
    }
    lastSearchedCity.current = city.trim();
    setLoadingMarket(true);
    setMarketError('');
    setMarket(null);
    try {
      const res = await fetch('/api/estimate/mercado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      });
      const data = await res.json();
      if (data.market) setMarket(data.market as Market);
      else setMarketError(data.error ?? 'Não foi possível pesquisar agora.');
    } catch {
      setMarketError('Não foi possível pesquisar agora.');
    } finally {
      setLoadingMarket(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const c = clients.find((x) => x.id === clientId);
      const payload = {
        client_id: clientId || null,
        lead_name: clientId ? null : leadName.trim() || null,
        lead_phone: clientId ? null : leadPhone.trim() || null,
        lead_email: clientId ? null : leadEmail.trim() || null,
        address: address || null,
        city: city || null,
        frequency,
        language,
        lat: coords.lat ?? c?.lat ?? null,
        lng: coords.lng ?? c?.lng ?? null,
        input,
        first_price: recorrente ? primeira.price_low : null,
        first_minutes: recorrente ? primeira.minutes : null,
        recurring_price: recorrente ? manutencao.price_low : null,
        market_notes: market
          ? `Mercado em ${city}: ${usd(market.visit_low)}–${usd(market.visit_high)}/visita, ${usd(market.hourly_low)}–${usd(market.hourly_high)}/h. ${market.resumo}`
          : null,
      };
      if (initial?.id) {
        await updateEstimateAction(initial.id, payload);
      } else {
        await saveEstimateAction(payload);
      }
      router.push('/estimates');
      router.refresh();
    } catch {
      setSaveError('Não foi possível salvar o estimate. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Cliente / endereco */}
        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-brand-900">Para quem é o estimate</h2>
          <div>
            <label className="label" htmlFor="est-client">Cliente já cadastrado (opcional)</label>
            <select className="input" id="est-client" value={clientId} onChange={(e) => handleClientChange(e.target.value)}>
              <option value="">Novo lead / sem cadastro</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {clientId === '' && (
            <div className="rounded-card bg-brand-50 p-4">
              <p className="mb-3 font-semibold text-brand-900">Dados do lead</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="lead-name">Nome</label>
                  <input className="input" id="lead-name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="lead-phone">Telefone</label>
                  <input className="input" id="lead-phone" type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="lead-email">Email</label>
                  <input className="input" id="lead-email" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="est-address">Endereço</label>
              <AddressAutocomplete
                id="est-address"
                withHiddenFields={false}
                value={address}
                onValueChange={setAddress}
                onPlace={(p) => {
                  setAddress(p.address);
                  if (p.city) setCity(p.city);
                  setCoords({ lat: p.lat, lng: p.lng });
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="est-city">Cidade (para pesquisa de mercado)</label>
              <input className="input" id="est-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Malden, MA" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="est-language">Idioma do cliente (documentos e email)</label>
            <select className="input" id="est-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {DOC_LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="est-frequency">Frequência desejada</label>
            <select className="input" id="est-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="unica">Limpeza única</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          </div>
        </div>

        {/* Quartos */}
        <div className="card space-y-3">
          <Stepper label="Quartos" value={bedrooms} onChange={setBedrooms} />
          {bedrooms > 0 && (
            <div className="rounded-card bg-brand-50 p-3">
              <p className="mb-1 text-sm font-semibold text-brand-800">O que fazer em cada quarto:</p>
              {BEDROOM_TASKS.map((t) => (
                <TaskCheck
                  key={t.id}
                  checked={bedroomTasks.includes(t.id)}
                  onToggle={() => setBedroomTasks((prev) => toggleIn(prev, t.id))}
                  label={t.label}
                  min={t.min}
                />
              ))}
            </div>
          )}
        </div>

        {/* Banheiros */}
        <div className="card space-y-3">
          <Stepper label="Banheiros completos" value={fullBaths} onChange={setFullBaths} />
          {fullBaths > 0 && (
            <div className="rounded-card bg-brand-50 p-3">
              <p className="mb-1 text-sm font-semibold text-brand-800">O que fazer em cada banheiro:</p>
              {BATHROOM_TASKS.map((t) => (
                <TaskCheck
                  key={t.id}
                  checked={bathroomTasks.includes(t.id)}
                  onToggle={() => setBathroomTasks((prev) => toggleIn(prev, t.id))}
                  label={t.label}
                  min={t.min}
                />
              ))}
            </div>
          )}
          <Stepper label="Lavabos (meio banheiro)" value={halfBaths} onChange={setHalfBaths} />
        </div>

        {/* Outros comodos */}
        <div className="card space-y-3">
          <h2 className="text-xl font-semibold text-brand-900">Outros cômodos</h2>
          {EXTRA_ROOMS.map((room) => {
            const active = (extras[room.id] ?? []).length > 0 || room.id in extras;
            const selected = extras[room.id] ?? [];
            return (
              <div key={room.id}>
                <label className="flex min-h-touch cursor-pointer items-center gap-3 font-medium text-brand-800">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-700"
                    checked={active}
                    onChange={() => toggleRoom(room.id)}
                  />
                  {room.label}
                </label>
                {active && room.tasks.length > 1 && (
                  <div className="ml-8 rounded-card bg-brand-50 p-3">
                    {room.tasks.map((t) => (
                      <TaskCheck
                        key={t.id}
                        checked={selected.includes(t.id)}
                        onToggle={() => toggleRoomTask(room.id, t.id)}
                        label={t.label}
                        min={t.min}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Laundry e deep */}
        <div className="card space-y-3">
          <label className="flex min-h-touch cursor-pointer items-center gap-3 font-medium text-brand-800">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={laundry} onChange={() => setLaundry(!laundry)} />
            🧺 Laundry (lavar e dobrar roupa)
          </label>
          {laundry && (
            <div className="ml-8">
              <Stepper label="Cargas de roupa" value={laundryLoads} onChange={setLaundryLoads} min={1} max={6} />
            </div>
          )}
          {recorrente ? (
            <div className="rounded-card bg-brand-50 p-3">
              <p className="font-semibold text-brand-900">
                ✨ A primeira limpeza é profunda (×{settings.deep_multiplier})
              </p>
              <p className="mt-1 text-sm text-brand-800">
                Padrão do mercado: a primeira visita leva mais tempo e custa mais; as seguintes são
                de manutenção. O cliente vê os dois valores no documento.
              </p>
            </div>
          ) : (
            <label className="flex min-h-touch cursor-pointer items-center gap-3 font-medium text-brand-800">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={deepClean} onChange={() => setDeepClean(!deepClean)} />
              ✨ Limpeza profunda (deep cleaning) ×{settings.deep_multiplier}
            </label>
          )}
        </div>
      </div>

      {/* Painel de resultado */}
      <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="card bg-brand-900 !border-brand-900 text-white">
          {recorrente ? (
            <>
              <p className="text-brand-100">✨ Primeira limpeza (profunda)</p>
              <p className="text-3xl font-bold text-aqua-400">
                {usd(primeira.price_low)} – {usd(primeira.price_high)}
              </p>
              <p className="text-sm text-brand-100">{formatMinutes(primeira.minutes)}</p>

              <p className="mt-4 text-brand-100">🧹 Limpezas seguintes ({frequency})</p>
              <p className="text-3xl font-bold text-white">
                {usd(manutencao.price_low)} – {usd(manutencao.price_high)}
              </p>
              <p className="text-sm text-brand-100">{formatMinutes(manutencao.minutes)}</p>
            </>
          ) : (
            <>
              <p className="text-brand-100">Tempo estimado</p>
              <p className="text-3xl font-bold">{formatMinutes(result.minutes)}</p>
              <p className="mt-4 text-brand-100">Faixa de preço</p>
              <p className="text-4xl font-bold text-aqua-400">
                {usd(result.price_low)} – {usd(result.price_high)}
              </p>
            </>
          )}
          <p className="mt-3 text-sm text-brand-100">
            Base: {usd(settings.hourly_rate)}/h · mínimo {usd(settings.min_price)}
          </p>
        </div>

        <div className="card">
          <button className="btn-ghost w-full" type="button" onClick={searchMarket} disabled={loadingMarket}>
            {loadingMarket ? '🔍 Pesquisando a região…' : market ? '🔄 Atualizar pesquisa' : '🔍 Pesquisar preços da região'}
          </button>
          {marketError && <p className="mt-2 text-red-700">{marketError}</p>}
          {market && (
            <div className="mt-3 space-y-1 text-brand-900">
              <p><span className="font-semibold">Por visita:</span> {usd(market.visit_low)} – {usd(market.visit_high)}</p>
              <p><span className="font-semibold">Por hora:</span> {usd(market.hourly_low)} – {usd(market.hourly_high)}</p>
              <p><span className="font-semibold">Deep clean:</span> {usd(market.deep_low)} – {usd(market.deep_high)}</p>
              <p className="mt-2 text-sm text-brand-800">{market.resumo}</p>
            </div>
          )}
        </div>

        {saveError && <p className="text-red-700">{saveError}</p>}
        <button className="btn-primary w-full" type="button" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : initial?.id ? 'Salvar alterações' : 'Salvar estimate'}
        </button>
      </div>
    </div>
  );
}
