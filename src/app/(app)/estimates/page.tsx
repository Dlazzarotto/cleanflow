import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatMinutes } from '@/lib/pricing';
import EmailButton from '@/components/EmailButton';
import RecurrenceFromEstimate from '@/components/RecurrenceFromEstimate';
import {
import BackLink from '@/components/BackLink';
  getPricingSettings,
  savePricingSettingsAction,
  updateEstimateStatusAction,
  approveEstimateAction,
  convertEstimateToClientAction,
} from '@/lib/actions/estimates';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado ✓',
  recusado: 'Recusado',
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function EstimatesPage() {
  await requireManager();
  const supabase = createClient();
  const [{ data: estimates }, settings, { data: teamRows }] = await Promise.all([
    supabase
      .from('estimates')
      .select('*, clients(full_name)')
      .order('created_at', { ascending: false })
      .limit(50),
    getPricingSettings(),
    supabase.from('teams').select('id, name').eq('active', true).order('name'),
  ]);
  const teamOptions = (teamRows ?? []).map((t: any) => ({ id: t.id, name: t.name }));

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Estimates</h1>
        <Link href="/estimates/novo" className="btn-primary">+ Novo estimate</Link>
      </div>

      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold text-brand-900">
          ⚙️ Preços e regras do contrato — {usd(settings.hourly_rate)}/h · lockout {usd(settings.lockout_fee)} · aviso {settings.cancel_notice_hours}h
        </summary>
        <form action={savePricingSettingsAction} className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="hourly_rate">Tarifa por hora (USD)</label>
            <input className="input" id="hourly_rate" name="hourly_rate" type="number" min={20} step={1} defaultValue={settings.hourly_rate} />
          </div>
          <div>
            <label className="label" htmlFor="min_price">Preço mínimo (USD)</label>
            <input className="input" id="min_price" name="min_price" type="number" min={50} step={5} defaultValue={settings.min_price} />
          </div>
          <div>
            <label className="label" htmlFor="deep_multiplier">Multiplicador deep clean</label>
            <input className="input" id="deep_multiplier" name="deep_multiplier" type="number" min={1} max={3} step={0.1} defaultValue={settings.deep_multiplier} />
          </div>
          <div>
            <label className="label" htmlFor="cancel_notice_hours">Aviso de cancelamento (horas)</label>
            <input className="input" id="cancel_notice_hours" name="cancel_notice_hours" type="number" min={12} step={12} defaultValue={settings.cancel_notice_hours} />
          </div>
          <div>
            <label className="label" htmlFor="lockout_fee">Taxa de lockout (USD)</label>
            <input className="input" id="lockout_fee" name="lockout_fee" type="number" min={0} step={5} defaultValue={settings.lockout_fee} />
          </div>
          <div>
            <label className="label" htmlFor="termination_notice_days">Aviso de rescisão (dias)</label>
            <input className="input" id="termination_notice_days" name="termination_notice_days" type="number" min={7} step={1} defaultValue={settings.termination_notice_days} />
          </div>
          <div>
            <label className="label" htmlFor="solicitation_fee">Multa por aliciamento (USD)</label>
            <input className="input" id="solicitation_fee" name="solicitation_fee" type="number" min={0} step={100} defaultValue={settings.solicitation_fee} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Salvar</button>
          </div>
        </form>
      </details>

      {(!estimates || estimates.length === 0) ? (
        <div className="card text-brand-800">
          Nenhum estimate ainda.{' '}
          <Link href="/estimates/novo" className="font-semibold text-brand-700 underline">Criar o primeiro</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((e: any) => (
            <div key={e.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {e.clients?.full_name ?? e.lead_name ?? e.address ?? 'Lead sem cadastro'}
                    {!e.client_id && (
                      <span className="ml-2 rounded-full bg-sun/20 px-2 py-0.5 text-sm font-medium text-brand-900">
                        Lead
                      </span>
                    )}
                  </p>
                  <p className="text-brand-800">
                    {e.bedrooms} qt · {e.full_baths} ban{e.half_baths > 0 ? ` + ${e.half_baths} lavabo` : ''}
                    {e.laundry ? ' · 🧺 laundry' : ''}
                    {e.deep_clean ? ' · ✨ deep' : ''}
                    {' · '}{formatMinutes(e.minutes)}
                  </p>
                  <p className="text-xl font-bold text-brand-900">
                    {e.final_price ? `${usd(e.final_price)} (fechado)` : `${usd(e.price_low)} – ${usd(e.price_high)}`}
                  </p>
                  {e.market_notes && <p className="mt-1 max-w-xl text-sm text-brand-800">{e.market_notes}</p>}
                </div>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
                <Link href={`/estimates/${e.id}/documento`} className="btn-ghost">📄 Documento</Link>
                <Link href={`/estimates/${e.id}/editar`} className="btn-ghost">✏️ Editar</Link>
                <EmailButton estimateId={e.id} />
                {!e.client_id && (
                  <form action={convertEstimateToClientAction.bind(null, e.id)}>
                    <button className="btn-ghost" type="submit">➕ Transformar em cliente</button>
                  </form>
                )}
                {e.status === 'aprovado' && (
                  <Link href={`/estimates/${e.id}/contrato`} className="btn-ghost">📜 Contrato</Link>
                )}
                {e.status === 'aprovado' && e.client_id && (
                  <RecurrenceFromEstimate
                    estimateId={e.id}
                    frequency={e.frequency}
                    teams={teamOptions}
                    alreadyScheduled={Boolean(e.series_id)}
                  />
                )}
                {e.status === 'rascunho' && (
                  <form action={updateEstimateStatusAction.bind(null, e.id, 'enviado')}>
                    <button className="btn-ghost" type="submit">Marcar enviado</button>
                  </form>
                )}
                {e.status !== 'aprovado' && (
                  <form action={approveEstimateAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      className="input !w-32"
                      name="final_price"
                      type="number"
                      min={0}
                      step={5}
                      defaultValue={e.price_low}
                      aria-label="Preço fechado"
                    />
                    <button className="btn-primary" type="submit">Aprovar</button>
                  </form>
                )}
                {e.status !== 'recusado' && e.status !== 'aprovado' && (
                  <form action={updateEstimateStatusAction.bind(null, e.id, 'recusado')}>
                    <button className="btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50" type="submit">Recusar</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
