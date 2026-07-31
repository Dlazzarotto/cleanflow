'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TeamOption {
  id: string;
  name: string;
}

export default function InviteForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('cleaner');
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{
    message: string;
    temp_password?: string | null;
    emailSent?: boolean;
    emailError?: string | null;
  }>({ message: '' });

  async function invite() {
    if (!email.trim() || !fullName.trim()) {
      setState('error');
      setResult({ message: 'Preencha nome e email.' });
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/equipe/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          team_id: role === 'cleaner' || role === 'supervisor' ? teamId || undefined : undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setState('done');
        setResult({
          message: data.message,
          temp_password: data.temp_password,
          emailSent: data.email_sent,
          emailError: data.email_error,
        });
        setEmail('');
        setFullName('');
        setPassword('');
        router.refresh();
      } else {
        setState('error');
        setResult({ message: data.error ?? 'Falha no convite.' });
      }
    } catch {
      setState('error');
      setResult({ message: 'Falha no convite.' });
    }
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-xl font-semibold text-brand-900">➕ Dar acesso a uma pessoa</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="inv-name">Nome completo</label>
          <input className="input" id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="inv-email">Email (será o login)</label>
          <input className="input" id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="inv-role">Papel</label>
          <select className="input" id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="cleaner">Equipe de limpeza</option>
            <option value="marketing">Equipe de marketing</option>
            <option value="supervisor">Supervisor(a)</option>
            <option value="admin">Administrador(a)</option>
          </select>
        </div>
        {role !== 'marketing' && role !== 'admin' ? (
          <div>
            <label className="label" htmlFor="inv-team">Colocar na equipe de limpeza (opcional)</label>
            <select className="input" id="inv-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Nenhuma por enquanto</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-card bg-brand-50 p-3 text-sm text-brand-800 md:mt-7">
            {role === 'marketing'
              ? 'O time de marketing não entra em equipes de campo: cadastra leads e acompanha o funil, sem jornada nem check-in.'
              : 'Administradores não entram em equipes de campo.'}
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label" htmlFor="inv-pass">Senha inicial (opcional — se vazio, geramos uma)</label>
          <input className="input" id="inv-pass" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary mt-4" type="button" onClick={invite} disabled={state === 'sending'}>
        {state === 'sending' ? 'Criando acesso…' : 'Criar acesso'}
      </button>
      {result.message && (
        <div className={`mt-3 rounded-card p-4 ${state === 'error' ? 'bg-red-50 text-red-800' : 'bg-brand-50 text-brand-900'}`}>
          <p>{result.message}</p>
          {result.temp_password && (
            <p className="mt-2">
              Senha temporária: <strong className="select-all">{result.temp_password}</strong> — anote agora, ela não será mostrada de novo.
            </p>
          )}
          {result.emailSent && (
            <p className="mt-2 text-brand-700">✓ Email com os dados de acesso enviado.</p>
          )}
          {result.emailError && (
            <p className="mt-2 text-brand-800">⚠️ {result.emailError}</p>
          )}
        </div>
      )}
    </div>
  );
}
