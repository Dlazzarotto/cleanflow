import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireMarketingAccess } from '@/lib/auth';
import { CLIENT_STATUS_LABEL, type Client, type ClientStatus } from '@/lib/types';
import { setMarketingOptInAction, saveLostReasonAction, markContactedAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const GRUPOS: { key: string; label: string; icon: string; statuses: ClientStatus[]; hint: string }[] = [
  {
    key: 'leads',
    label: 'Leads sem estimate',
    icon: '🌱',
    statuses: ['lead'],
    hint: 'Pediram orçamento mas ainda não receberam um estimate. Vale uma ligação.',
  },
  {
    key: 'espera',
    label: 'Aguardando resposta',
    icon: '🟡',
    statuses: ['em_espera'],
    hint: 'Receberam o estimate e não responderam. Follow-up costuma reverter boa parte.',
  },
  {
    key: 'perdidos',
    label: 'Não fecharam',
    icon: '💤',
    statuses: ['perdido'],
    hint: 'Receberam orçamento e nunca contrataram. A conversa aqui é vencer a objeção original — preço, frequência ou momento. Veja o motivo registrado em cada um.',
  },
  {
    key: 'fechados',
    label: 'Viraram clientes',
    icon: '🟢',
    statuses: ['ativo'],
    hint: 'Fecharam contrato. O resultado do trabalho de prospecção.',
  },
  {
    key: 'exclientes',
    label: 'Ex-clientes',
    icon: '🔄',
    statuses: ['inativo'],
    hint: 'Já foram atendidos e pararam. A melhor base que existe: conhecem o serviço e a casa já está no sistema. Campanha de reconquista costuma converter mais que lead novo.',
  },
];

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: { grupo?: string };
}) {
  const { role: myRole } = await requireMarketingAccess();
  const grupo = GRUPOS.find((g) => g.key === searchParams.grupo) ?? GRUPOS[0];

  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .in('status', grupo.statuses)
    .order('created_at', { ascending: false });
  const clients = (data ?? []) as Client[];

  const { data: counts } = await supabase.from('clients').select('status');
  const countBy = (sts: ClientStatus[]) =>
    (counts ?? []).filter((c: any) => sts.includes(c.status)).length;

  const contatos = clients.filter((c) => c.marketing_opt_in && (c.phone || c.email));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">
          {myRole === 'marketing' ? '🌱 Meus leads' : '📣 Marketing'}
        </h1>
        <div className="flex gap-2">
          <Link href="/clientes/novo" className="btn-primary">+ Cadastrar lead</Link>
          <Link href="/marketing/relatorio" className="btn-ghost">📊 Relatório</Link>
        </div>
      </div>
      <p className="mb-6 text-brand-800">
        {myRole === 'marketing'
          ? 'Aqui ficam os leads que você cadastrou e o andamento de cada um. Quem define o destino (fechou, não aceitou, segue em espera) é a gestão — você acompanha e faz o follow-up.'
          : 'Quem não virou cliente recorrente continua aqui — com o histórico do que aconteceu — para campanhas futuras. Clientes banidos nunca entram nesta base.'}
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {GRUPOS.map((g) => (
          <Link
            key={g.key}
            href={`/marketing?grupo=${g.key}`}
            className={`flex min-h-touch items-center gap-2 rounded-card border px-4 py-2 font-medium ${
              grupo.key === g.key
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            <span aria-hidden>{g.icon}</span>
            {g.label} ({countBy(g.statuses)})
          </Link>
        ))}
      </div>

      <div className="card mb-6">
        <p className="text-brand-800">{grupo.hint}</p>
        <p className="mt-2 font-semibold text-brand-900">
          {contatos.length} contato(s) deste grupo autorizados a receber campanhas
        </p>
        {contatos.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-medium text-brand-700">
              Ver lista de contatos para copiar
            </summary>
            <textarea
              className="input mt-2 font-mono text-sm"
              rows={5}
              readOnly
              value={contatos
                .map((c) => [c.full_name, c.phone, c.email].filter(Boolean).join(' · '))
                .join('\n')}
            />
          </details>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="card text-brand-800">Nenhum cliente neste grupo.</div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/clientes/${c.id}`} className="text-xl font-semibold text-brand-900 hover:underline">
                    {c.full_name}
                  </Link>
                  <p className="text-brand-800">
                    {[c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-900">
                      {CLIENT_STATUS_LABEL[c.status]}
                    </span>
                    {c.source && (
                      <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                        origem: {c.source}
                      </span>
                    )}
                    {c.last_contact_at && (
                      <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                        último contato: {new Date(c.last_contact_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={markContactedAction.bind(null, c.id)}>
                    <button className="btn-ghost" type="submit">📞 Marcar contato feito</button>
                  </form>
                  <form action={setMarketingOptInAction.bind(null, c.id, !c.marketing_opt_in)}>
                    <button
                      className={c.marketing_opt_in ? 'btn-ghost' : 'btn-ghost !border-red-700 !text-red-700'}
                      type="submit"
                    >
                      {c.marketing_opt_in ? '✓ Recebe campanhas' : '🔕 Não perturbe'}
                    </button>
                  </form>
                </div>
              </div>

              <form action={saveLostReasonAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-brand-100 pt-3">
                <input type="hidden" name="id" value={c.id} />
                <div className="grow">
                  <label className="label" htmlFor={`lost-${c.id}`}>Por que não fechou / observações</label>
                  <input
                    className="input"
                    id={`lost-${c.id}`}
                    name="lost_reason"
                    defaultValue={c.lost_reason ?? ''}
                    placeholder="Ex: achou caro; queria só uma vez; mudou de cidade"
                  />
                </div>
                <button className="btn-ghost" type="submit">Salvar</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
