'use client';
import { useState } from 'react';

export interface AnaliseItem {
  id: string;
  qty: number;
  sujeira: string;
  motivo: string;
}

export interface Analise {
  itens: AnaliseItem[];
  area_estimada_sqft: number | null;
  observacoes: string;
  alerta: string | null;
}

/**
 * A pessoa fotografa o local e a IA identifica o que precisa ser limpo,
 * o grau de sujeira e uma estimativa de área.
 */
export default function PhotoAnalyzer({
  segment,
  catalogo,
  aoAplicar,
}: {
  segment: string;
  catalogo: Array<{ id: string; area: string; item: string; unit: string }>;
  aoAplicar: (a: Analise) => void;
}) {
  const [fotos, setFotos] = useState<File[]>([]);
  const [previas, setPrevias] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [erro, setErro] = useState('');

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []).slice(0, 6);
    setFotos(arquivos);
    setPrevias(arquivos.map((f) => URL.createObjectURL(f)));
    setAnalise(null);
    setErro('');
  }

  async function paraBase64(f: File): Promise<{ media_type: string; data: string }> {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        const resultado = String(leitor.result);
        resolve({
          media_type: f.type || 'image/jpeg',
          data: resultado.split(',')[1],
        });
      };
      leitor.onerror = () => reject(new Error('falha ao ler a imagem'));
      leitor.readAsDataURL(f);
    });
  }

  async function analisar() {
    if (fotos.length === 0) {
      setErro('Escolha ao menos uma foto.');
      return;
    }
    setAnalisando(true);
    setErro('');
    try {
      const imagens = await Promise.all(fotos.map(paraBase64));
      const res = await fetch('/api/comercial/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, catalogo, fotos: imagens }),
      });
      const data = await res.json();
      if (data.ok) setAnalise(data);
      else setErro(data.error ?? 'Não foi possível analisar.');
    } catch {
      setErro('Não foi possível analisar agora.');
    } finally {
      setAnalisando(false);
    }
  }

  const nomePorId = new Map(catalogo.map((c) => [c.id, `${c.area} — ${c.item}`]));

  return (
    <div className="card border-2 border-aqua-500">
      <p className="text-xl font-semibold text-brand-900">📸 Analisar por foto</p>
      <p className="mb-3 text-brand-800">
        Fotografe os ambientes e a inteligência artificial identifica o que precisa ser limpo, o
        grau de sujeira e o tamanho aproximado. Use como apoio — você confere e ajusta.
      </p>

      <input
        className="input !py-2"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={escolher}
      />

      {previas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previas.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`Foto ${i + 1}`}
              className="h-20 w-20 rounded-card border border-brand-100 object-cover"
            />
          ))}
        </div>
      )}

      {fotos.length > 0 && !analise && (
        <button
          className="btn-primary mt-3 w-full"
          type="button"
          onClick={analisar}
          disabled={analisando}
        >
          {analisando ? '🔍 Analisando as fotos…' : `🤖 Analisar ${fotos.length} foto(s)`}
        </button>
      )}

      {erro && <p className="mt-3 rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}

      {analise && (
        <div className="mt-4 space-y-3">
          <div className="rounded-card bg-brand-50 p-3">
            <p className="font-semibold text-brand-900">O que a análise encontrou</p>
            <p className="mt-1 text-brand-900">{analise.observacoes}</p>
            {analise.area_estimada_sqft && (
              <p className="mt-2 text-brand-800">
                📐 Área estimada:{' '}
                <strong>{Number(analise.area_estimada_sqft).toLocaleString('pt-BR')} sq ft</strong>
              </p>
            )}
          </div>

          {analise.alerta && (
            <div className="rounded-card border-2 border-sun p-3">
              <p className="font-semibold text-brand-900">⚠️ Atenção no preço</p>
              <p className="mt-1 text-brand-900">{analise.alerta}</p>
            </div>
          )}

          {analise.itens.length > 0 && (
            <div>
              <p className="mb-2 font-semibold text-brand-900">
                {analise.itens.length} item(ns) identificado(s)
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {analise.itens.map((i, idx) => (
                  <div key={idx} className="rounded-card border border-brand-100 px-3 py-2">
                    <p className="font-medium text-brand-900">
                      {nomePorId.get(i.id) ?? i.id}
                      <span className="ml-2 text-sm font-normal text-brand-800">
                        {i.qty} · {i.sujeira}
                      </span>
                    </p>
                    {i.motivo && <p className="text-sm text-brand-800">{i.motivo}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary grow"
              type="button"
              onClick={() => aoAplicar(analise)}
            >
              ✓ Aplicar no orçamento
            </button>
            <button className="btn-ghost" type="button" onClick={() => setAnalise(null)}>
              Descartar
            </button>
          </div>
          <p className="text-sm text-brand-800">
            A análise preenche os itens marcados; você continua livre para ajustar tudo antes de
            fechar o preço.
          </p>
        </div>
      )}
    </div>
  );
}
