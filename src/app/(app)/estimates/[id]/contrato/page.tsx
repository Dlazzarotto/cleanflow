import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { formatMinutes } from '@/lib/pricing';
import { buildServiceList } from '@/lib/estimate-view';
import { getPricingSettings } from '@/lib/actions/estimates';
import { CONTRACT_I18N, FREQ, normalizeLang } from '@/lib/i18n/documents';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function ContratoPage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const [{ data: estimate }, { data: company }, settings] = await Promise.all([
    supabase.from('estimates').select('*, clients(full_name, phone, email, address, language)').eq('id', params.id).single(),
    supabase.from('companies').select('name, phone, email, address').limit(1).single(),
    getPricingSettings(),
  ]);
  if (!estimate) notFound();

  const e = estimate as any;
  const lang = normalizeLang(e.language ?? e.clients?.language);
  const t = CONTRACT_I18N[lang];
  const sections = buildServiceList(e, lang);

  const companyInfoParts = [company?.address, company?.phone, company?.email].filter(Boolean);
  const p = {
    companyName: company?.name ?? '—',
    companyInfo: companyInfoParts.length ? ` (${companyInfoParts.join(' · ')})` : '',
    clientName: e.clients?.full_name ?? e.lead_name ?? '____________________________',
    clientAddress: e.address ?? e.clients?.address ?? '____________________________',
    freq: (FREQ[lang][e.frequency] ?? FREQ[lang].indef).toLowerCase(),
    time: formatMinutes(e.minutes),
    price: e.final_price ? usd(e.final_price) : `${usd(e.price_low)} – ${usd(e.price_high)}`,
    cancelHours: settings.cancel_notice_hours,
    lockoutFee: usd(settings.lockout_fee),
    terminationDays: settings.termination_notice_days,
    solicitationFee: usd(settings.solicitation_fee),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-brand-900">Contrato ({lang.toUpperCase()})</h1>
        <PrintButton />
      </div>

      <div className="mb-4 rounded-card border border-sun bg-white p-4 text-brand-800 print:hidden">
        {t.disclaimer}
      </div>

      <div className="card space-y-5 print:border-0 print:p-0 print:shadow-none">
        <div className="border-b border-brand-100 pb-4 text-center">
          <p className="text-2xl font-bold text-brand-900">{t.title}</p>
        </div>

        <p>{t.preamble(p)}</p>

        {t.clauses.map((c) => (
          <div key={c.title}>
            <p className="font-bold text-brand-900">{c.title}</p>
            <p>{c.body(p)}</p>
          </div>
        ))}

        <div className="rounded-card bg-brand-50 p-5 print:border print:border-brand-100">
          <p className="mb-3 text-xl font-bold text-brand-900">{t.annexTitle}</p>
          <div className="space-y-3">
            {sections.map((s) => (
              <div key={s.title}>
                <p className="font-semibold text-brand-800">{s.title}</p>
                <ul className="ml-5 list-disc">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-10 pt-8 md:grid-cols-2">
          <div className="text-center">
            <div className="border-t border-ink pt-2">
              <p className="font-semibold">{p.companyName}</p>
              <p className="text-sm text-brand-800">{t.contractor} · {t.dateSig}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-ink pt-2">
              <p className="font-semibold">{p.clientName}</p>
              <p className="text-sm text-brand-800">{t.client} · {t.dateSig}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
