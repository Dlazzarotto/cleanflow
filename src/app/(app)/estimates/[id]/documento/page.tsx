import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatMinutes, FREQUENCY_LABEL } from '@/lib/pricing';
import { buildServiceList } from '@/lib/estimate-view';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function EstimateDocumentoPage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const [{ data: estimate }, { data: company }] = await Promise.all([
    supabase.from('estimates').select('*, clients(full_name, phone, email, address)').eq('id', params.id).single(),
    supabase.from('companies').select('name, phone, email, address').limit(1).single(),
  ]);
  if (!estimate) notFound();

  const e = estimate as any;
  const sections = buildServiceList(e);
  const clientName = e.clients?.full_name ?? e.lead_name ?? 'Cliente';
  const clientAddress = e.address ?? e.clients?.address ?? '';
  const validade = new Date(new Date(e.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-brand-900">Documento do estimate</h1>
        <PrintButton />
      </div>

      <div className="card print:border-0 print:p-0 print:shadow-none">
        {/* Cabecalho */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <div>
            <p className="text-3xl font-bold text-brand-900">{company?.name ?? 'Empresa de Limpeza'}</p>
            {company?.address && <p className="text-brand-800">{company.address}</p>}
            <p className="text-brand-800">
              {[company?.phone, company?.email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-700">ESTIMATE</p>
            <p className="text-brand-800">
              Data: {new Date(e.created_at).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-brand-800">
              Válido até: {validade.toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-6">
          <p className="font-semibold text-brand-800">Preparado para:</p>
          <p className="text-xl font-bold">{clientName}</p>
          {clientAddress && <p className="text-brand-800">{clientAddress}</p>}
          {(e.clients?.phone ?? e.lead_phone) && <p className="text-brand-800">{e.clients?.phone ?? e.lead_phone}</p>}
        </div>

        {/* Servicos */}
        <div className="mb-6">
          <p className="mb-3 text-xl font-semibold text-brand-900">Serviços incluídos</p>
          <div className="space-y-4">
            {sections.map((s) => (
              <div key={s.title}>
                <p className="font-semibold text-brand-800">{s.title}</p>
                <ul className="ml-5 list-disc text-ink">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="mb-6 rounded-card bg-brand-50 p-5 print:border print:border-brand-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-brand-800">Frequência</p>
              <p className="font-semibold">{FREQUENCY_LABEL[e.frequency] ?? 'A definir'}</p>
            </div>
            <div>
              <p className="text-brand-800">Tempo estimado por visita</p>
              <p className="font-semibold">{formatMinutes(e.minutes)}</p>
            </div>
            <div className="text-right">
              <p className="text-brand-800">Investimento por limpeza</p>
              <p className="text-3xl font-bold text-brand-900">
                {e.final_price ? usd(e.final_price) : `${usd(e.price_low)} – ${usd(e.price_high)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Condicoes */}
        <div className="text-sm text-brand-800">
          <p className="mb-1 font-semibold">Condições:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Este estimate cobre exclusivamente os serviços listados acima.</li>
            <li>
              Serviços adicionais não listados devem ser solicitados à empresa e passarão por um
              novo estimate — a equipe em campo não está autorizada a aceitar serviços extras.
            </li>
            <li>Valores válidos por 30 dias a partir da data de emissão.</li>
            <li>O tempo estimado pode variar conforme as condições do imóvel na primeira visita.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
