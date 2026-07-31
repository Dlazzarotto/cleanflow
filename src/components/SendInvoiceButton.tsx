'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SendInvoiceButton({
  invoiceId,
  alreadySent,
}: {
  invoiceId: string;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function send() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/faturas/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setMsg(`Enviada para ${data.to}`);
        router.refresh();
      } else {
        setMsg(data.error ?? 'Falha no envio.');
      }
    } catch {
      setMsg('Falha no envio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button className="btn-ghost" type="button" onClick={send} disabled={busy}>
        {busy ? 'Enviando…' : alreadySent ? '✉️ Reenviar' : '✉️ Enviar ao cliente'}
      </button>
      {msg && <span className={`text-sm ${ok ? 'text-brand-700' : 'text-red-700'}`}>{msg}</span>}
    </span>
  );
}
