'use client';
import { useState } from 'react';
import { switchCompanyAction } from '@/lib/actions';

export interface CompanyOption {
  id: string;
  name: string;
  role: string;
}

const PAPEL: Record<string, string> = {
  owner: 'Dono(a)',
  admin: 'Administrador(a)',
  supervisor: 'Supervisor(a)',
  marketing: 'Marketing',
  cleaner: 'Equipe',
};

/**
 * Aparece só para quem atende mais de uma empresa (ex: agência de marketing
 * que trabalha para várias empresas de limpeza).
 */
export default function CompanySwitcher({
  empresas,
  atual,
}: {
  empresas: CompanyOption[];
  atual: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState('');

  if (empresas.length < 2) return null;
  const ativa = empresas.find((e) => e.id === atual);

  async function trocar(id: string) {
    if (id === atual) {
      setAberto(false);
      return;
    }
    setTrocando(id);
    try {
      await switchCompanyAction(id);
    } catch {
      setTrocando('');
    }
  }

  return (
    <div className="mx-5 mb-3">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex min-h-touch w-full items-center justify-between gap-2 rounded-card border border-brand-100/40 px-3 py-2 text-left text-white hover:bg-brand-900"
      >
        <span className="min-w-0">
          <span className="block text-xs text-brand-100">Você está em</span>
          <span className="block truncate font-semibold">{ativa?.name ?? 'Empresa'}</span>
        </span>
        <span className="text-brand-100">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="mt-2 space-y-1 rounded-card bg-white p-2">
          {empresas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => trocar(e.id)}
              disabled={Boolean(trocando)}
              className={`flex min-h-touch w-full items-center justify-between gap-2 rounded-card px-3 py-2 text-left ${
                e.id === atual ? 'bg-brand-50 font-semibold text-brand-900' : 'hover:bg-brand-50'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-brand-900">{e.name}</span>
                <span className="block text-xs text-brand-800">{PAPEL[e.role] ?? e.role}</span>
              </span>
              {trocando === e.id ? (
                <span className="text-sm text-brand-800">trocando…</span>
              ) : e.id === atual ? (
                <span className="text-brand-700">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
