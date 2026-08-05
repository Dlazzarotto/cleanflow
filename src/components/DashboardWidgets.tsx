'use client';
import { useState } from 'react';
import Link from 'next/link';

export interface WidgetItem {
  id: string;
  titulo: string;
  detalhe: string;
  valor?: string;
  destaque?: 'ok' | 'alerta' | 'neutro';
  href?: string;
}

export interface Widget {
  chave: string;
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: 'destaque' | 'alerta' | 'ok' | 'neutro';
  itens: WidgetItem[];
  vazio: string;
  verTudo?: { href: string; texto: string };
}

const CORES: Record<string, string> = {
  destaque: 'text-brand-900',
  alerta: 'text-red-700',
  ok: 'text-brand-700',
  neutro: 'text-brand-900',
};

const BADGE: Record<string, string> = {
  ok: 'bg-aqua-500 text-white',
  alerta: 'bg-red-700 text-white',
  neutro: 'bg-brand-100 text-brand-900',
};

export default function DashboardWidgets({ widgets }: { widgets: Widget[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const atual = widgets.find((w) => w.chave === aberto);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {widgets.map((w) => {
          const ativo = aberto === w.chave;
          return (
            <button
              key={w.chave}
              type="button"
              onClick={() => setAberto(ativo ? null : w.chave)}
              className={`card text-left transition ${
                ativo ? 'border-brand-700 ring-2 ring-brand-700/20' : 'hover:border-aqua-500'
              }`}
            >
              <p className="text-sm text-brand-800">{w.rotulo}</p>
              <p className={`text-3xl font-bold ${CORES[w.cor ?? 'neutro']}`}>{w.valor}</p>
              <p className="mt-1 text-xs text-brand-800">
                {w.nota ?? `${w.itens.length} item(ns)`}
                <span className="ml-1 text-brand-700">{ativo ? '▲' : '▼'}</span>
              </p>
            </button>
          );
        })}
      </div>

      {atual && (
        <div className="card mt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xl font-semibold text-brand-900">{atual.rotulo}</p>
            <div className="flex gap-2">
              {atual.verTudo && (
                <Link href={atual.verTudo.href} className="btn-ghost">
                  {atual.verTudo.texto}
                </Link>
              )}
              <button className="btn-ghost" type="button" onClick={() => setAberto(null)}>
                Fechar
              </button>
            </div>
          </div>

          {atual.itens.length === 0 ? (
            <p className="text-brand-800">{atual.vazio}</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {atual.itens.map((i) => {
                const conteudo = (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-brand-100 px-3 py-2">
                    <div>
                      <p className="font-medium text-brand-900">{i.titulo}</p>
                      <p className="text-sm text-brand-800">{i.detalhe}</p>
                    </div>
                    {i.valor && (
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          BADGE[i.destaque ?? 'neutro']
                        }`}
                      >
                        {i.valor}
                      </span>
                    )}
                  </div>
                );
                return i.href ? (
                  <Link key={i.id} href={i.href} className="block hover:opacity-80">
                    {conteudo}
                  </Link>
                ) : (
                  <div key={i.id}>{conteudo}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
