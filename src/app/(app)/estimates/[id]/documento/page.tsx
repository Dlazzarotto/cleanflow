import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { buildServiceList } from '@/lib/estimate-view';
import { ESTIMATE_I18N, FREQ, normalizeLang } from '@/lib/i18n/documents';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const DATE_LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-US', fr: 'fr-FR' };

export default async function EstimateDocumentoPage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const [{ data: estimate }, { data: company }] = await Promise.all([
    supabase.from('estimates').select('*, clients(full_name, phone, email, address, language)').eq('id', params.id).single(),
    supabase.from('companies').select('name, phone, email, address').limit(1).single(),
  ]);
  if (!estimate) notFound();

  const e = estimate as any;
  const lang = normalizeLang(e.language ?? e.clients?.language);
  const t = ESTIMATE_I18N[lang];
  const locale = DATE_LOCALE[lang];
  const sections = buildServiceList(e, lang);
  const clientName = e.clients?.full_name ?? e.lead_name ?? '—';
  const clientAddress = e.address ?? e.clients?.address ?? '';
  const validade = new Date(new Date(e.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-brand-900">Documento do estimate ({lang.toUpperCase()})</h1>
        <PrintButton />
      </div>

      <div className="card print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <div>
            <p className="text-3xl font-bold text-brand-900">{company?.name ?? '—'}</p>
            {company?.address && <p className="text-brand-800">{company.address}</p>}
            <p className="text-brand-800">{[company?.phone, company?.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-700">{t.title}</p>
            <p className="text-brand-800">{t.date}: {new Date(e.created_at).toLocaleDateString(locale)}</p>
            <p className="text-brand-800">{t.validUntil}: {validade.toLocaleDateString(locale)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="font-semibold text-brand-800">{t.preparedFor}</p>
          <p className="text-xl font-bold">{clientName}</p>
          {clientAddress && <p className="text-brand-800">{clientAddress}</p>}
          {(e.clients?.phone ?? e.lead_phone) && <p className="text-brand-800">{e.clients?.phone ?? e.lead_phone}</p>}
        </div>

        <div className="mb-6">
          <p className="mb-3 text-xl font-semibold text-brand-900">{t.services}</p>
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

        <div className="mb-6 rounded-card bg-brand-50 p-5 print:border print:border-brand-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-brand-800">{t.frequency}</p>
              <p className="font-semibold">{FREQ[lang][e.frequency] ?? FREQ[lang].indef}</p>
            </div>
            <div className="text-right">
              <p className="text-brand-800">{t.investment}</p>
              <p className="text-3xl font-bold text-brand-900">
                {e.final_price ? usd(e.final_price) : `${usd(e.price_low)} – ${usd(e.price_high)}`}
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-brand-800">
          <p className="mb-1 font-semibold">{t.conditionsTitle}</p>
          <ul className="ml-5 list-disc space-y-1">
            {t.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
