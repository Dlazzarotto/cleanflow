import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import {
  finishInspectionAction,
  reopenInspectionAction,
  deleteInspectionAction,
} from '@/lib/actions/inspections';
import InspectionItem, { type ResultItem } from '@/components/InspectionItem';
import SendInspectionButton from '@/components/SendInspectionButton';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

function corNota(p: number | null) {
  if (p === null) return 'bg-brand-100 text-brand-900';
  if (p >= 90) return 'bg-aqua-500 text-white';
  if (p >= 75) return 'bg-aqua-400 text-white';
  if (p >= 60) return 'bg-sun text-brand-900';
  return 'bg-red-700 text-white';
}

export default async function InspecaoPage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();

  const [{ data: inspecao }, { data: resultados }, { data: companyId }] = await Promise.all([
    supabase
      .from('inspections')
      .select('*, clients(full_name, address)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('inspection_results')
      .select('*')
      .eq('inspection_id', params.id)
      .order('sort_order'),
    supabase.rpc('current_company_id'),
  ]);

  if (!inspecao) notFound();
  const itens = (resultados ?? []) as ResultItem[];
  const emEdicao = inspecao.status === 'rascunho';

  // Links temporários das fotos (bucket privado)
  const urlFotos: Record<string, string> = {};
  for (const r of itens) {
    for (const caminho of r.photos ?? []) {
      const { data } = await supabase.storage.from('inspecoes').createSignedUrl(caminho, 3600);
      if (data?.signedUrl) urlFotos[caminho] = data.signedUrl;
    }
  }

  const avaliados = itens.filter((r) => r.na || r.rating !== null).length;
  const faltam = itens.length - avaliados;
  const percent = inspecao.percent !== null ? Number(inspecao.percent) : null;

  // Pontos que precisam de atenção
  const criticos = itens.filter((r) => !r.na && r.rating !== null && r.rating <= 2);

  // Agrupa por área
  const areas = Array.from(new Set(itens.map((r) => r.area)));

  return (
    <div className="max-w-3xl">
      <BackLink href="/inspecoes" label="Inspeções" />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">
            {inspecao.clients?.full_name ?? 'Inspeção'}
          </h1>
          <p className="text-brand-800">
            {inspecao.clients?.address ?? ''}
            {inspecao.clients?.address ? ' · ' : ''}
            {inspecao.inspector_name} ·{' '}
            {new Date(inspecao.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <span className={`rounded-card px-5 py-3 text-2xl font-bold ${corNota(percent)}`}>
          {percent !== null ? `${percent}%` : '—'}
        </span>
      </div>

      {emEdicao && (
        <div className="card mb-4">
          <p className="font-medium text-brand-900">
            {faltam === 0
              ? '✅ Todos os pontos avaliados. Pode concluir.'
              : `${avaliados} de ${itens.length} avaliados · faltam ${faltam}`}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full bg-brand-700 transition-all"
              style={{ width: `${itens.length > 0 ? (avaliados / itens.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {criticos.length > 0 && (
        <div className="card mb-4 border-2 border-red-700">
          <p className="font-semibold text-red-800">
            ⚠️ {criticos.length} ponto(s) precisam de correção
          </p>
          <ul className="mt-2 space-y-1 text-brand-900">
            {criticos.map((r) => (
              <li key={r.id}>
                • {r.area} — {r.item}
                {r.comment ? `: ${r.comment}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pontos por área */}
      <div className="space-y-5">
        {areas.map((area) => (
          <div key={area}>
            <p className="mb-2 text-lg font-semibold text-brand-900">{area}</p>
            <div className="space-y-2">
              {itens
                .filter((r) => r.area === area)
                .map((r) => (
                  <InspectionItem
                    key={r.id}
                    resultado={r}
                    companyId={(companyId as string) ?? ''}
                    somenteLeitura={!emEdicao}
                    urlFotos={urlFotos}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Fechamento */}
      <div className="card mt-6">
        {emEdicao ? (
          <form action={finishInspectionAction} className="space-y-3">
            <input type="hidden" name="id" value={inspecao.id} />
            <div>
              <label className="label" htmlFor="notes">Observações gerais (vão para o cliente)</label>
              <textarea
                className="input"
                id="notes"
                name="notes"
                rows={3}
                defaultValue={inspecao.notes ?? ''}
                placeholder="Ex: equipe atendeu bem o combinado. Ajustar a limpeza do box do banheiro social."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="submit">✓ Concluir inspeção</button>
              <form action={deleteInspectionAction.bind(null, inspecao.id)}>
                <button className="btn-ghost !border-red-700 !text-red-700" type="submit">
                  Descartar
                </button>
              </form>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {inspecao.notes && (
              <p className="rounded-card bg-brand-50 p-3 text-brand-900">{inspecao.notes}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/inspecao/${inspecao.public_token}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                🔗 Ver relatório do cliente
              </a>
              <SendInspectionButton
                inspectionId={inspecao.id}
                jaEnviada={inspecao.status === 'enviada'}
              />
              <form action={reopenInspectionAction.bind(null, inspecao.id)}>
                <button className="btn-ghost" type="submit">Reabrir para corrigir</button>
              </form>
            </div>
            {inspecao.sent_at && (
              <p className="text-sm text-brand-800">
                Enviada ao cliente em{' '}
                {new Date(inspecao.sent_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
