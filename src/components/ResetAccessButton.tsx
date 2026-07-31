'use client';
import { useState } from 'react';

export default function ResetAccessButton({
  membershipId,
  personName,
}: {
  membershipId: string;
  personName: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    email?: string;
    password?: string;
    emailSent?: boolean;
    emailError?: string | null;
    error?: string;
  } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/equipe/acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_id: membershipId,
          password: password || undefined,
          send_email: sendEmail,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          ok: true,
          email: data.email,
          password: data.password,
          emailSent: data.email_sent,
          emailError: data.email_error,
        });
        setPassword('');
      } else {
        setResult({ ok: false, error: data.error ?? 'Falha ao redefinir.' });
      }
    } catch {
      setResult({ ok: false, error: 'Falha ao redefinir.' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-ghost" type="button" onClick={() => setOpen(true)}>
        🔑 Enviar acesso
      </button>
    );
  }

  return (
    <div className="w-full rounded-card bg-brand-50 p-4">
      <p className="mb-3 font-semibold text-brand-900">Acesso de {personName}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={`pw-${membershipId}`}>
            Nova senha (vazio = gerar automática)
          </label>
          <input
            className="input"
            id={`pw-${membershipId}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 8 caracteres"
          />
        </div>
        <label className="flex min-h-touch cursor-pointer items-center gap-3 md:mt-7">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-700"
            checked={sendEmail}
            onChange={() => setSendEmail(!sendEmail)}
          />
          Enviar por email
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" type="button" onClick={run} disabled={busy}>
          {busy ? 'Aplicando…' : 'Redefinir e enviar'}
        </button>
        <button className="btn-ghost" type="button" onClick={() => { setOpen(false); setResult(null); }}>
          Fechar
        </button>
      </div>

      {result && (
        <div className={`mt-3 rounded-card p-3 ${result.ok ? 'bg-white' : 'bg-red-50 text-red-800'}`}>
          {result.ok ? (
            <>
              <p className="font-medium text-brand-900">
                Senha definida para <strong className="select-all">{result.email}</strong>
              </p>
              <p className="mt-1">
                Senha: <strong className="select-all">{result.password}</strong>
              </p>
              {result.emailSent ? (
                <p className="mt-2 text-brand-700">✓ Email enviado com os dados de acesso.</p>
              ) : (
                <p className="mt-2 text-brand-800">
                  {result.emailError ?? 'Email não enviado — entregue a senha pessoalmente.'}
                </p>
              )}
            </>
          ) : (
            <p>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
