import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const NOTA_TEXTO: Record<number, string> = {
  5: 'Ótimo',
  4: 'Bom',
  3: 'Regular',
  2: 'Ruim',
  1: 'Falhou',
};

function corNota(p: number | null) {
  if (p === null) return 'bg-brand-100 text-brand-900';
  if (p >= 90) return 'bg-aqua-500 text-white';
  if (p >= 75) return 'bg-aqua-400 text-white';
  if (p >= 60) return 'bg-sun text-brand-900';
  return 'bg-red-700 text-white';
}

/** Relatório público da inspeção — o cliente abre pelo link, sem login. */
export default async function RelatorioInspecaoPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const [{ data: cabecalho }, { data: pontos }] = await Promise.all([
    supabase.rpc('get_inspection_by_token', { p_token: params.token }),
    supabase.rpc('get_inspection_results_by_token', { p_token: params.token }),
  ]);

  const insp = Array.isArray(cabecalho) ? cabecalho[0] : null;
  if (!insp) notFound();

  const itens = (pontos ?? []) as any[];
  const percent = insp.percent !== null ? Number(insp.percent) : null;

  // Links temporários das fotos
  const urlFotos: Record<string, string> = {};
  for (const p of itens) {
    for (const caminho of p.photos ?? []) {
      const { data } = await supabase.storage.from('inspecoes').createSignedUrl(caminho, 3600);
      if (data?.signedUrl) urlFotos[caminho] = data.signedUrl;
    }
  }

  const areas = Array.from(new Set(itens.map((p) => p.area)));
  const atencao = itens.filter((p) => !p.na && p.rating !== null && p.rating <= 2);

  return (
    <main className="mx-auto max-w-3xl p-5 md:p-8">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="card print:border-0 print:shadow-none">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <div>
            <p className="text-2xl font-bold text-brand-900">{insp.company_name}</p>
            <p className="text-brand-800">
              {[insp.company_phone, insp.company_email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-brand-700">RELATÓRIO DE INSPEÇÃO</p>
            <p className="text-sm text-brand-800">Nº {insp.numero}</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-semibold text-brand-800">Local inspecionado</p>
            <p className="text-xl font-bold text-brand-900">{insp.client_name}</p>
            {insp.address && <p className="text-brand-800">{insp.address}</p>}
            <p className="mt-2 text-sm text-brand-800">
              Inspecionado por {insp.inspector_name}
              {insp.finished_at &&
                ` em ${new Date(insp.finished_at).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-brand-800">Nota geral</p>
            <span
              className={`mt-1 inline-block rounded-card px-6 py-3 text-4xl font-bold ${corNota(percent)}`}
            >
              {percent !== null ? `${percent}%` : '—'}
            </span>
            <p className="mt-1 text-sm text-brand-800">
              {insp.score} de {insp.max_score} pontos
            </p>
          </div>
        </div>

        {insp.notes && (
          <div className="mb-6 rounded-card bg-brand-50 p-4">
            <p className="font-semibold text-brand-900">Observações da supervisão</p>
            <p className="mt-1 text-brand-900">{insp.notes}</p>
          </div>
        )}

        {atencao.length > 0 && (
          <div className="mb-6 rounded-card border-2 border-sun p-4">
            <p className="font-semibold text-brand-900">
              Pontos que serão corrigidos ({atencao.length})
            </p>
            <ul className="mt-2 space-y-1 text-brand-900">
              {atencao.map((p, i) => (
                <li key={i}>
                  • {p.area} — {p.item}
                  {p.comment ? `: ${p.comment}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detalhe por área */}
        {areas.map((area) => (
          <div key={area} className="mb-5">
            <p className="mb-2 text-lg font-semibold text-brand-900">{area}</p>
            <div className="space-y-2">
              {itens
                .filter((p) => p.area === area)
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-card border border-brand-100 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-brand-900">{p.item}</p>
                      {p.comment && <p className="text-sm text-brand-800">{p.comment}</p>}
                      {(p.photos ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.photos.map((caminho: string) => {
                            const url = urlFotos[caminho];
                            if (!url) return null;
                            return (
                              <a key={caminho} href={url} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt="Foto da inspeção"
                                  className="h-24 w-24 rounded-card border border-brand-100 object-cover"
                                />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        p.na
                          ? 'bg-brand-50 text-brand-800'
                          : p.rating >= 4
                            ? 'bg-aqua-500 text-white'
                            : p.rating === 3
                              ? 'bg-sun text-brand-900'
                              : 'bg-red-700 text-white'
                      }`}
                    >
                      {p.na ? 'N/A' : NOTA_TEXTO[p.rating] ?? '—'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <p className="mt-6 border-t border-brand-100 pt-4 text-center text-sm text-brand-800">
          Este relatório é gerado automaticamente pelo sistema de qualidade da {insp.company_name}.
          Dúvidas? {[insp.company_phone, insp.company_email].filter(Boolean).join(' · ')}
        </p>
      </div>
    </main>
  );
}
