'use client';
import { useState } from 'react';

export default function ReminderPanel() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function enviarAgora() {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/cron/lembretes', { method: 'POST' });
      setRes(await r.json());
    } catch {
      setRes({ error: 'Falha ao executar.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button className="btn-ghost" type="button" onClick={enviarAgora} disabled={busy}>
        {busy ? 'Enviando…' : '📨 Enviar lembretes de amanhã agora'}
      </button>
      {res && (
        <div className="mt-2 rounded-card bg-brand-50 p-3">
          {res.error ? (
            <p className="text-red-800">{res.error}</p>
          ) : (
            <>
              <p className="text-brand-900">
                Limpezas amanhã ({res.data}): <strong>{res.total}</strong> · 📱 SMS:{' '}
                <strong>{res.sms}</strong> · ✉️ email: <strong>{res.email}</strong> · pulados:{' '}
                {res.pulados} · falhas: {res.falhas}
              </p>
              {(res.detalhes ?? []).length > 0 && (
                <ul className="mt-2 ml-5 list-disc text-sm text-brand-800">
                  {res.detalhes.map((d: string, i: number) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {res.pulados > 0 && (
            <p className="mt-1 text-sm text-brand-800">
              &quot;Pulados&quot; são clientes sem email cadastrado ou que já receberam o lembrete.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
