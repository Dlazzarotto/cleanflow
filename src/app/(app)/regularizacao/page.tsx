import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { PAYMENT_LABEL, CONTRACT_LABEL } from '@/lib/billing';
import { quickUpdateClientBillingAction } from '@/lib/actions';
import { PAYMENT_METHODS, CONTRACT_STATUS } from '@/lib/billing';
import type { Client } from '@/lib/types';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

function usd(n: number | null) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function RegularizacaoPage() {
  await requireManager();
  const supabase = createClient();

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('status', 'ativo')
    .order('full_name');
  const clients = (data ?? []) as Client[];

  const faltaAlgo = (c: any) =>
    !c.payment_method || c.default_price == null || c.contract_status === 'pendente';

  const pendentes = clients.filter(faltaAlgo);
  const completos = clients.length - pendentes.length;

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">✅ Regularização de clientes</h1>
      <p className="mb-6 text-brand-800">
        Clientes ativos que ainda não estão no formato novo: sem forma de pagamento definida, sem
        valor combinado ou sem contrato. Preencha aqui mesmo, um por um — leva menos de um minuto
        cada.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-brand-800">Clientes ativos</p>
          <p className="text-3xl font-bold">{clients.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Já regularizados</p>
          <p className="text-3xl font-bold text-brand-700">{completos}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Faltando algo</p>
          <p className="text-3xl font-bold text-sun">{pendentes.length}</p>
        </div>
      </div>

      {pendentes.length === 0 ? (
        <div className="card text-brand-800">
          🎉 Todos os clientes ativos estão com forma de pagamento, valor e contrato definidos.
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.map((c: any) => (
            <form key={c.id} action={quickUpdateClientBillingAction} className="card">
              <input type="hidden" name="id" value={c.id} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/clientes/${c.id}`} className="text-xl font-semibold text-brand-900 hover:underline">
                    {c.full_name}
                  </Link>
                  <p className="text-brand-800">{c.address ?? 'Sem endereço'}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {!c.payment_method && (
                    <span className="rounded-full bg-sun/20 px-3 py-1 font-medium text-brand-900">
                      sem forma de pagamento
                    </span>
                  )}
                  {c.default_price == null && (
                    <span className="rounded-full bg-sun/20 px-3 py-1 font-medium text-brand-900">
                      sem valor
                    </span>
                  )}
                  {c.contract_status === 'pendente' && (
                    <span className="rounded-full bg-sun/20 px-3 py-1 font-medium text-brand-900">
                      sem contrato
                    </span>
                  )}
                </div>
              </div>

              {c.preferences && (
                <p className="mb-3 rounded-card bg-brand-50 p-2 text-sm text-brand-800">
                  📋 {c.preferences}
                </p>
              )}

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="label" htmlFor={`pm-${c.id}`}>Forma de pagamento</label>
                  <select className="input" id={`pm-${c.id}`} name="payment_method" defaultValue={c.payment_method ?? ''}>
                    <option value="">Definir</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`vp-${c.id}`}>Valor por limpeza</label>
                  <input
                    className="input"
                    id={`vp-${c.id}`}
                    name="default_price"
                    type="number"
                    min={0}
                    step={5}
                    defaultValue={c.default_price ?? ''}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`ct-${c.id}`}>Contrato</label>
                  <select className="input" id={`ct-${c.id}`} name="contract_status" defaultValue={c.contract_status}>
                    {CONTRACT_STATUS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="btn-primary w-full" type="submit">Salvar</button>
                </div>
              </div>
            </form>
          ))}
        </div>
      )}

      {completos > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-xl font-semibold text-brand-900">Já regularizados</h2>
          <div className="card space-y-2">
            {clients
              .filter((c: any) => !faltaAlgo(c))
              .map((c: any) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 pb-2 last:border-0">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-brand-900 hover:underline">
                    {c.full_name}
                  </Link>
                  <span className="text-sm text-brand-800">
                    {usd(c.default_price)} · {PAYMENT_LABEL[c.payment_method] ?? '—'} ·{' '}
                    {CONTRACT_LABEL[c.contract_status]}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
