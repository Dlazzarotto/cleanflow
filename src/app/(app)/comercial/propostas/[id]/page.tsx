import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { SEGMENT_LABEL, SEGMENT_ICON } from '@/lib/commercial';
import {
  updateCommercialEstimateAction,
  approveCommercialEstimateAction,
} from '@/lib/actions/commercial';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function tempo(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

const FREQ_LABEL: Record<string, string> = {
  diaria: 'Diária (5x por semana)',
  tres_semana: '3x por semana',
  duas_semana: '2x por semana',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  unica: 'Serviço único',
};

export default async function PropostaPage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();

  const [{ data: p }, { data: itens }] = await Promise.all([
    supabase
      .from('commercial_estimates')
      .select('*, clients(full_name, phone, email)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('commercial_estimate_items')
      .select('*')
      .eq('estimate_id', params.id)
      .order('sort_order'),
  ]);

  if (!p) notFound();
  const lista = (itens ?? []) as any[];
  const areas = Array.from(new Set(lista.map((i) => i.area)));
  const valor = Number(p.final_monthly ?? p.price_monthly);

  return (
    <div className="max-w-3xl">
      <BackLink href="/comercial/propostas" label="Propostas" />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">
            {SEGMENT_ICON[p.segment] ?? '🏢'} {p.clients?.full_name ?? p.lead_name}
          </h1>
          <p className="text-brand-800">
            {SEGMENT_LABEL[p.segment]?.replace(/^\S+\s/, '') ?? p.segment}
            {p.address ? ` · ${p.address}` : ''}
            {p.area_sqft ? ` · ${Number(p.area_sqft).toLocaleString('pt-BR')} sq ft` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-brand-900">{usd(valor)}</p>
          <p className="text-sm text-brand-800">por mês</p>
        </div>
      </div>

      {/* Resumo do cálculo */}
      <div className="card mb-4">
        <p className="mb-3 text-xl font-semibold text-brand-900">Como chegamos a este valor</p>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Tempo por visita', tempo(Number(p.total_minutes))],
            ['Frequência', FREQ_LABEL[p.frequency] ?? p.frequency],
            ['Equipe', `${p.crew_size} pessoa(s)`],
            ['Valor da hora', usd(Number(p.hourly_rate))],
            ['Por visita', usd(Number(p.price_per_visit))],
            ['Visitas por mês', String(Number(p.visits_per_month).toFixed(1).replace('.0', ''))],
            ['Grau de sujeira', p.soil_level],
            ['Turno', p.night_shift ? '🌙 Noturno (+20%)' : 'Comercial'],
          ].map(([rotulo, v]) => (
            <div key={rotulo} className="rounded-card bg-brand-50 p-3">
              <p className="text-xs text-brand-800">{rotulo}</p>
              <p className="font-bold text-brand-900">{v}</p>
            </div>
          ))}
        </div>
        {p.supplies_included && (
          <p className="mt-3 text-sm text-brand-800">🧴 Produtos e materiais inclusos no valor.</p>
        )}
      </div>

      {/* Itens */}
      <div className="card mb-4">
        <p className="mb-3 text-xl font-semibold text-brand-900">
          O que está incluído ({lista.length} itens)
        </p>
        {areas.map((area) => (
          <div key={area} className="mb-4">
            <p className="mb-2 font-semibold text-brand-800">{area}</p>
            <div className="space-y-1">
              {lista
                .filter((i) => i.area === area)
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-brand-100 px-3 py-2"
                  >
                    <span className="text-brand-900">
                      {i.item}
                      <span className="ml-2 text-sm text-brand-800">
                        {Number(i.qty).toLocaleString('pt-BR')} {i.unit === 'sqft' ? 'sq ft' : i.unit}
                        {Number(i.soil_multiplier) !== 1 &&
                          ` · ${Number(i.soil_multiplier) > 1 ? 'pesado' : 'leve'}`}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-brand-700">
                      {tempo(Number(i.minutes))}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ajustes e situação */}
      <form action={updateCommercialEstimateAction} className="card mb-4 space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <p className="text-xl font-semibold text-brand-900">Fechar a proposta</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="final_monthly">
              Valor final combinado (USD/mês)
            </label>
            <input
              className="input"
              id="final_monthly"
              name="final_monthly"
              type="number"
              min={0}
              step={50}
              defaultValue={p.final_monthly ?? ''}
              placeholder={String(Math.round(Number(p.price_monthly)))}
            />
            <p className="mt-1 text-sm text-brand-800">
              Deixe vazio para usar o calculado ({usd(Number(p.price_monthly))}).
            </p>
          </div>
          <div>
            <label className="label" htmlFor="status">Situação</label>
            <select className="input" id="status" name="status" defaultValue={p.status}>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviada ao cliente</option>
              <option value="aprovado">Aprovada</option>
              <option value="recusado">Recusada</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">Observações</label>
          <textarea
            className="input"
            id="notes"
            name="notes"
            rows={3}
            defaultValue={p.notes ?? ''}
          />
        </div>

        <button className="btn-primary" type="submit">Salvar</button>
      </form>

      <div className="card">
        <p className="mb-3 font-semibold text-brand-900">Ações</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/proposta/${p.public_token}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            📄 Ver proposta do cliente
          </a>
          {p.status !== 'aprovado' && p.client_id && (
            <form action={approveCommercialEstimateAction.bind(null, p.id)}>
              <button className="btn-primary" type="submit">
                ✓ Aprovar e virar contrato
              </button>
            </form>
          )}
        </div>
        {p.status !== 'aprovado' && !p.client_id && (
          <p className="mt-2 text-sm text-brand-800">
            Para virar contrato, primeiro cadastre a empresa como cliente comercial e vincule a
            proposta a ela.
          </p>
        )}
      </div>
    </div>
  );
}
