'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { rateItemAction } from '@/lib/actions/inspections';

export interface ResultItem {
  id: string;
  area: string;
  item: string;
  rating: number | null;
  na: boolean;
  comment: string | null;
  photos: string[];
}

const NOTAS = [
  { valor: 5, rotulo: 'Ótimo', cor: 'bg-aqua-500 text-white' },
  { valor: 4, rotulo: 'Bom', cor: 'bg-aqua-400 text-white' },
  { valor: 3, rotulo: 'Regular', cor: 'bg-sun text-brand-900' },
  { valor: 2, rotulo: 'Ruim', cor: 'bg-orange-500 text-white' },
  { valor: 1, rotulo: 'Falhou', cor: 'bg-red-700 text-white' },
];

export default function InspectionItem({
  resultado,
  companyId,
  somenteLeitura = false,
  urlFotos,
}: {
  resultado: ResultItem;
  companyId: string;
  somenteLeitura?: boolean;
  urlFotos: Record<string, string>;
}) {
  const router = useRouter();
  const [nota, setNota] = useState<number | null>(resultado.rating);
  const [na, setNa] = useState(resultado.na);
  const [comentario, setComentario] = useState(resultado.comment ?? '');
  const [fotos, setFotos] = useState<string[]>(resultado.photos ?? []);
  const [novasUrls, setNovasUrls] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);

  async function salvar(novaNota: number | null, novoNa: boolean, novasFotos = fotos) {
    setSalvando(true);
    setErro('');
    const res = await rateItemAction({
      result_id: resultado.id,
      rating: novaNota,
      na: novoNa,
      comment: comentario || null,
      photos: novasFotos,
    });
    if (!res.ok) setErro(res.error ?? 'Não foi possível salvar.');
    else router.refresh();
    setSalvando(false);
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    setSalvando(true);
    setErro('');
    try {
      const supabase = createClient();
      const caminhos: string[] = [...fotos];
      const urls: Record<string, string> = { ...novasUrls };

      for (const arquivo of arquivos.slice(0, 4)) {
        const ext = arquivo.name.split('.').pop() || 'jpg';
        const caminho = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(-6)}.${ext}`;
        const { error } = await supabase.storage.from('inspecoes').upload(caminho, arquivo);
        if (error) {
          setErro(`Não foi possível enviar a foto: ${error.message}`);
          setSalvando(false);
          return;
        }
        caminhos.push(caminho);
        urls[caminho] = URL.createObjectURL(arquivo);
      }

      setFotos(caminhos);
      setNovasUrls(urls);
      await salvar(nota, na, caminhos);
    } catch {
      setErro('Não foi possível enviar a foto.');
      setSalvando(false);
    }
  }

  const avaliado = na || nota !== null;
  const corBorda = na
    ? 'border-brand-100'
    : nota === null
      ? 'border-brand-100'
      : nota >= 4
        ? 'border-aqua-500'
        : nota === 3
          ? 'border-sun'
          : 'border-red-700';

  return (
    <div className={`rounded-card border-2 bg-white p-3 ${corBorda}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-brand-900">{resultado.item}</p>
          <p className="text-sm text-brand-800">{resultado.area}</p>
        </div>
        {avaliado && (
          <span className="text-sm text-brand-800">
            {na ? 'não se aplica' : `${nota}/5`}
          </span>
        )}
      </div>

      {!somenteLeitura && (
        <>
          <div className="mt-3 flex flex-wrap gap-1">
            {NOTAS.map((n) => (
              <button
                key={n.valor}
                type="button"
                disabled={salvando}
                onClick={() => {
                  setNota(n.valor);
                  setNa(false);
                  salvar(n.valor, false);
                }}
                className={`min-h-touch rounded-card px-3 py-2 text-sm font-medium ${
                  nota === n.valor && !na ? n.cor : 'bg-brand-50 text-brand-800'
                }`}
              >
                {n.rotulo}
              </button>
            ))}
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                setNa(!na);
                setNota(null);
                salvar(null, !na);
              }}
              className={`min-h-touch rounded-card px-3 py-2 text-sm font-medium ${
                na ? 'bg-brand-900 text-white' : 'bg-brand-50 text-brand-800'
              }`}
            >
              N/A
            </button>
          </div>

          <button
            type="button"
            className="mt-2 text-sm font-medium text-brand-700"
            onClick={() => setAberto(!aberto)}
          >
            {aberto ? '− fechar' : '+ observação e foto'}
            {(comentario || fotos.length > 0) && !aberto && (
              <span className="ml-1 text-brand-800">
                ({fotos.length > 0 ? `${fotos.length} foto(s)` : 'com observação'})
              </span>
            )}
          </button>

          {aberto && (
            <div className="mt-2 space-y-2">
              <textarea
                className="input"
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onBlur={() => salvar(nota, na)}
                placeholder="O que foi observado neste ponto"
              />
              <input
                className="input !py-2"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={enviarFoto}
                disabled={salvando}
              />
            </div>
          )}
        </>
      )}

      {somenteLeitura && comentario && (
        <p className="mt-2 rounded-card bg-brand-50 p-2 text-sm text-brand-900">{comentario}</p>
      )}

      {fotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {fotos.map((caminho) => {
            const url = novasUrls[caminho] ?? urlFotos[caminho];
            if (!url) return null;
            return (
              <a key={caminho} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Foto da inspeção"
                  className="h-20 w-20 rounded-card border border-brand-100 object-cover"
                />
              </a>
            );
          })}
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
