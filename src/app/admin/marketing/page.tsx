import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/platform';
import {
  createPlatformCampaignAction,
  updatePlatformCampaignAction,
  updatePlatformLeadAction,
} from '@/lib/actions/platform-marketing';
import CopyLinkButton from '@/components/CopyLinkButton';

export const dynamic = 'force-dynamic';

const CANAIS = ['Facebook', 'Instagram', 'Google Ads', 'YouTube', 'TikTok', 'LinkedIn', 'Indicação', 'Evento', 'Cold call', 'Outro'];

const STATUS: Record<string, { label: string; cls: string }> = {
  novo: { label: 'Novo', cls: 'bg-sun/30 text-brand-900' },
  contatado: { label: 'Contatado', cls: 'bg-brand-100 text-brand-900' },
  demonstracao: { label: 'Demonstração feita', cls: 'bg-brand-100 text-brand-900' },
  teste: { label: 'Em teste', cls: 'bg-aqua-400 text-white' },
  assinante: { label: 'Assinante ✓', cls: 'bg-aqua-500 text-white' },
  perdido: { label: 'Não fechou', cls: 'bg-brand-50 text-brand-800' },
};

const COMISSAO: Record<string, string> = {
  por_assinatura: 'por empresa que assina',
  por_lead: 'por lead recebido',
  recorrente_pct: '% da mensalidade enquanto ativa',
  sem_comissao: 'sem comissão',
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (b === 0) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

export default async function AdminMarketingPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: stats }, { data: leads }, { data: empresas }] = await Promise.all([
    supabase.rpc('platform_campaign_stats'),
    supabase.from('platform_leads').select('*, platform_campaigns(name)').order('created_at', { ascending: false }).limit(200),
    supabase.from('companies').select('id, name').order('name'),
  ]);

  const campanhas = (stats ?? []) as any[];
  const listaLeads = (leads ?? []) as any[];

  const totalVisitas = campanhas.reduce((s, c) => s + c.visits, 0);
  const totalLeads = listaLeads.length;
  const assinantes = listaLeads.filter((l) => l.status === 'assinante').length;
  const emFunil = listaLeads.filter((l) => ['novo', 'contatado', 'demonstracao', 'teste'].includes(l.status)).length;
  const comissaoTotal = campanhas.reduce((s, c) => s + Number(c.comissao), 0);
  const mrrGerado = campanhas.reduce((s, c) => s + Number(c.mrr_gerado), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">📣 Marketing CleanFlow</h1>
          <p className="text-brand-800">
            Captação de empresas de limpeza para assinar a plataforma.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost">← Painel</Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card">
          <p className="text-brand-800">Acessos</p>
          <p className="text-3xl font-bold">{totalVisitas}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Empresas interessadas</p>
          <p className="text-3xl font-bold">{totalLeads}</p>
          <p className="text-sm text-brand-800">{pct(totalLeads, totalVisitas)} dos acessos</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Em negociação</p>
          <p className="text-3xl font-bold text-sun">{emFunil}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Assinaram</p>
          <p className="text-3xl font-bold text-brand-700">{assinantes}</p>
          <p className="text-sm text-brand-800">{pct(assinantes, totalLeads)} dos leads</p>
        </div>
        <div className="card">
          <p className="text-brand-800">MRR conquistado</p>
          <p className="text-3xl font-bold text-brand-900">{usd(mrrGerado)}</p>
          {comissaoTotal > 0 && (
            <p className="text-sm text-brand-800">{usd(comissaoTotal)} em comissões</p>
          )}
        </div>
      </div>

      {/* Campanhas */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Campanhas e links</h2>
      {campanhas.length === 0 ? (
        <div className="card mb-6 text-brand-800">
          Nenhuma campanha ainda. Crie a primeira abaixo — cada uma gera um link com página de
          vendas do CleanFlow.
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          {campanhas.map((c) => (
            <div key={c.campaign_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">
                    {c.name} {!c.active && <span className="text-brand-800">(pausada)</span>}
                  </p>
                  <p className="text-brand-800">
                    {[c.partner_name, c.channel].filter(Boolean).join(' · ') || 'Campanha própria'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-800">MRR gerado</p>
                  <p className="text-2xl font-bold text-brand-900">{usd(c.mrr_gerado)}</p>
                  {c.commission_type !== 'sem_comissao' && (
                    <p className="text-sm text-brand-800">
                      comissão {usd(c.comissao)} ·{' '}
                      {c.commission_type === 'recorrente_pct'
                        ? `${c.commission_value}% ${COMISSAO[c.commission_type]}`
                        : `${usd(c.commission_value)} ${COMISSAO[c.commission_type]}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 rounded-card bg-brand-50 p-3 md:grid-cols-5">
                <div>
                  <p className="text-sm text-brand-800">Acessos</p>
                  <p className="text-xl font-bold">{c.visits}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Interessadas</p>
                  <p className="text-xl font-bold">{c.leads}</p>
                  <p className="text-xs text-brand-800">{pct(c.leads, c.visits)}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Em negociação</p>
                  <p className="text-xl font-bold text-sun">{c.em_negociacao}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Assinaram</p>
                  <p className="text-xl font-bold text-brand-700">{c.assinantes}</p>
                  <p className="text-xs text-brand-800">{pct(c.assinantes, c.leads)}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Não fecharam</p>
                  <p className="text-xl font-bold">{c.perdidos}</p>
                </div>
              </div>

              <div className="mt-3">
                <CopyLinkButton slug={c.slug} basePath="/assine" />
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-brand-700">✏️ Editar</summary>
                <form action={updatePlatformCampaignAction} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={c.campaign_id} />
                  <div>
                    <label className="label" htmlFor={`pn-${c.campaign_id}`}>Nome</label>
                    <input className="input" id={`pn-${c.campaign_id}`} name="name" defaultValue={c.name} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`pp-${c.campaign_id}`}>Parceiro</label>
                    <input className="input" id={`pp-${c.campaign_id}`} name="partner_name" defaultValue={c.partner_name ?? ''} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`pc-${c.campaign_id}`}>Canal</label>
                    <select className="input" id={`pc-${c.campaign_id}`} name="channel" defaultValue={c.channel ?? ''}>
                      <option value="">Selecionar</option>
                      {CANAIS.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`pt-${c.campaign_id}`}>Comissão</label>
                    <select className="input" id={`pt-${c.campaign_id}`} name="commission_type" defaultValue={c.commission_type}>
                      <option value="por_assinatura">Valor fixo por empresa que assina</option>
                      <option value="por_lead">Valor fixo por lead</option>
                      <option value="recorrente_pct">% da mensalidade enquanto ativa</option>
                      <option value="sem_comissao">Sem comissão</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`pv-${c.campaign_id}`}>Valor / %</label>
                    <input className="input" id={`pv-${c.campaign_id}`} name="commission_value" type="number" min={0} step={1} defaultValue={c.commission_value} />
                  </div>
                  <label className="flex min-h-touch items-center gap-3 font-medium text-brand-800">
                    <input type="checkbox" name="active" className="h-5 w-5 accent-brand-700" defaultChecked={c.active} />
                    Ativa
                  </label>
                  <div className="md:col-span-2">
                    <button className="btn-primary" type="submit">Salvar</button>
                  </div>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}

      <details className="card mb-8">
        <summary className="cursor-pointer text-xl font-semibold text-brand-900">
          + Nova campanha
        </summary>
        <form action={createPlatformCampaignAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Nome da campanha *</label>
            <input className="input" id="name" name="name" required placeholder="Ex: Facebook grupos de limpeza MA" />
          </div>
          <div>
            <label className="label" htmlFor="partner_name">Parceiro (se houver)</label>
            <input className="input" id="partner_name" name="partner_name" placeholder="Deixe vazio se for campanha própria" />
          </div>
          <div>
            <label className="label" htmlFor="channel">Canal</label>
            <select className="input" id="channel" name="channel" defaultValue="">
              <option value="">Selecionar</option>
              {CANAIS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="commission_type">Comissão</label>
            <select className="input" id="commission_type" name="commission_type" defaultValue="sem_comissao">
              <option value="sem_comissao">Sem comissão (campanha própria)</option>
              <option value="por_assinatura">Valor fixo por empresa que assina</option>
              <option value="por_lead">Valor fixo por lead</option>
              <option value="recorrente_pct">% da mensalidade enquanto ativa</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="commission_value">Valor / %</label>
            <input className="input" id="commission_value" name="commission_value" type="number" min={0} step={1} defaultValue={0} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Criar e gerar link</button>
          </div>
        </form>
      </details>

      {/* Funil de empresas */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">
        Empresas interessadas ({listaLeads.length})
      </h2>
      {listaLeads.length === 0 ? (
        <div className="card text-brand-800">
          Nenhuma empresa se cadastrou ainda. Divulgue os links das campanhas.
        </div>
      ) : (
        <div className="space-y-3">
          {listaLeads.map((l) => (
            <form key={l.id} action={updatePlatformLeadAction} className="card">
              <input type="hidden" name="id" value={l.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">{l.company_name}</p>
                  <p className="text-brand-800">
                    {[l.contact_name, l.phone, l.email].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-sm text-brand-800">
                    {[l.city, l.teams_count, l.current_system && `hoje usa: ${l.current_system}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {l.notes && <p className="mt-2 rounded-card bg-brand-50 p-2 text-sm">{l.notes}</p>}
                  <p className="mt-2 text-sm text-brand-800">
                    {l.platform_campaigns?.name ?? 'Sem campanha'} ·{' '}
                    {new Date(l.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS[l.status]?.cls}`}>
                  {STATUS[l.status]?.label ?? l.status}
                </span>
              </div>

              <div className="mt-3 grid gap-3 border-t border-brand-100 pt-3 md:grid-cols-4">
                <div>
                  <label className="label" htmlFor={`s-${l.id}`}>Situação</label>
                  <select className="input" id={`s-${l.id}`} name="status" defaultValue={l.status}>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`c-${l.id}`}>Virou a empresa</label>
                  <select className="input" id={`c-${l.id}`} name="company_id" defaultValue={l.company_id ?? ''}>
                    <option value="">Ainda não</option>
                    {(empresas ?? []).map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`n-${l.id}`}>Anotações</label>
                  <input className="input" id={`n-${l.id}`} name="notes" defaultValue={l.notes ?? ''} />
                </div>
                <div className="flex items-end">
                  <button className="btn-primary w-full" type="submit">Salvar</button>
                </div>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
