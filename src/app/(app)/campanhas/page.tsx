import { createClient } from '@/lib/supabase/server';
import { requireMarketingAccess, isManager } from '@/lib/auth';
import { createCampaignAction, updateCampaignAction } from '@/lib/actions/campaigns';
import CopyLinkButton from '@/components/CopyLinkButton';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

const COMISSAO: Record<string, string> = {
  por_fechamento: 'por cliente fechado',
  por_lead: 'por lead recebido',
  percentual: '% do valor mensal fechado',
  sem_comissao: 'sem comissão',
};

const CANAIS = ['Instagram', 'Facebook', 'Google Ads', 'TikTok', 'YouTube', 'WhatsApp', 'Panfleto', 'Indicação', 'Outro'];

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (b === 0) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

export default async function CampanhasPage() {
  const { role: myRole } = await requireMarketingAccess();
  const gestao = isManager(myRole);

  const supabase = createClient();
  const [{ data: stats }, { data: pessoas }] = await Promise.all([
    supabase.rpc('campaign_stats'),
    gestao
      ? supabase.from('memberships').select('user_id, full_name, role').eq('active', true).order('full_name')
      : Promise.resolve({ data: [] }),
  ]);

  const campanhas = (stats ?? []) as any[];
  const totalVisitas = campanhas.reduce((s, c) => s + c.visits, 0);
  const totalLeads = campanhas.reduce((s, c) => s + c.leads, 0);
  const totalFechados = campanhas.reduce((s, c) => s + c.fechados, 0);
  const totalComissao = campanhas.reduce((s, c) => s + Number(c.comissao), 0);

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">🔗 Campanhas e links</h1>
      <p className="mb-6 text-brand-800">
        Cada campanha tem um link próprio. Quem clica é contado, quem preenche vira lead, e quando
        o cliente fecha o sistema calcula a comissão automaticamente.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Acessos</p>
          <p className="text-3xl font-bold">{totalVisitas}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Leads gerados</p>
          <p className="text-3xl font-bold">{totalLeads}</p>
          <p className="text-sm text-brand-800">{pct(totalLeads, totalVisitas)} dos acessos</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Fecharam contrato</p>
          <p className="text-3xl font-bold text-brand-700">{totalFechados}</p>
          <p className="text-sm text-brand-800">{pct(totalFechados, totalLeads)} dos leads</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Comissão a pagar</p>
          <p className="text-3xl font-bold text-sun">{usd(totalComissao)}</p>
        </div>
      </div>

      {campanhas.length === 0 ? (
        <div className="card mb-6 text-brand-800">
          {gestao
            ? 'Nenhuma campanha ainda. Crie a primeira abaixo e envie o link ao parceiro de mídia.'
            : 'Nenhuma campanha atribuída a você ainda. Fale com a gestão.'}
        </div>
      ) : (
        <div className="mb-8 space-y-4">
          {campanhas.map((c) => (
            <div key={c.campaign_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">
                    {c.name} {!c.active && <span className="text-brand-800">(pausada)</span>}
                  </p>
                  <p className="text-brand-800">
                    {[c.partner_name, c.channel].filter(Boolean).join(' · ') || 'Sem parceiro definido'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-800">Comissão acumulada</p>
                  <p className="text-2xl font-bold text-brand-900">{usd(c.comissao)}</p>
                  <p className="text-sm text-brand-800">
                    {c.commission_type === 'percentual'
                      ? `${c.commission_value}% ${COMISSAO[c.commission_type]}`
                      : c.commission_type === 'sem_comissao'
                        ? COMISSAO[c.commission_type]
                        : `${usd(c.commission_value)} ${COMISSAO[c.commission_type]}`}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 rounded-card bg-brand-50 p-3 md:grid-cols-5">
                <div>
                  <p className="text-sm text-brand-800">Acessos</p>
                  <p className="text-xl font-bold">{c.visits}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Leads</p>
                  <p className="text-xl font-bold">{c.leads}</p>
                  <p className="text-xs text-brand-800">{pct(c.leads, c.visits)}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Em aberto</p>
                  <p className="text-xl font-bold text-sun">{c.em_aberto}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Fecharam</p>
                  <p className="text-xl font-bold text-brand-700">{c.fechados}</p>
                  <p className="text-xs text-brand-800">{pct(c.fechados, c.leads)}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-800">Não fecharam</p>
                  <p className="text-xl font-bold">{c.perdidos}</p>
                </div>
              </div>

              <div className="mt-3">
                <CopyLinkButton slug={c.slug} />
              </div>

              {gestao && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-medium text-brand-700">✏️ Editar campanha</summary>
                  <form action={updateCampaignAction} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={c.campaign_id} />
                    <div>
                      <label className="label" htmlFor={`n-${c.campaign_id}`}>Nome</label>
                      <input className="input" id={`n-${c.campaign_id}`} name="name" defaultValue={c.name} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`p-${c.campaign_id}`}>Parceiro / responsável</label>
                      <input className="input" id={`p-${c.campaign_id}`} name="partner_name" defaultValue={c.partner_name ?? ''} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`ch-${c.campaign_id}`}>Canal</label>
                      <select className="input" id={`ch-${c.campaign_id}`} name="channel" defaultValue={c.channel ?? ''}>
                        <option value="">Selecionar</option>
                        {CANAIS.map((x) => (
                          <option key={x} value={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`ct-${c.campaign_id}`}>Tipo de comissão</label>
                      <select className="input" id={`ct-${c.campaign_id}`} name="commission_type" defaultValue={c.commission_type}>
                        <option value="por_fechamento">Valor fixo por cliente fechado</option>
                        <option value="por_lead">Valor fixo por lead</option>
                        <option value="percentual">% do valor mensal fechado</option>
                        <option value="sem_comissao">Sem comissão</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`cv-${c.campaign_id}`}>Valor / percentual</label>
                      <input className="input" id={`cv-${c.campaign_id}`} name="commission_value" type="number" min={0} step={1} defaultValue={c.commission_value} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`o-${c.campaign_id}`}>Responsável no sistema</label>
                      <select className="input" id={`o-${c.campaign_id}`} name="owner_user_id" defaultValue="">
                        <option value="">Ninguém / externo</option>
                        {(pessoas ?? []).map((p: any) => (
                          <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex min-h-touch items-center gap-3 font-medium text-brand-800">
                      <input type="checkbox" name="active" className="h-5 w-5 accent-brand-700" defaultChecked={c.active} />
                      Campanha ativa
                    </label>
                    <div className="flex items-end">
                      <button className="btn-primary w-full" type="submit">Salvar</button>
                    </div>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {gestao && (
        <div className="card">
          <h2 className="mb-3 text-xl font-semibold text-brand-900">+ Nova campanha</h2>
          <form action={createCampaignAction} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Nome da campanha *</label>
              <input className="input" id="name" name="name" required placeholder="Ex: Instagram Verão 2026" />
            </div>
            <div>
              <label className="label" htmlFor="partner_name">Parceiro / responsável</label>
              <input className="input" id="partner_name" name="partner_name" placeholder="Ex: Agência Midia X" />
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
              <label className="label" htmlFor="owner_user_id">Responsável no sistema</label>
              <select className="input" id="owner_user_id" name="owner_user_id" defaultValue="">
                <option value="">Ninguém / externo</option>
                {(pessoas ?? []).map((p: any) => (
                  <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="commission_type">Tipo de comissão</label>
              <select className="input" id="commission_type" name="commission_type" defaultValue="por_fechamento">
                <option value="por_fechamento">Valor fixo por cliente fechado</option>
                <option value="por_lead">Valor fixo por lead</option>
                <option value="percentual">% do valor mensal fechado</option>
                <option value="sem_comissao">Sem comissão</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="commission_value">Valor / percentual</label>
              <input className="input" id="commission_value" name="commission_value" type="number" min={0} step={1} defaultValue={50} />
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary w-full" type="submit">Criar campanha e gerar link</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
