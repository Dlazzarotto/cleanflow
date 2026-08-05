'use client';
import { useState } from 'react';
import Link from 'next/link';

export interface AgendaItem {
  id: string;
  hora: string;          // HH:MM
  minutoInicio: number;  // minutos desde a meia-noite
  duracao: number;
  cliente: string;
  endereco: string | null;
  equipe: string | null;
  cor: string;
  status: string;
  statusRotulo: string;
  valor: string | null;
  tipo: string | null;
}

const CORES_STATUS: Record<string, string> = {
  agendado: 'bg-brand-100 text-brand-900',
  a_caminho: 'bg-sun/30 text-brand-900',
  em_andamento: 'bg-aqua-400 text-white',
  concluido: 'bg-aqua-500 text-white',
  sem_acesso: 'bg-red-700 text-white',
  cancelado: 'bg-brand-50 text-brand-800 line-through',
};

/** Faixa de horas mostrada na régua. */
const HORA_INICIO = 7;
const HORA_FIM = 19;

export default function DayAgenda({ itens, dataLabel }: { itens: AgendaItem[]; dataLabel: string }) {
  const [selecionado, setSelecionado] = useState<AgendaItem | null>(null);

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);
  const totalMin = (HORA_FIM - HORA_INICIO) * 60;

  // Posição de cada limpeza na régua
  function posicao(item: AgendaItem) {
    const inicio = Math.max(item.minutoInicio - HORA_INICIO * 60, 0);
    const topo = (inicio / totalMin) * 100;
    const altura = Math.max((item.duracao / totalMin) * 100, 4);
    return { top: `${topo}%`, height: `${Math.min(altura, 100 - topo)}%` };
  }

  // Agora, para a linha do tempo atual
  const agora = new Date();
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes();
  const mostrarAgora = minutoAgora >= HORA_INICIO * 60 && minutoAgora <= HORA_FIM * 60;
  const topoAgora = ((minutoAgora - HORA_INICIO * 60) / totalMin) * 100;

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xl font-semibold text-brand-900">Agenda de hoje</p>
          <p className="text-sm text-brand-800">{dataLabel}</p>
        </div>
        <Link href="/calendario" className="btn-ghost">🗓️ Calendário completo</Link>
      </div>

      {itens.length === 0 ? (
        <p className="py-8 text-center text-brand-800">Nenhuma limpeza agendada para hoje.</p>
      ) : (
        <div className="flex gap-2">
          {/* Régua de horas */}
          <div className="relative w-12 shrink-0" style={{ height: 420 }}>
            {horas.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-xs text-brand-800"
                style={{ top: `${(i / (horas.length - 1)) * 100}%` }}
              >
                {String(h).padStart(2, '0')}h
              </div>
            ))}
          </div>

          {/* Faixa com as limpezas */}
          <div className="relative flex-1 rounded-card bg-brand-50" style={{ height: 420 }}>
            {horas.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-brand-100"
                style={{ top: `${(i / (horas.length - 1)) * 100}%` }}
              />
            ))}

            {mostrarAgora && (
              <div
                className="absolute left-0 right-0 z-10 border-t-2 border-red-600"
                style={{ top: `${topoAgora}%` }}
              >
                <span className="absolute -top-2 left-1 h-3 w-3 rounded-full bg-red-600" />
              </div>
            )}

            {itens.map((item) => {
              const pos = posicao(item);
              const ativo = selecionado?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelecionado(ativo ? null : item)}
                  className={`absolute left-1 right-1 overflow-hidden rounded-card px-2 py-1 text-left text-xs transition ${
                    ativo ? 'z-20 ring-2 ring-brand-900' : 'hover:brightness-95'
                  } ${CORES_STATUS[item.status] ?? CORES_STATUS.agendado}`}
                  style={{ ...pos, borderLeft: `4px solid ${item.cor}` }}
                >
                  <span className="block truncate font-semibold">
                    {item.hora} · {item.cliente}
                  </span>
                  {parseFloat(pos.height) > 8 && (
                    <span className="block truncate opacity-90">
                      {item.equipe ?? 'sem equipe'}
                      {item.tipo ? ` · ${item.tipo}` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detalhe ao tocar */}
      {selecionado && (
        <div className="mt-3 rounded-card border-2 border-brand-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold text-brand-900">{selecionado.cliente}</p>
              <p className="text-brand-800">
                {selecionado.hora} · {Math.floor(selecionado.duracao / 60)}h
                {selecionado.duracao % 60 > 0 ? ` ${selecionado.duracao % 60}min` : ''}
                {selecionado.equipe ? ` · ${selecionado.equipe}` : ''}
              </p>
              {selecionado.endereco && (
                <p className="text-sm text-brand-800">{selecionado.endereco}</p>
              )}
            </div>
            <div className="text-right">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  CORES_STATUS[selecionado.status] ?? CORES_STATUS.agendado
                }`}
              >
                {selecionado.statusRotulo}
              </span>
              {selecionado.valor && (
                <p className="mt-1 text-xl font-bold text-brand-900">{selecionado.valor}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/calendario?abrir=${selecionado.id}`}
              className="btn-primary"
            >
              ✏️ Editar
            </Link>
            {selecionado.endereco && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selecionado.endereco)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                📍 Ver no mapa
              </a>
            )}
            <button className="btn-ghost" type="button" onClick={() => setSelecionado(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
