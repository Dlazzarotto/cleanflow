'use client';
import { useState } from 'react';

export interface Mercado {
  hourly_low: number;
  hourly_high: number;
  sqft_low: number | null;
  sqft_high: number | null;
  monthly_low: number | null;
  monthly_high: number | null;
  resumo: string;
  cached?: boolean;
}

/**
 * Compara o preço calculado com o que a região cobra para aquele
 * tipo de comércio — a referência acompanha o serviço orçado.
 */
export default function CommercialMarketCheck({
  segment,
  endereco,
  precoMensal,
  precoVisita,
  minutos,
  areaSqft,
  frequency,
}: {
  segment: string;
  endereco: string;
  precoMensal: number;
  precoVisita: number;
  minutos: number;
  areaSqft: number | null;
  frequency: string;
}) {
  const [cidade, setCidade] = useState(() => {
    // Tenta extrair a cidade do endereço: "Rua X, Boston, MA"
    const partes = endereco.split(',').map((p) => p.trim());
    return partes.length >= 2 ? partes.slice(1).join(', ') : endereco;
  });
  const [pesquisando, setPesquisando] = useState(false);
  const [mercado, setMercado] = useState<Mercado | null>(null);
  const [erro, setErro] = useState('');

  async function pesquisar() {
    if (!cidade.trim()) {
      setErro('Informe a cidade para pesquisar.');
      return;
    }
    setPesquisando(true);
    setErro('');
    try {
      const res = await fetch('/api/comercial/mercado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment,
          city: cidade,
          area_sqft: areaSqft,
          frequency,
        }),
      });
      const data = await res.json();
      if (data.ok) setMercado(data);
      else setErro(data.error ?? 'Não foi possível pesquisar.');
    } catch {
      setErro('Não foi possível pesquisar agora.');
    } finally {
      setPesquisando(false);
    }
  }

  function usd(n: number, decimais = 0) {
    return Number(n).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: decimais,
      minimumFractionDigits: decimais,
    });
  }

  // A referência da região aplicada A ESTE serviço
  const horas = minutos / 60;
  const refVisitaBaixa = mercado ? mercado.hourly_low * horas : 0;
  const refVisitaAlta = mercado ? mercado.hourly_high * horas : 0;

  const posicao = !mercado
    ? null
    : precoVisita < refVisitaBaixa
      ? {
          texto: 'abaixo da região',
          cls: 'text-sun',
          dica: 'Há espaço para subir o preço sem perder o cliente.',
        }
      : precoVisita > refVisitaAlta
        ? {
            texto: 'acima da região',
            cls: 'text-red-700',
            dica: 'Justifique o diferencial na proposta: equipe fixa, produtos, seguro.',
          }
        : { texto: 'dentro da região', cls: 'text-brand-700', dica: 'Preço competitivo.' };

  const diferenca = !mercado
    ? 0
    : precoVisita < refVisitaBaixa
      ? Math.round(((refVisitaBaixa - precoVisita) / refVisitaBaixa) * 100)
      : precoVisita > refVisitaAlta
        ? Math.round(((precoVisita - refVisitaAlta) / refVisitaAlta) * 100)
        : 0;

  return (
    <div className="card">
      <p className="text-xl font-semibold text-brand-900">🔍 Quanto a região cobra</p>
      <p className="mb-3 text-brand-800">
        Compare seu preço com o que outras empresas cobram para este tipo de comércio na sua área.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 grow">
          <label className="label" htmlFor="cidade-mercado">Cidade / região</label>
          <input
            className="input"
            id="cidade-mercado"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Boston, MA"
          />
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={pesquisar}
          disabled={pesquisando || minutos <= 0}
        >
          {pesquisando ? '🔍 Pesquisando…' : mercado ? '🔄 Pesquisar de novo' : '🔍 Pesquisar'}
        </button>
      </div>

      {minutos <= 0 && (
        <p className="mt-2 text-sm text-brand-800">
          Marque os itens do serviço antes de comparar — a referência é calculada sobre o tempo.
        </p>
      )}

      {erro && <p className="mt-3 rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}

      {mercado && posicao && (
        <div className="mt-4 space-y-3">
          <div className="rounded-card bg-brand-50 p-4">
            <p className="text-sm text-brand-800">
              Para um serviço de {Math.floor(horas)}h
              {Math.round(minutos % 60) > 0 ? ` ${Math.round(minutos % 60)}min` : ''}, a região
              cobra por visita
            </p>
            <p className="text-3xl font-bold text-brand-900">
              {usd(refVisitaBaixa)} – {usd(refVisitaAlta)}
            </p>
            <p className={`mt-1 font-medium ${posicao.cls}`}>
              Seu preço de {usd(precoVisita)} está {posicao.texto}
              {diferenca > 0 ? ` (${diferenca}%)` : ''}
            </p>
            <p className="text-sm text-brand-800">{posicao.dica}</p>
          </div>

          {mercado.monthly_low && mercado.monthly_high && (
            <div className="rounded-card bg-brand-50 p-4">
              <p className="text-sm text-brand-800">
                Contratos mensais deste tipo de comércio na região
              </p>
              <p className="text-2xl font-bold text-brand-900">
                {usd(mercado.monthly_low)} – {usd(mercado.monthly_high)}
              </p>
              <p className="mt-1 text-sm text-brand-800">
                Seu mensal: <strong>{usd(precoMensal)}</strong>
              </p>
            </div>
          )}

          {areaSqft && mercado.sqft_low && mercado.sqft_high && (
            <div className="rounded-card bg-brand-50 p-3 text-sm text-brand-900">
              Por metragem, a região cobra {usd(mercado.sqft_low, 2)} – {usd(mercado.sqft_high, 2)}{' '}
              por sq ft por visita. Nos seus {areaSqft.toLocaleString('pt-BR')} sq ft, daria{' '}
              <strong>
                {usd(mercado.sqft_low * areaSqft)} – {usd(mercado.sqft_high * areaSqft)}
              </strong>{' '}
              por visita.
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              Ver a análise da região
            </summary>
            <div className="mt-2 space-y-1 text-brand-900">
              <p>{mercado.resumo}</p>
              <p className="text-sm text-brand-800">
                Valor da hora praticado: {usd(mercado.hourly_low)} – {usd(mercado.hourly_high)}
                {mercado.cached && ' · pesquisa em cache (até 30 dias)'}
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
