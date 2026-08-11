'use client';
import { useState } from 'react';
import CameraMeasure, { type ParedeMedida } from '@/components/CameraMeasure';

export interface Comodo {
  id: string;
  nome: string;
  comprimento: number;
  largura: number;
}

/**
 * Calculadora de área por cômodo.
 * A pessoa mede com trena ou por passos e o sistema soma tudo em sq ft.
 */
export default function AreaCalculator({
  aberto,
  aoFechar,
  aoAplicar,
  areaInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoAplicar: (total: number, comodos: Comodo[]) => void;
  areaInicial?: Comodo[];
}) {
  const [comodos, setComodos] = useState<Comodo[]>(
    areaInicial && areaInicial.length > 0
      ? areaInicial
      : [{ id: '1', nome: '', comprimento: 0, largura: 0 }]
  );
  const [unidade, setUnidade] = useState<'pes' | 'metros' | 'passos'>('pes');
  const [cameraAberta, setCameraAberta] = useState(false);

  /** As paredes medidas viram comprimento e largura dos ambientes. */
  function aplicarParedes(paredes: ParedeMedida[]) {
    if (paredes.length === 0) return;
    setUnidade('pes');
    const novos: Comodo[] = [];
    for (let i = 0; i < paredes.length; i += 2) {
      const a = paredes[i];
      const b = paredes[i + 1];
      novos.push({
        id: `cam-${a.id}`,
        nome: `Ambiente ${novos.length + 1}`,
        comprimento: a.pes,
        largura: b ? b.pes : a.pes,
      });
    }
    setComodos((prev) => {
      const comDados = prev.filter((c) => c.comprimento && c.largura);
      return [...comDados, ...novos];
    });
  }

  // Converte a medida informada para pés
  function paraPes(v: number) {
    if (unidade === 'metros') return v * 3.28084;
    if (unidade === 'passos') return v * 2.5; // passo adulto ≈ 2,5 pés
    return v;
  }

  const total = comodos.reduce(
    (s, c) => s + paraPes(c.comprimento) * paraPes(c.largura),
    0
  );

  function adicionar() {
    setComodos((prev) => [
      ...prev,
      { id: String(Date.now()), nome: '', comprimento: 0, largura: 0 },
    ]);
  }

  function remover(id: string) {
    setComodos((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }

  function alterar(id: string, campo: keyof Comodo, valor: string | number) {
    setComodos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c))
    );
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-5">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-card bg-white p-5 md:rounded-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-brand-900">📐 Medir a área</p>
            <p className="text-brand-800">
              Meça cada ambiente e o sistema soma tudo. Preço mais justo, sem chute.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-2xl text-brand-800 hover:bg-brand-50"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <CameraMeasure
          aberto={cameraAberta}
          aoFechar={() => setCameraAberta(false)}
          aoConcluir={aplicarParedes}
        />

        {/* Medir com a câmera */}
        <div className="mb-4 rounded-card border-2 border-aqua-500 p-4">
          <p className="font-semibold text-brand-900">📷 Medir apontando a câmera</p>
          <p className="mt-1 text-sm text-brand-800">
            Aponte para o chão e toque nas pontas de cada parede — o sistema calcula sozinho.
            Precisa de <strong>celular ou tablet com câmera</strong>.
          </p>
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            onClick={() => setCameraAberta(true)}
          >
            📷 Abrir a câmera
          </button>
          <p className="mt-2 text-center text-sm text-brand-800">
            ou preencha as medidas abaixo
          </p>
        </div>

        {/* Unidade */}
        <div className="mb-4">
          <p className="label">Como você está medindo</p>
          <div className="flex flex-wrap gap-2">
            {[
              { chave: 'pes' as const, rotulo: '📏 Pés (feet)', dica: 'trena americana' },
              { chave: 'metros' as const, rotulo: '📐 Metros', dica: 'trena métrica' },
              { chave: 'passos' as const, rotulo: '👣 Passos', dica: '1 passo ≈ 2,5 pés' },
            ].map((u) => (
              <button
                key={u.chave}
                type="button"
                onClick={() => setUnidade(u.chave)}
                className={`min-h-touch rounded-card border-2 px-4 py-2 text-left ${
                  unidade === u.chave
                    ? 'border-brand-700 bg-brand-50'
                    : 'border-brand-100 bg-white'
                }`}
              >
                <span className="block font-semibold text-brand-900">{u.rotulo}</span>
                <span className="block text-xs text-brand-800">{u.dica}</span>
              </button>
            ))}
          </div>
          {unidade === 'passos' && (
            <p className="mt-2 rounded-card bg-brand-50 p-2 text-sm text-brand-800">
              💡 Caminhe contando os passos ao longo da parede. É uma medida aproximada, mas
              suficiente para orçar.
            </p>
          )}
        </div>

        {/* Cômodos */}
        <div className="space-y-2">
          {comodos.map((c, i) => {
            const area = paraPes(c.comprimento) * paraPes(c.largura);
            return (
              <div key={c.id} className="rounded-card border border-brand-100 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-32 grow">
                    <label className="label" htmlFor={`n-${c.id}`}>Ambiente</label>
                    <input
                      className="input"
                      id={`n-${c.id}`}
                      value={c.nome}
                      onChange={(e) => alterar(c.id, 'nome', e.target.value)}
                      placeholder={`Ex: ${['Salão', 'Cozinha', 'Banheiro', 'Estoque'][i % 4]}`}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`c-${c.id}`}>Comprimento</label>
                    <input
                      className="input !w-24"
                      id={`c-${c.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.comprimento || ''}
                      onChange={(e) => alterar(c.id, 'comprimento', Number(e.target.value))}
                    />
                  </div>
                  <span className="pb-3 text-brand-800">×</span>
                  <div>
                    <label className="label" htmlFor={`l-${c.id}`}>Largura</label>
                    <input
                      className="input !w-24"
                      id={`l-${c.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.largura || ''}
                      onChange={(e) => alterar(c.id, 'largura', Number(e.target.value))}
                    />
                  </div>
                  <div className="pb-1">
                    <span className="block text-xs text-brand-800">área</span>
                    <span className="font-bold text-brand-900">
                      {area > 0 ? `${Math.round(area)} sq ft` : '—'}
                    </span>
                  </div>
                  {comodos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remover(c.id)}
                      className="mb-1 flex h-10 w-10 items-center justify-center rounded-card text-red-700 hover:bg-red-50"
                      aria-label="Remover ambiente"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="btn-ghost mt-3 w-full" onClick={adicionar}>
          + Adicionar ambiente
        </button>

        {/* Total */}
        <div className="mt-4 rounded-card bg-brand-900 p-4 text-center text-white">
          <p className="text-brand-100">Área total</p>
          <p className="text-4xl font-bold text-aqua-400">
            {Math.round(total).toLocaleString('pt-BR')} sq ft
          </p>
          <p className="text-sm text-brand-100">
            {(total / 10.764).toFixed(0)} m² · {comodos.filter((c) => c.comprimento && c.largura).length} ambiente(s)
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary grow"
            onClick={() => {
              aoAplicar(Math.round(total), comodos);
              aoFechar();
            }}
            disabled={total <= 0}
          >
            Usar {Math.round(total).toLocaleString('pt-BR')} sq ft no orçamento
          </button>
          <button type="button" className="btn-ghost" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
