import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { markInvoicePaidAction, setInvoiceStatusAction, refreshOverdueAction } from '@/lib/actions/invoices';
import { PAYMENT_METHODS, PAYMENT_LABEL } from '@/lib/billing';
import SendInvoiceButton from '@/components/SendInvoiceButton';
import {
  decideExtraAction,
  createExtraCatalogAction,
  updateExtraCatalogAction,
  createStandaloneInvoiceAction,
} from '@/lib/actions/extras';
import BackLink from '@/components/BackLink';

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

  const [{ data }, { data: todas }, { data: extrasPend }, { data: catalogo }, { data: clientesAtivos }] =
    await Promise.all([
      query,
      supabase.from('invoices').select('status, amount'),
      supabase
        .from('booking_extras')
        .select('*, bookings(scheduled_at, clients(full_name))')
        .eq('status', 'solicitado')
        .order('created_at', { ascending: false }),
      supabase.from('service_extras').select('*').order('name'),
      supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name'),
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
      <BackLink href="/dashboard" label="Dashboard" />
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

      {/* Extras aguardando preço */}
      {(extrasPend ?? []).length > 0 && (
        <div className="card mb-6 border-2 border-sun">
          <p className="mb-3 text-xl font-semibold text-brand-900">
            ➕ Serviços extras aguardando você definir o preço ({(extrasPend ?? []).length})
          </p>
          <div className="space-y-3">
            {(extrasPend as any[]).map((ex) => (
              <form key={ex.id} action={decideExtraAction} className="rounded-card bg-brand-50 p-3">
                <input type="hidden" name="id" value={ex.id} />
                <p className="font-semibold">
                  {ex.bookings?.clients?.full_name ?? 'Cliente'} — {ex.description}
                </p>
                <p className="text-sm text-brand-800">
                  Pedido por {ex.requester_name} em{' '}
                  {new Date(ex.created_at).toLocaleString('pt-BR')}
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="label" htmlFor={`px-${ex.id}`}>Valor (USD)</label>
                    <input className="input !w-32" id={`px-${ex.id}`} name="price" type="number" min={0} step={5} />
                  </div>
                  <div className="grow">
                    <label className="label" htmlFor={`nx-${ex.id}`}>Observação</label>
                    <input className="input" id={`nx-${ex.id}`} name="notes" placeholder="Ex: combinado por telefone com a cliente" />
                  </div>
                  <button className="btn-primary" type="submit" name="decision" value="aprovar">
                    ✓ Aprovar e cobrar
                  </button>
                  <button className="btn-ghost" type="submit" name="decision" value="recusar">
                    Recusar
                  </button>
                </div>
              </form>
            ))}
          </div>
          <p className="mt-3 text-sm text-brand-800">
            Extras aprovados entram automaticamente na fatura da limpeza. Se a limpeza já foi
            faturada, use a fatura avulsa abaixo.
          </p>
        </div>
      )}

      {/* Catalogo e fatura avulsa */}
      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold text-brand-900">
          🧰 Catálogo de serviços extras e fatura avulsa
        </summary>

        <div className="mt-4">
          <p className="mb-2 font-semibold text-brand-800">
            Extras com preço definido — a equipe escolhe na lista e já entra na fatura
          </p>
          <div className="space-y-2">
            {(catalogo ?? []).map((c: any) => (
              <form key={c.id} action={updateExtraCatalogAction} className="flex flex-wrap items-end gap-2 rounded-card border border-brand-100 p-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="grow">
                  <input className="input" name="name" defaultValue={c.name} />
                </div>
                <div>
                  <label className="label" htmlFor={`cp-${c.id}`}>US$</label>
                  <input className="input !w-24" id={`cp-${c.id}`} name="price" type="number" min={0} step={5} defaultValue={c.price} />
                </div>
                <div>
                  <label className="label" htmlFor={`cm-${c.id}`}>min</label>
                  <input className="input !w-24" id={`cm-${c.id}`} name="minutes" type="number" min={0} step={5} defaultValue={c.minutes} />
                </div>
                <label className="flex min-h-touch items-center gap-2 font-medium text-brand-800">
                  <input type="checkbox" name="active" className="h-5 w-5 accent-brand-700" defaultChecked={c.active} />
                  Ativo
                </label>
                <button className="btn-ghost" type="submit">Salvar</button>
              </form>
            ))}
          </div>

          <form action={createExtraCatalogAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-card bg-brand-50 p-3">
            <div className="grow">
              <label className="label" htmlFor="novo-extra">Novo serviço extra</label>
              <input className="input" id="novo-extra" name="name" required placeholder="Ex: Limpeza de varanda" />
            </div>
            <div>
              <label className="label" htmlFor="novo-preco">US$</label>
              <input className="input !w-24" id="novo-preco" name="price" type="number" min={0} step={5} defaultValue={40} />
            </div>
            <div>
              <label className="label" htmlFor="novo-min">min</label>
              <input className="input !w-24" id="novo-min" name="minutes" type="number" min={0} step={5} defaultValue={20} />
            </div>
            <button className="btn-primary" type="submit">Adicionar</button>
          </form>
        </div>

        <div className="mt-6 border-t border-brand-100 pt-4">
          <p className="mb-2 font-semibold text-brand-800">
            Fatura avulsa — cobrança fora de uma limpeza
          </p>
          <form action={createStandaloneInvoiceAction} className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="label" htmlFor="fa-client">Cliente</label>
              <select className="input" id="fa-client" name="client_id" required defaultValue="">
                <option value="" disabled>Selecionar</option>
                {(clientesAtivos ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="fa-desc">Descrição</label>
              <input className="input" id="fa-desc" name="description" placeholder="Ex: limpeza pós-obra na garagem" />
            </div>
            <div>
              <label className="label" htmlFor="fa-valor">Valor (USD)</label>
              <input className="input" id="fa-valor" name="amount" type="number" min={0} step={5} required />
            </div>
            <div className="md:col-span-4">
              <button className="btn-primary" type="submit">Emitir fatura avulsa</button>
            </div>
          </form>
        </div>
      </details>

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
