import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { INVOICE_I18N } from '@/lib/i18n/invoice';
import { normalizeLang } from '@/lib/i18n/documents';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const DATE_LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-US', fr: 'fr-FR' };

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function FaturaPublicaPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const [{ data }, { data: itemRows }] = await Promise.all([
    supabase.rpc('get_invoice_by_token', { p_token: params.token }),
    supabase.rpc('get_invoice_items_by_token', { p_token: params.token }),
  ]);
  const inv = Array.isArray(data) ? data[0] : null;
  if (!inv) notFound();
  const items = (itemRows ?? []) as { description: string; amount: number }[];

  const lang = normalizeLang(inv.client_language);
  const t = INVOICE_I18N[lang];
  const locale = DATE_LOCALE[lang];

  const statusLabel =
    inv.status === 'paga'
      ? t.statusPaid
      : inv.status === 'vencida'
        ? t.statusOverdue
        : inv.status === 'cancelada'
          ? t.statusCancelled
          : t.statusOpen;

  const statusCls =
    inv.status === 'paga'
      ? 'bg-aqua-500 text-white'
      : inv.status === 'vencida'
        ? 'bg-red-700 text-white'
        : 'bg-brand-100 text-brand-900';

  return (
    <main className="mx-auto max-w-2xl p-5 md:p-8">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="card print:border-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <div>
            <p className="text-2xl font-bold text-brand-900">{inv.company_name}</p>
            {inv.company_address && <p className="text-brand-800">{inv.company_address}</p>}
            <p className="text-brand-800">
              {[inv.company_phone, inv.company_email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-700">{t.title}</p>
            <p className="text-brand-800">{t.number} {inv.number}</p>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusCls}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-semibold text-brand-800">{t.billTo}</p>
            <p className="text-xl font-bold">{inv.client_name}</p>
            {inv.address && <p className="text-brand-800">{inv.address}</p>}
          </div>
          <div className="md:text-right">
            <p className="text-brand-800">
              {t.issued}: {new Date(inv.issued_at).toLocaleDateString(locale)}
            </p>
            {inv.due_at && (
              <p className="text-brand-800">
                {t.due}: {new Date(inv.due_at + 'T12:00:00').toLocaleDateString(locale)}
              </p>
            )}
            {inv.paid_at && (
              <p className="font-medium text-brand-700">
                {t.paidOn} {new Date(inv.paid_at).toLocaleDateString(locale)}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-card border border-brand-100">
          {items.length > 0 ? (
            items.map((it, i) => (
              <div key={i} className="flex items-center justify-between border-b border-brand-100 p-4">
                <div>
                  <p className="font-semibold">{it.description}</p>
                  {i === 0 && inv.service_date && (
                    <p className="text-sm text-brand-800">
                      {t.serviceDate}: {new Date(inv.service_date).toLocaleDateString(locale)}
                    </p>
                  )}
                </div>
                <p className="text-xl font-semibold">{usd(it.amount)}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between border-b border-brand-100 p-4">
              <div>
                <p className="font-semibold">{t.service}</p>
                {inv.service_date && (
                  <p className="text-sm text-brand-800">
                    {t.serviceDate}: {new Date(inv.service_date).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
              <p className="text-xl font-semibold">{usd(inv.amount)}</p>
            </div>
          )}
          <div className="flex items-center justify-between bg-brand-50 p-4">
            <p className="text-xl font-bold text-brand-900">{t.total}</p>
            <p className="text-3xl font-bold text-brand-900">{usd(inv.amount)}</p>
          </div>
        </div>

        {inv.status !== 'paga' && inv.status !== 'cancelada' && (
          <div className="mb-6">
            <p className="mb-2 text-xl font-semibold text-brand-900">{t.howToPay}</p>
            {inv.payment_instructions ? (
              <p className="whitespace-pre-line rounded-card bg-brand-50 p-4">
                {inv.payment_instructions}
              </p>
            ) : (
              <p className="rounded-card bg-brand-50 p-4 text-brand-800">
                {t.questions} {[inv.company_phone, inv.company_email].filter(Boolean).join(' · ')}
              </p>
            )}
            <button
              className="btn-primary mt-3 w-full opacity-50 print:hidden"
              type="button"
              disabled
              title={t.payOnlineSoon}
            >
              💳 {t.payOnline} — {t.payOnlineSoon}
            </button>
          </div>
        )}

        <p className="text-center text-brand-800">{t.thanks}</p>
      </div>
    </main>
  );
}
