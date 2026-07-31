'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startDayAction, endDayAction } from '@/lib/actions/shifts';
import { getPosition } from '@/lib/geo';

export default function DayControl({
  openShift,
  pendingCount,
}: {
  openShift: { started_at: string } | null;
  pendingCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [note, setNote] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    const pos = await getPosition();
    const res = await startDayAction({ lat: pos?.lat ?? null, lng: pos?.lng ?? null });
    if (!res.ok) setError(res.error ?? 'Não foi possível iniciar.');
    else router.refresh();
    setBusy(false);
  }

  async function end() {
    setBusy(true);
    setError('');
    const pos = await getPosition();
    const res = await endDayAction({ lat: pos?.lat ?? null, lng: pos?.lng ?? null, note });
    if (!res.ok) setError(res.error ?? 'Não foi possível encerrar.');
    else {
      setConfirmEnd(false);
      setNote('');
      router.refresh();
    }
    setBusy(false);
  }

  if (!openShift) {
    return (
      <div className="card mb-6 border-2 border-aqua-500">
        <p className="text-xl font-bold text-brand-900">Bom dia! ☀️</p>
        <p className="mt-1 text-brand-800">
          Comece registrando o início do seu dia. A partir daí você poderá fazer o check-in nas casas.
        </p>
        <button className="btn-primary mt-3 w-full" type="button" onClick={start} disabled={busy}>
          {busy ? 'Registrando…' : '▶️ Iniciar meu dia'}
        </button>
        {error && <p className="mt-2 rounded-card bg-red-50 p-3 text-red-800">{error}</p>}
      </div>
    );
  }

  const inicio = new Date(openShift.started_at);
  const horas = (Date.now() - inicio.getTime()) / 3600000;

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-900">
            ⏱️ Dia iniciado às{' '}
            {inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm text-brand-800">
            {horas < 1
              ? `há ${Math.round(horas * 60)} min`
              : `há ${Math.floor(horas)}h ${Math.round((horas % 1) * 60)}min`}
            {pendingCount > 0 ? ` · ${pendingCount} limpeza(s) pendente(s) hoje` : ' · nada pendente hoje'}
          </p>
        </div>
        {!confirmEnd && (
          <button className="btn-ghost" type="button" onClick={() => setConfirmEnd(true)}>
            ⏹️ Encerrar meu dia
          </button>
        )}
      </div>

      {confirmEnd && (
        <div className="mt-3 rounded-card bg-brand-50 p-4">
          {pendingCount > 0 && (
            <p className="mb-2 text-brand-900">
              ⚠️ Ainda há {pendingCount} limpeza(s) de hoje sem conclusão. Se encerrar agora, avise o
              escritório no campo abaixo.
            </p>
          )}
          <label className="label" htmlFor="shift-note">Alguma observação do dia? (opcional)</label>
          <textarea
            className="input"
            id="shift-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: cliente da tarde remarcou, voltei mais cedo"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" type="button" onClick={end} disabled={busy}>
              {busy ? 'Encerrando…' : 'Confirmar encerramento'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => setConfirmEnd(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 rounded-card bg-red-50 p-3 text-red-800">{error}</p>}
    </div>
  );
}
