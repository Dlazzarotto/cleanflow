'use client';
import { useState } from 'react';

export default function EmailDiagnostic() {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function testar() {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/diagnostico/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to || undefined }),
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
      <h2 className="text-xl font-semibold text-brand-900">✉️ Teste de envio de email</h2>
      <p className="text-brand-800">
        Use para descobrir por que um convite ou fatura não chegou. O teste mostra a resposta exata
        do provedor de email.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label" htmlFor="diag-to">Enviar teste para</label>
          <input
            className="input"
            id="diag-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="deixe vazio para enviar ao seu próprio email"
          />
        </div>
        <button className="btn-primary" type="button" onClick={testar} disabled={busy}>
          {busy ? 'Testando…' : 'Testar envio'}
        </button>
      </div>

      {res && (
        <div className={`rounded-card p-4 ${res.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-800'}`}>
          <p className="font-medium">{res.ok ? '✓ Envio aceito pelo provedor' : '⚠️ Não foi possível enviar'}</p>
          <p className="mt-1">{res.diagnostico ?? res.error}</p>
          <p className="mt-2 text-sm">
            Chave configurada: {res.chave_configurada ? 'sim' : 'não'} · Remetente: {res.remetente}
            {!res.dominio_proprio && ' (domínio de teste — só entrega para o email da conta Resend)'}
          </p>
        </div>
      )}
    </div>
  );
}
