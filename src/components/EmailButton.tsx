'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailButton({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function send() {
    setState('sending');
    setMessage('');
    try {
      const res = await fetch('/api/estimate/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: estimateId }),
      });
      const data = await res.json();
      if (data.ok) {
        setState('ok');
        setMessage(`Enviado para ${data.to}`);
        router.refresh();
      } else {
        setState('error');
        setMessage(data.error ?? 'Falha no envio.');
      }
    } catch {
      setState('error');
      setMessage('Falha no envio.');
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button className="btn-ghost" type="button" onClick={send} disabled={state === 'sending'}>
        {state === 'sending' ? 'Enviando…' : '✉️ Enviar por email'}
      </button>
      {message && (
        <span className={`text-sm ${state === 'ok' ? 'text-brand-700' : 'text-red-700'}`}>{message}</span>
      )}
    </span>
  );
}
