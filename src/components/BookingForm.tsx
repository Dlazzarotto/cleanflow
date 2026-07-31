'use client';
import { useState } from 'react';
import { createBookingAction } from '@/lib/actions';
import type { Suggestion } from '@/lib/types';

interface Option {
  id: string;
  name: string;
  defaultPrice?: number | null;
}

export default function BookingForm({ clients, teams }: { clients: Option[]; teams: Option[] }) {
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [teamId, setTeamId] = useState('');
  const [repeat, setRepeat] = useState('nao');
  const [tipo, setTipo] = useState('limpeza');
  const [price, setPrice] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestMessage, setSuggestMessage] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  async function handleClientChange(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c?.defaultPrice != null) setPrice(Number(c.defaultPrice));
    setSuggestions([]);
    setSuggestMessage('');
    if (!id) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/sugestoes?clientId=${id}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setSuggestMessage(data.message ?? '');
    } catch {
      setSuggestMessage('Não foi possível calcular sugestões agora.');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function applySuggestion(s: Suggestion) {
    setDate(s.date);
    setTime(s.suggested_time);
    setTeamId(s.team_id);
  }

  const weekday = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

  return (
    <form action={createBookingAction} className="card space-y-4">
      <div>
        <label className="label" htmlFor="type">Tipo</label>
        <select className="input" id="type" name="type" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="limpeza">🧹 Limpeza</option>
          <option value="visita">👋 Visita de orçamento</option>
        </select>
        {tipo === 'visita' && (
          <p className="mt-1 text-sm text-brand-800">
            Visitas entram na rota da equipe como as limpezas, mas sem preço. Ao concluir,
            você cria o estimate a partir dela.
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="client_id">Cliente *</label>
        <select
          className="input"
          id="client_id"
          name="client_id"
          required
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
        >
          <option value="" disabled>Selecionar cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loadingSuggestions && (
        <p className="text-brand-800">Calculando os melhores encaixes de rota…</p>
      )}
      {suggestMessage && <p className="text-brand-800">{suggestMessage}</p>}
      {suggestions.length > 0 && (
        <div className="rounded-card bg-brand-50 p-4">
          <p className="mb-3 font-semibold text-brand-900">
            💡 Melhores encaixes (menor deslocamento da equipe)
          </p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applySuggestion(s)}
                className="flex min-h-touch w-full flex-wrap items-center justify-between gap-2 rounded-card border border-brand-100 bg-white px-4 py-3 text-left hover:border-aqua-500"
              >
                <span>
                  <span className="font-semibold capitalize">{weekday(s.date)}</span>{' '}
                  às {s.suggested_time} ·{' '}
                  <span
                    className="rounded-full px-2 py-0.5 text-sm font-medium text-white"
                    style={{ backgroundColor: s.team_color }}
                  >
                    {s.team_name}
                  </span>
                </span>
                <span className="text-sm text-brand-800">
                  a {s.distance_mi} mi de {s.nearest_client} ({s.bookings_that_day}{' '}
                  {s.bookings_that_day === 1 ? 'limpeza' : 'limpezas'} no dia)
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-brand-800">
            Tocar numa sugestão preenche data, horário e equipe — você pode ajustar depois.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">Data *</label>
          <input
            className="input" id="date" name="date" type="date" required
            value={date} onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="time">Horário *</label>
          <input
            className="input" id="time" name="time" type="time" required
            value={time} onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="duration_minutes">Duração (min)</label>
          <input className="input" id="duration_minutes" name="duration_minutes" type="number" defaultValue={tipo === 'visita' ? 45 : 120} min={15} step={15} key={tipo} />
        </div>
        <div>
          <label className="label" htmlFor="price">Preço (USD)</label>
          <input className="input" id="price" name="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} step={5} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="team_id">Equipe</label>
        <select
          className="input" id="team_id" name="team_id"
          value={teamId} onChange={(e) => setTeamId(e.target.value)}
        >
          <option value="">Definir depois</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="repeat">Repetir</label>
          <select
            className="input" id="repeat" name="repeat"
            value={repeat} onChange={(e) => setRepeat(e.target.value)}
          >
            <option value="nao">Não repetir</option>
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal (a cada 4 semanas)</option>
          </select>
        </div>
        {repeat !== 'nao' && (
          <div>
            <label className="label" htmlFor="occurrences">Quantas limpezas criar</label>
            <input className="input" id="occurrences" name="occurrences" type="number" defaultValue={12} min={2} max={52} />
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="notes">Observações</label>
        <textarea className="input" id="notes" name="notes" rows={3} />
      </div>

      <button className="btn-primary w-full" type="submit">
        {tipo === 'visita' ? 'Agendar visita' : repeat === 'nao' ? 'Agendar limpeza' : 'Agendar série de limpezas'}
      </button>
    </form>
  );
}
