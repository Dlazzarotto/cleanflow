'use client';
import { useState } from 'react';

export default function SmsDiagnostic() {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function testar() {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/diagnostico/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      setRes(await r.json());
    } catch {
      setRes({ ok: false, diagnostico: 'Falha ao chamar o teste.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold text-brand-900">📱 Teste de envio de SMS</h2>
      <p className="text-brand-800">
        Envie uma mensagem de teste para confirmar que os lembretes e faturas vão chegar por
        telefone.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label" htmlFor="sms-to">Telefone de teste</label>
          <input
            className="input"
            id="sms-to"
            type="tel"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="(617) 555-0100"
          />
        </div>
        <button className="btn-primary" type="button" onClick={testar} disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar SMS de teste'}
        </button>
      </div>

      {res && (
        <div className={`rounded-card p-4 ${res.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-800'}`}>
          <p className="font-medium">{res.ok ? '✓ SMS enviado' : '⚠️ Não foi possível enviar'}</p>
          <p className="mt-1">{res.diagnostico}</p>
          {res.remetente && <p className="mt-2 text-sm">Enviado do número {res.remetente}</p>}
        </div>
      )}
    </div>
  );
}
