'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { banClientAction } from '@/lib/actions';

export default function BanClientForm({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    const res = await banClientAction({ id: clientId, reason, password });
    if (res.ok) {
      setOpen(false);
      setPassword('');
      router.refresh();
    } else {
      setError(res.error ?? 'Não foi possível concluir.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50"
        onClick={() => setOpen(true)}
      >
        🚫 Banir cliente
      </button>
    );
  }

  return (
    <div className="card border-red-700">
      <p className="mb-2 text-xl font-bold text-red-800">Banir {clientName}</p>
      <p className="mb-4 text-brand-800">
        O cliente sai da operação (não aparece em agendamentos, estimates nem no mapa), mas o
        histórico é preservado. O motivo fica registrado com data e autor.
      </p>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ban-reason">Motivo do banimento *</label>
          <textarea
            className="input"
            id="ban-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: tentou contratar a profissional por fora, violando a cláusula 6 do contrato"
          />
        </div>
        <div>
          <label className="label" htmlFor="ban-pass">Confirme sua senha *</label>
          <input
            className="input"
            id="ban-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary !bg-red-700 hover:!bg-red-800"
            onClick={confirm}
            disabled={busy}
          >
            {busy ? 'Confirmando…' : 'Confirmar banimento'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setOpen(false);
              setError('');
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
