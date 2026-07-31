import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/platform';
import { planName } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const ACCOUNT_LABEL: Record<string, { label: string; cls: string }> = {
  teste: { label: 'Em teste', cls: 'bg-brand-100 text-brand-900' },
  ativa: { label: 'Ativa', cls: 'bg-aqua-500 text-white' },
  suspensa: { label: 'Suspensa', cls: 'bg-red-700 text-white' },
  cancelada: { label: 'Cancelada', cls: 'bg-brand-100 text-brand-800' },
};

const BILLING_LABEL: Record<string, string> = {
  em_dia: '✓ em dia',
  pendente: '• pendente',
  atrasado: '⚠️ atrasado',
  isento: 'isento',
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function AdminHomePage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: companies }, { data: stats }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at'),
    supabase.rpc('platform_company_stats'),
  ]);

  const statsBy = new Map((stats ?? []).map((s: any) => [s.company_id, s]));
  const list = companies ?? [];

  const mrr = list
    .filter((c: any) => c.account_status === 'ativa' && c.billing_status !== 'isento')
    .reduce((s: number, c: any) => s + Number(c.monthly_fee), 0);
  const ativas = list.filter((c: any) => c.account_status === 'ativa').length;
  const inadimplentes = list.filter((c: any) => c.billing_status === 'atrasado').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Empresas assinantes</h1>
        <div className="flex gap-2">
          <Link href="/admin/nova" className="btn-primary">+ Nova empresa</Link>
          <Link href="/termos" className="btn-ghost">📜 Contrato</Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Contas ativas</p>
          <p className="text-3xl font-bold">{ativas}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Receita mensal (MRR)</p>
          <p className="text-3xl font-bold text-brand-900">{usd(mrr)}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Em atraso</p>
          <p className="text-3xl font-bold">{inadimplentes}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Total de contas</p>
          <p className="text-3xl font-bold">{list.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {list.map((c: any) => {
          const s: any = statsBy.get(c.id);
          const badge = ACCOUNT_LABEL[c.account_status] ?? ACCOUNT_LABEL.ativa;
          return (
            <Link key={c.id} href={`/admin/${c.id}`} className="card block hover:border-aqua-500">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">{c.name}</p>
                  <p className="text-brand-800">
                    {[c.representative_name, c.phone, c.email].filter(Boolean).join(' · ') ||
                      'Sem contato cadastrado'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className={`rounded-full px-3 py-1 font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                      {planName(c.plan)}
                      {c.extra_teams > 0 ? ` +${c.extra_teams} equipe(s)` : ''}
                    </span>
                    <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                      {usd(c.monthly_fee)}/mês · {BILLING_LABEL[c.billing_status] ?? c.billing_status}
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm text-brand-800">
                  <p>{s?.users_count ?? 0} usuários</p>
                  <p>{s?.clients_count ?? 0} clientes</p>
                  <p>{s?.bookings_month ?? 0} limpezas no mês</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-brand-800">
        Você administra contas, acessos e mensalidades. Os dados dos clientes de cada empresa
        (nomes, endereços, valores) não são acessíveis por esta área — apenas os números agregados
        acima.
      </p>
    </div>
  );
}
