import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { markInvoicePaidAction, setInvoiceStatusAction, refreshOverdueAction } from '@/lib/actions/invoices';
import { PAYMENT_METHODS, PAYMENT_LABEL } from '@/lib/billing';
import SendInvoiceButton from '@/components/SendInvoiceButton';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  aberta: { label: 'Em aberto', cls: 'bg-brand-100 text-brand-900' },
  vencida: { label: 'Vencida', cls: 'bg-red-700 text-white' },
  paga: { label: 'Paga ✓', cls: 'bg-aqua-500 text-white' },
  cancelada: { label: 'Cancelada', cls: 'bg-brand-50 text-brand-800' },
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireManager();
  await refreshOverdueAction();

  const filtro = ['aberta', 'vencida', 'paga', 'todas'].includes(searchParams.status ?? '')
    ? searchParams.status!
    : 'aberta';

  const supabase = createClient();
  let query = supabase
    .from('invoices')
    .select('*, clients(full_name, email, payment_method), bookings(scheduled_at)')
    .order('number', { ascending: false })
    .limit(150);
  if (filtro === 'aberta') query = query.in('status', ['aberta', 'vencida']);
  else if (filtro !== 'todas') query = query.eq('status', filtro);

  const [{ data }, { data: todas }] = await Promise.all([
    query,
    supabase.from('invoices').select('status, amount'),
  ]);
  const invoices = data ?? [];
  const all = todas ?? [];

  const aReceber = all
    .filter((i: any) => i.status === 'aberta' || i.status === 'vencida')
    .reduce((s: number, i: any) => s + Number(i.amount), 0);
  const vencidas = all.filter((i: any) => i.status === 'vencida');
  const recebido = all
    .filter((i: any) => i.status === 'paga')
    .reduce((s: number, i: any) => s + Number(i.amount), 0);

  const conta = (s: string) =>
    s === 'todas'
      ? all.length
      : s === 'aberta'
        ? all.filter((i: any) => i.status === 'aberta' || i.status === 'vencida').length
        : all.filter((i: any) => i.status === s).length;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-brand-900">🧾 Faturas</h1>
      <p className="mb-6 text-brand-800">
        Cada limpeza concluída gera a fatura automaticamente. Envie ao cliente por email e dê baixa
        quando o pagamento entrar — a equipe não precisa lidar com dinheiro ou cheque.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-brand-800">A receber</p>
          <p className="text-3xl font-bold text-brand-900">{usd(aReceber)}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Vencidas</p>
          <p className="text-3xl font-bold text-red-700">{vencidas.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Já recebido</p>
          <p className="text-3xl font-bold text-brand-700">{usd(recebido)}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {['aberta', 'vencida', 'paga', 'todas'].map((s) => (
          <Link
            key={s}
            href={`/faturas?status=${s}`}
            className={`flex min-h-touch items-center rounded-card border px-4 py-2 font-medium ${
              filtro === s
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            {s === 'todas' ? 'Todas' : s === 'aberta' ? 'Em aberto' : STATUS[s].label} ({conta(s)})
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="card text-brand-800">
          Nenhuma fatura neste filtro. As faturas nascem quando a equipe faz o check-out de uma
          limpeza com valor definido.
        </div>
      ) : (
        <div className="space-y-3">
          {(invoices as any[]).map((inv) => (
            <div key={inv.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">
                    #{inv.number} · {inv.clients?.full_name ?? 'Cliente'}
                  </p>
                  <p className="text-brand-800">
                    {inv.bookings?.scheduled_at
                      ? `Limpeza de ${new Date(inv.bookings.scheduled_at).toLocaleDateString('pt-BR')}`
                      : 'Sem limpeza vinculada'}
                    {inv.due_at && ` · vence ${new Date(inv.due_at + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS[inv.status].cls}`}>
                      {STATUS[inv.status].label}
                    </span>
                    {inv.sent_at && (
                      <span className="text-sm text-brand-800">
                        ✉️ enviada {new Date(inv.sent_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {!inv.clients?.email && (
                      <span className="rounded-full bg-sun/20 px-3 py-1 text-sm font-medium text-brand-900">
                        cliente sem email
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-3xl font-bold text-brand-900">{usd(inv.amount)}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
                <a
                  href={`/fatura/${inv.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  🔗 Ver fatura
                </a>
                {inv.status !== 'paga' && inv.status !== 'cancelada' && (
                  <>
                    <SendInvoiceButton invoiceId={inv.id} alreadySent={Boolean(inv.sent_at)} />
                    <form action={markInvoicePaidAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={inv.id} />
                      <select
                        className="input !w-44"
                        name="paid_method"
                        defaultValue={inv.clients?.payment_method ?? ''}
                        aria-label="Forma de pagamento"
                      >
                        <option value="">Como recebeu</option>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                      <button className="btn-primary" type="submit">✓ Recebido</button>
                    </form>
                    <form action={setInvoiceStatusAction.bind(null, inv.id, 'cancelada')}>
                      <button className="btn-ghost" type="submit">Cancelar</button>
                    </form>
                  </>
                )}
                {inv.status === 'paga' && (
                  <>
                    <span className="text-brand-800">
                      Recebido {inv.paid_method ? `via ${PAYMENT_LABEL[inv.paid_method] ?? inv.paid_method}` : ''}
                      {inv.paid_at && ` em ${new Date(inv.paid_at).toLocaleDateString('pt-BR')}`}
                    </span>
                    <form action={setInvoiceStatusAction.bind(null, inv.id, 'aberta')}>
                      <button className="btn-ghost" type="submit">Desfazer baixa</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
