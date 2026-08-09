'use client';
import { useState } from 'react';
import { switchModeAction } from '@/lib/actions/mode';

/**
 * Troca entre o modo residencial e o comercial.
 * Só aparece para empresas que contrataram o módulo comercial.
 */
export default function ModeSwitcher({
  modo,
  temComercial,
}: {
  modo: 'residencial' | 'comercial';
  temComercial: boolean;
}) {
  const [trocando, setTrocando] = useState('');

  if (!temComercial) return null;

  async function trocar(novo: 'residencial' | 'comercial') {
    if (novo === modo) return;
    setTrocando(novo);
    try {
      await switchModeAction(novo);
    } catch {
      setTrocando('');
    }
  }

  const opcoes = [
    { chave: 'residencial' as const, rotulo: 'Residencial', icone: '🏠' },
    { chave: 'comercial' as const, rotulo: 'Comercial', icone: '🏢' },
  ];

  return (
    <div className="mx-5 mb-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-brand-100">Modo</p>
      <div className="flex rounded-card bg-brand-800 p-1">
        {opcoes.map((o) => {
          const ativo = modo === o.chave;
          return (
            <button
              key={o.chave}
              type="button"
              onClick={() => trocar(o.chave)}
              disabled={Boolean(trocando)}
              className={`flex-1 rounded-card px-2 py-2 text-sm font-semibold transition ${
                ativo ? 'bg-aqua-500 text-white' : 'text-brand-100 hover:bg-brand-900'
              }`}
            >
              {trocando === o.chave ? '…' : `${o.icone} ${o.rotulo}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
