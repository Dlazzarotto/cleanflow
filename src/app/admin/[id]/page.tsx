import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/platform';
import {
  updateCompanyAccountAction,
  setAccountStatusAction,
  setMemberRolePlatformAction,
} from '@/lib/actions/platform';

export const dynamic = 'force-dynamic';

const ROLES = [
  { key: 'owner', label: 'Dono(a) da empresa' },
  { key: 'admin', label: 'Administrador(a)' },
  { key: 'supervisor', label: 'Supervisor(a)' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'cleaner', label: 'Equipe de limpeza' },
];

export default async function AdminCompanyPage({ params }: { params: { id: string } }) {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: company }, { data: members }, { data: stats }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', params.id).single(),
    supabase
      .from('memberships')
      .select('id, user_id, full_name, role, active, created_at')
      .eq('company_id', params.id)
      .order('full_name'),
    supabase.rpc('platform_company_stats'),
  ]);
  if (!company) notFound();

  const c = company as any;
  const s: any = (stats ?? []).find((x: any) => x.company_id === params.id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-brand-700 underline">← Todas as empresas</Link>
      <h1 className="mb-1 mt-3 text-3xl font-bold text-brand-900">{c.name}</h1>
      <p className="mb-6 text-brand-800">
        Cliente desde {new Date(c.signed_up_at ?? c.created_at).toLocaleDateString('pt-BR')} ·{' '}
        {s?.users_count ?? 0} usuários · {s?.clients_count ?? 0} clientes ·{' '}
        {s?.bookings_month ?? 0} limpezas neste mês
      </p>

      {/* Ações rápidas de conta */}
      <div className="card mb-6">
        <p className="mb-3 font-semibold text-brand-900">Situação da conta</p>
        <div className="flex flex-wrap gap-2">
          {c.account_status !== 'ativa' && (
            <form action={setAccountStatusAction.bind(null, c.id, 'ativa')}>
              <button className="btn-primary" type="submit">✓ Ativar conta</button>
            </form>
          )}
          {c.account_status !== 'suspensa' && (
            <form action={setAccountStatusAction.bind(null, c.id, 'suspensa')}>
              <button className="btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50" type="submit">
                ⏸ Suspender acesso
              </button>
            </form>
          )}
          {c.account_status !== 'cancelada' && (
            <form action={setAccountStatusAction.bind(null, c.id, 'cancelada')}>
              <button className="btn-ghost" type="submit">Cancelar conta</button>
            </form>
          )}
        </div>
        <p className="mt-3 text-sm text-brand-800">
          Conta suspensa bloqueia o acesso de todos os usuários da empresa, preservando os dados.
        </p>
      </div>

      {/* Cadastro comercial */}
      <form action={updateCompanyAccountAction} className="card mb-6 space-y-4">
        <input type="hidden" name="id" value={c.id} />
        <p className="text-xl font-semibold text-brand-900">Cadastro e contrato</p>

        <div>
          <label className="label" htmlFor="name">Nome da empresa</label>
          <input className="input" id="name" name="name" required defaultValue={c.name ?? ''} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="representative_name">Representante</label>
            <input className="input" id="representative_name" name="representative_name" defaultValue={c.representative_name ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="website">Website</label>
            <input className="input" id="website" name="website" defaultValue={c.website ?? ''} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefone</label>
            <input className="input" id="phone" name="phone" type="tel" defaultValue={c.phone ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" defaultValue={c.email ?? ''} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="plan">Plano</label>
            <select className="input" id="plan" name="plan" defaultValue={c.plan ?? 'standard'}>
              <option value="standard">Standard — $30/mês · 1 equipe</option>
              <option value="plus">Plus — $50/mês · 2 equipes</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="extra_teams">Equipes adicionais ($10/mês cada)</label>
            <input className="input" id="extra_teams" name="extra_teams" type="number" min={0} max={20} defaultValue={c.extra_teams ?? 0} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="monthly_fee">Mensalidade (USD)</label>
            <input className="input" id="monthly_fee" name="monthly_fee" type="number" min={0} step={5} defaultValue={c.monthly_fee ?? 0} />
            <p className="mt-1 text-sm text-brand-800">
              Deixe em 0 para calcular automaticamente pelo plano.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="account_status">Situação</label>
            <select className="input" id="account_status" name="account_status" defaultValue={c.account_status}>
              <option value="teste">Em teste</option>
              <option value="ativa">Ativa</option>
              <option value="suspensa">Suspensa</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="billing_status">Pagamento</label>
            <select className="input" id="billing_status" name="billing_status" defaultValue={c.billing_status}>
              <option value="em_dia">Em dia</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
              <option value="isento">Isento</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="next_due_date">Próximo vencimento</label>
            <input className="input" id="next_due_date" name="next_due_date" type="date" defaultValue={c.next_due_date ?? ''} />
          </div>
        </div>

        <div className="rounded-card bg-brand-50 p-4">
          <p className="mb-3 font-semibold text-brand-900">🏢 Módulo de Limpeza Comercial</p>
          <label className="flex min-h-touch cursor-pointer items-center gap-3 font-medium text-brand-800">
            <input
              type="checkbox"
              name="commercial_enabled"
              className="h-5 w-5 accent-brand-700"
              defaultChecked={Boolean(c.commercial_enabled)}
            />
            Empresa contratou o módulo comercial
          </label>
          <div className="mt-3 max-w-xs">
            <label className="label" htmlFor="commercial_price">Valor do módulo (USD/mês)</label>
            <input
              className="input"
              id="commercial_price"
              name="commercial_price"
              type="number"
              min={0}
              step={5}
              defaultValue={c.commercial_price ?? 20}
            />
            <p className="mt-1 text-sm text-brand-800">
              Use 0 para liberar sem cobrar (cortesia ou período de teste).
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="platform_notes">Anotações internas (só você vê)</label>
          <textarea className="input" id="platform_notes" name="platform_notes" rows={3} defaultValue={c.platform_notes ?? ''} />
        </div>

        <button className="btn-primary w-full" type="submit">Salvar cadastro</button>
      </form>

      {/* Acessos */}
      <div className="card">
        <p className="mb-3 text-xl font-semibold text-brand-900">Acessos da empresa</p>
        {(members ?? []).length === 0 ? (
          <p className="text-brand-800">Nenhum usuário vinculado.</p>
        ) : (
          <div className="space-y-2">
            {(members ?? []).map((m: any) => (
              <form
                key={m.id}
                action={setMemberRolePlatformAction}
                className="flex flex-wrap items-end justify-between gap-2 rounded-card border border-brand-100 px-4 py-3"
              >
                <input type="hidden" name="membership_id" value={m.id} />
                <input type="hidden" name="company_id" value={c.id} />
                <div>
                  <p className="font-semibold">{m.full_name}</p>
                  <p className="text-sm text-brand-800">
                    {m.active ? 'acesso ativo' : 'acesso desativado'} · desde{' '}
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <select className="input !w-52" name="role" defaultValue={m.role}>
                    {ROLES.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  <button className="btn-ghost" type="submit">Aplicar</button>
                </div>
              </form>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-brand-800">
          Use isto para resolver problemas de acesso (ex: empresa sem nenhum dono ativo).
        </p>
      </div>
    </div>
  );
}
