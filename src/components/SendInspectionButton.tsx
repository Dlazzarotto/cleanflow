'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SendInspectionButton({
  inspectionId,
  jaEnviada,
}: {
  inspectionId: string;
  jaEnviada: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function enviar() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/inspecoes/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspection_id: inspectionId }),
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setMsg(`Enviado para ${data.to}`);
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
      <button className="btn-primary" type="button" onClick={enviar} disabled={busy}>
        {busy ? 'Enviando…' : jaEnviada ? '✉️ Reenviar ao cliente' : '✉️ Enviar ao cliente'}
      </button>
      {msg && <span className={`text-sm ${ok ? 'text-brand-700' : 'text-red-700'}`}>{msg}</span>}
    </span>
  );
}
