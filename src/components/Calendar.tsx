'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { updateBookingAction, cancelBookingAction } from '@/lib/actions';
import { STATUS_LABEL, type Booking, type BookingStatus } from '@/lib/types';

interface Option {
  id: string;
  name: string;
}

type View = 'dia' | 'semana' | 'mes';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  return addDays(x, -x.getDay()); // domingo
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hm(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Calendar({
  teams,
  abrirBooking,
}: {
  teams: Option[];
  abrirBooking?: string;
}) {
  const [view, setView] = useState<View>('semana');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const jaAbriu = useRef(false);

  // Abre direto a limpeza indicada na URL (vindo da lista de Agendamentos)
  useEffect(() => {
    if (!abrirBooking || jaAbriu.current || bookings.length === 0) return;
    const alvo = bookings.find((b) => b.id === abrirBooking);
    if (alvo) {
      setSelected(alvo);
      jaAbriu.current = true;
    }
  }, [abrirBooking, bookings]);

  const range = useMemo(() => {
    if (view === 'dia') return { start: anchor, end: addDays(anchor, 1) };
    if (view === 'semana') {
      const s = startOfWeek(anchor);
      return { start: s, end: addDays(s, 7) };
    }
    const s = startOfMonth(anchor);
    const gridStart = startOfWeek(s);
    return { start: gridStart, end: addDays(gridStart, 42) };
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings?start=${range.start.toISOString()}&end=${range.end.toISOString()}`
      );
      const data = await res.json();
      setBookings((data.bookings ?? []) as Booking[]);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = ymd(new Date(b.scheduled_at));
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings]);

  function navigate(dir: -1 | 1) {
    if (view === 'dia') setAnchor(addDays(anchor, dir));
    else if (view === 'semana') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  }

  const title =
    view === 'mes'
      ? anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : view === 'semana'
        ? `${startOfWeek(anchor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
        : anchor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function BookingChip({ b }: { b: Booking }) {
    const cancelled = b.status === 'cancelado';
    return (
      <button
        type="button"
        onClick={() => setSelected(b)}
        className={`block w-full rounded-lg border px-2 py-1 text-left text-sm hover:border-aqua-500 ${
          cancelled ? 'border-brand-100 bg-white text-brand-800 line-through opacity-60' : 'border-brand-100 bg-white'
        }`}
        style={!cancelled && b.teams ? { borderLeft: `4px solid ${b.teams.color}` } : undefined}
      >
        <span className="font-semibold">{hm(b.scheduled_at)}</span>{' '}
        {b.clients?.full_name ?? 'Cliente'}
        {b.series_id && <span title="Faz parte de uma série"> 🔁</span>}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => navigate(-1)} aria-label="Anterior">‹</button>
          <button className="btn-ghost" onClick={() => setAnchor(startOfDay(new Date()))}>Hoje</button>
          <button className="btn-ghost" onClick={() => navigate(1)} aria-label="Próximo">›</button>
          <h2 className="ml-2 text-xl font-semibold capitalize text-brand-900">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {(['dia', 'semana', 'mes'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={v === view ? 'btn-primary capitalize' : 'btn-ghost capitalize'}
            >
              {v === 'mes' ? 'Mês' : v}
            </button>
          ))}
          <Link href="/agendamentos/novo" className="btn-primary">+ Nova</Link>
        </div>
      </div>

      {loading && <p className="mb-3 text-brand-800">Carregando…</p>}

      {view === 'dia' && (
        <div className="space-y-2">
          {(byDay.get(ymd(anchor)) ?? []).map((b) => (
            <BookingChip key={b.id} b={b} />
          ))}
          {(byDay.get(ymd(anchor)) ?? []).length === 0 && !loading && (
            <div className="card text-brand-800">Nenhuma limpeza neste dia.</div>
          )}
        </div>
      )}

      {view === 'semana' && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(startOfWeek(anchor), i);
            const key = ymd(day);
            const isToday = key === ymd(new Date());
            return (
              <div key={key} className={`card !p-3 ${isToday ? '!border-aqua-500' : ''}`}>
                <p className="mb-2 font-semibold text-brand-900">
                  {weekDays[day.getDay()]} {day.getDate()}
                </p>
                <div className="space-y-1">
                  {(byDay.get(key) ?? []).map((b) => (
                    <BookingChip key={b.id} b={b} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'mes' && (
        <div>
          <div className="mb-1 hidden grid-cols-7 gap-1 md:grid">
            {weekDays.map((d) => (
              <p key={d} className="text-center font-semibold text-brand-800">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => {
              const day = addDays(startOfWeek(startOfMonth(anchor)), i);
              const key = ymd(day);
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = key === ymd(new Date());
              const items = byDay.get(key) ?? [];
              if (!inMonth && items.length === 0) {
                return <div key={key} className="hidden min-h-24 rounded-card bg-transparent md:block" />;
              }
              return (
                <div
                  key={key}
                  className={`rounded-card border bg-white p-2 md:min-h-24 ${
                    isToday ? 'border-aqua-500' : 'border-brand-100'
                  } ${!inMonth ? 'opacity-50' : ''} ${items.length === 0 ? 'hidden md:block' : ''}`}
                >
                  <p className="mb-1 text-sm font-semibold text-brand-800">
                    <span className="md:hidden">{weekDays[day.getDay()]} </span>
                    {day.getDate()}
                  </p>
                  <div className="space-y-1">
                    {items.map((b) => (
                      <BookingChip key={b.id} b={b} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <EditModal
          booking={selected}
          teams={teams}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  booking,
  teams,
  onClose,
  onSaved,
}: {
  booking: Booking;
  teams: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const start = new Date(booking.scheduled_at);
  const [date, setDate] = useState(ymd(start));
  const [time, setTime] = useState(
    `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
  );
  const [duration, setDuration] = useState(booking.duration_minutes);
  const [price, setPrice] = useState(Number(booking.price));
  const [teamId, setTeamId] = useState(booking.team_id ?? '');
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [frequencia, setFrequencia] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);

  const emSerie = Boolean(booking.series_id);
  // Limpeza que ainda não aconteceu não pode ser marcada como concluída
  const noFuturo = new Date(`${date}T${time}`) > new Date();

  async function save(escopo: 'one' | 'series') {
    setSaving(true);
    setError('');
    try {
      await updateBookingAction({
        id: booking.id,
        scope: escopo,
        date,
        time,
        duration_minutes: duration,
        price,
        team_id: teamId || null,
        status,
        frequency: escopo === 'series' && frequencia ? frequencia : null,
      });
      onSaved();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
      setSaving(false);
    }
  }

  async function cancel(escopo: 'one' | 'series') {
    setSaving(true);
    setError('');
    try {
      await cancelBookingAction({ id: booking.id, scope: escopo });
      onSaved();
    } catch {
      setError('Não foi possível cancelar. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-white p-5 md:rounded-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-brand-900">
              {booking.clients?.full_name ?? 'Limpeza'}
            </h3>
            <p className="text-brand-800">{booking.clients?.address}</p>
            <p className="mt-1 text-sm text-brand-800">
              Status atual: {STATUS_LABEL[booking.status]}
              {booking.series_id ? ' · faz parte de uma série 🔁' : ''}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {emSerie && (
          <div className="mb-4 rounded-card bg-brand-50 p-3 text-brand-800">
            🔁 Esta limpeza faz parte de uma série. Ao salvar, escolha se a mudança vale só para
            hoje ou para as próximas também.
          </div>
        )}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-date">Data</label>
              <input className="input" id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="edit-time">Horário</label>
              <input className="input" id="edit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-duration">Duração (min)</label>
              <input className="input" id="edit-duration" type="number" min={30} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="edit-price">Preço (USD)</label>
              <input className="input" id="edit-price" type="number" min={0} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="edit-team">Equipe</label>
            <select className="input" id="edit-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Sem equipe</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {emSerie && (
            <div className="rounded-card bg-brand-50 p-4">
              <label className="label" htmlFor="edit-freq">
                Frequência das próximas limpezas
              </label>
              <select
                className="input"
                id="edit-freq"
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
              >
                <option value="">Manter como está</option>
                <option value="semanal">Semanal — toda semana</option>
                <option value="quinzenal">Quinzenal — a cada 2 semanas</option>
                <option value="tres_semanas">A cada 3 semanas</option>
                <option value="mensal">Mensal — a cada 4 semanas</option>
              </select>
              <p className="mt-1 text-sm text-brand-800">
                {frequencia
                  ? 'As próximas limpezas serão reagendadas com o novo intervalo, a partir da data acima. Vale ao usar "Mudar esta e as próximas".'
                  : 'Mantendo, as próximas apenas acompanham a mudança de data e horário.'}
              </p>
            </div>
          )}

          {noFuturo && status === 'concluido' && (
            <p className="rounded-card bg-sun/20 p-3 text-brand-900">
              ⚠️ Esta limpeza está marcada para uma data futura. Só marque como concluída depois
              que o serviço acontecer — a fatura do cliente nasce nesse momento.
            </p>
          )}

          <div>
            <label className="label" htmlFor="edit-status">Status</label>
            <select className="input" id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {(Object.keys(STATUS_LABEL) as BookingStatus[])
                // Serviço futuro não pode ser dado como concluído
                .filter((s) => !(noFuturo && s === 'concluido'))
                .map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
            </select>
          </div>

          {error && <p className="text-red-700">{error}</p>}

          {/* Salvar */}
          <div className="space-y-2 border-t border-brand-100 pt-4">
            {emSerie ? (
              <>
                <button
                  className="btn-primary w-full"
                  onClick={() => save('one')}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : '✓ Mudar só esta limpeza'}
                </button>
                <button
                  className="btn-primary w-full !bg-brand-700"
                  onClick={() => save('series')}
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando…'
                    : frequencia
                      ? '🔁 Mudar esta e reagendar as próximas'
                      : '🔁 Mudar esta e as próximas'}
                </button>
              </>
            ) : (
              <button className="btn-primary w-full" onClick={() => save('one')} disabled={saving}>
                {saving ? 'Salvando…' : '✓ Salvar mudanças'}
              </button>
            )}

            <button className="btn-ghost w-full" onClick={onClose} disabled={saving}>
              ← Cancelar mudança
            </button>
          </div>

          {/* Cancelar a limpeza — ação separada, com confirmação */}
          <div className="border-t border-brand-100 pt-4">
            {!confirmarCancelamento ? (
              <button
                className="btn-ghost w-full !border-red-700 !text-red-700 hover:!bg-red-50"
                onClick={() => setConfirmarCancelamento(true)}
                disabled={saving}
              >
                🗑️ Cancelar esta limpeza
              </button>
            ) : (
              <div className="rounded-card bg-red-50 p-4">
                <p className="mb-3 font-medium text-red-800">
                  {emSerie
                    ? 'Cancelar a limpeza. Vale só para hoje ou para as próximas também?'
                    : 'Tem certeza que quer cancelar esta limpeza?'}
                </p>
                <div className="space-y-2">
                  <button
                    className="btn-ghost w-full !border-red-700 !text-red-700 hover:!bg-red-100"
                    onClick={() => cancel('one')}
                    disabled={saving}
                  >
                    {emSerie ? 'Cancelar só esta' : 'Sim, cancelar'}
                  </button>
                  {emSerie && (
                    <button
                      className="btn-ghost w-full !border-red-700 !text-red-700 hover:!bg-red-100"
                      onClick={() => cancel('series')}
                      disabled={saving}
                    >
                      Cancelar esta e as próximas
                    </button>
                  )}
                  <button
                    className="btn-ghost w-full"
                    onClick={() => setConfirmarCancelamento(false)}
                    disabled={saving}
                  >
                    ← Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
