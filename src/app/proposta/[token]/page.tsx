import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SEGMENT_LABEL } from '@/lib/commercial';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

const FREQ: Record<string, string> = {
  diaria: 'Diária — 5x por semana',
  tres_semana: '3x por semana',
  duas_semana: '2x por semana',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  unica: 'Serviço único',
};

/** Proposta comercial que o cliente abre pelo link. */
export default async function PropostaPublicaPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const [{ data: cab }, { data: itens }] = await Promise.all([
    supabase.rpc('get_commercial_estimate', { p_token: params.token }),
    supabase.rpc('get_commercial_estimate_items', { p_token: params.token }),
  ]);

  const p = Array.isArray(cab) ? cab[0] : null;
  if (!p) notFound();

  const lista = (itens ?? []) as any[];
  const areas = Array.from(new Set(lista.map((i) => i.area)));
  const valor = Number(p.final_monthly ?? p.price_monthly);
  const horas = Number(p.total_minutes) / 60;

  return (
    <main className="mx-auto max-w-3xl p-5 md:p-8">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="card print:border-0 print:shadow-none">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <div>
            <p className="text-2xl font-bold text-brand-900">{p.company_name}</p>
            <p className="text-brand-800">
              {[p.company_phone, p.company_email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-brand-700">PROPOSTA DE SERVIÇO</p>
            <p className="text-sm text-brand-800">
              {new Date(p.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Para quem */}
        <div className="mb-6">
          <p className="font-semibold text-brand-800">Proposta para</p>
          <p className="text-2xl font-bold text-brand-900">{p.client_name}</p>
          {p.address && <p className="text-brand-800">{p.address}</p>}
          <p className="text-brand-800">
            {SEGMENT_LABEL[p.segment]?.replace(/^\S+\s/, '') ?? p.segment}
          </p>
        </div>

        {/* Valor */}
        <div className="mb-6 rounded-card bg-brand-900 p-6 text-center text-white">
          <p className="text-brand-100">Investimento mensal</p>
          <p className="text-5xl font-bold text-aqua-400">{usd(valor)}</p>
          <p className="mt-2 text-brand-100">
            {FREQ[p.frequency] ?? p.frequency} ·{' '}
            {Number(p.visits_per_month).toFixed(1).replace('.0', '')} visitas por mês
          </p>
          <p className="text-sm text-brand-100">
            Equipe de {p.crew_size} pessoa(s) · cerca de {horas.toFixed(1)}h por visita
          </p>
        </div>

        {/* Escopo */}
        <p className="mb-3 text-xl font-semibold text-brand-900">O que está incluído</p>
        <div className="mb-6 space-y-4">
          {areas.map((area) => (
            <div key={area}>
              <p className="mb-2 font-semibold text-brand-800">{area}</p>
              <ul className="space-y-1">
                {lista
                  .filter((i) => i.area === area)
                  .map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-brand-900">
                      <span className="text-aqua-500">✓</span>
                      <span>
                        {i.item}
                        {Number(i.qty) > 1 && (
                          <span className="text-sm text-brand-800">
                            {' '}
                            ({Number(i.qty).toLocaleString('pt-BR')}{' '}
                            {i.unit === 'sqft' ? 'sq ft' : i.unit})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        {p.notes && (
          <div className="mb-6 rounded-card bg-brand-50 p-4">
            <p className="font-semibold text-brand-900">Observações</p>
            <p className="mt-1 whitespace-pre-line text-brand-900">{p.notes}</p>
          </div>
        )}

        <div className="border-t border-brand-100 pt-4 text-center">
          <p className="text-brand-800">
            Proposta válida por 30 dias. Para aceitar ou tirar dúvidas, fale conosco:
          </p>
          <p className="mt-1 font-semibold text-brand-900">
            {[p.company_phone, p.company_email].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </main>
  );
}
