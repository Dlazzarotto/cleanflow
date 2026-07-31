'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLANS, monthlyFee, maxTeams } from '@/lib/plans';

export default function NovaEmpresaPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<'standard' | 'plus'>('standard');
  const [extraTeams, setExtraTeams] = useState(0);
  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    owner_email: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    password: '',
    account_status: 'teste',
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; temp?: string | null } | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const fee = monthlyFee(plan, extraTeams);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan, extra_teams: extraTeams }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: data.message, temp: data.temp_password });
        router.refresh();
      } else {
        setResult({ ok: false, message: data.error ?? 'Falha ao criar.' });
      }
    } catch {
      setResult({ ok: false, message: 'Falha ao criar.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin" className="text-brand-700 underline">← Todas as empresas</Link>
      <h1 className="mb-6 mt-3 text-3xl font-bold text-brand-900">Nova empresa assinante</h1>

      <div className="card mb-6 space-y-4">
        <p className="text-xl font-semibold text-brand-900">Plano</p>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.values(PLANS).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPlan(p.key);
                if (p.key === 'standard') setExtraTeams(0);
              }}
              className={`rounded-card border-2 p-4 text-left ${
                plan === p.key ? 'border-brand-700 bg-brand-50' : 'border-brand-100 bg-white'
              }`}
            >
              <p className="text-xl font-bold text-brand-900">{p.name}</p>
              <p className="text-2xl font-bold text-brand-700">
                ${p.price}<span className="text-base font-medium text-brand-800">/mês</span>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-brand-800">
                {p.highlights.map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {plan === 'plus' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="extra">Equipes adicionais (US$ 10/mês cada)</label>
              <input
                className="input !w-32"
                id="extra"
                type="number"
                min={0}
                max={20}
                value={extraTeams}
                onChange={(e) => setExtraTeams(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
        )}

        <div className="rounded-card bg-brand-900 p-4 text-white">
          <p className="text-brand-100">Mensalidade</p>
          <p className="text-3xl font-bold text-aqua-400">${fee.toFixed(2)}/mês</p>
          <p className="text-sm text-brand-100">
            até {maxTeams(plan, extraTeams)} equipe(s) ativas
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-xl font-semibold text-brand-900">Dados da empresa</p>
        <div>
          <label className="label" htmlFor="name">Nome da empresa *</label>
          <input className="input" id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="owner_name">Responsável *</label>
            <input className="input" id="owner_name" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="owner_email">Email de acesso do responsável *</label>
            <input className="input" id="owner_email" type="email" value={form.owner_email} onChange={(e) => set('owner_email', e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefone da empresa</label>
            <input className="input" id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email da empresa</label>
            <input className="input" id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="website">Website</label>
            <input className="input" id="website" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="account_status">Situação inicial</label>
            <select className="input" id="account_status" value={form.account_status} onChange={(e) => set('account_status', e.target.value)}>
              <option value="teste">Em teste</option>
              <option value="ativa">Ativa</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="address">Endereço</label>
          <input className="input" id="address" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha inicial (opcional — geramos uma se vazio)</label>
          <input className="input" id="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
        </div>

        <button className="btn-primary w-full" type="button" onClick={submit} disabled={busy}>
          {busy ? 'Criando…' : 'Criar empresa e acesso'}
        </button>

        {result && (
          <div className={`rounded-card p-4 ${result.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-800'}`}>
            <p>{result.message}</p>
            {result.temp && (
              <p className="mt-2">
                Senha temporária: <strong className="select-all">{result.temp}</strong>
              </p>
            )}
            {result.ok && (
              <Link href="/admin" className="mt-3 inline-block font-semibold underline">
                Ver todas as empresas
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
