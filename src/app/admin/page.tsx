import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/platform';
import { planName, PLANS } from '@/lib/plans';
import PlatformMap, { type CompanyPin } from '@/components/PlatformMap';
import GrowthChart, { type GrowthPoint } from '@/components/GrowthChart';

export const dynamic = 'force-dynamic';

const ACCOUNT: Record<string, { label: string; cls: string }> = {
  teste: { label: 'Em teste', cls: 'bg-sun/30 text-brand-900' },
  ativa: { label: 'Ativa', cls: 'bg-aqua-500 text-white' },
  suspensa: { label: 'Suspensa', cls: 'bg-red-700 text-white' },
  cancelada: { label: 'Cancelada', cls: 'bg-brand-100 text-brand-800' },
};

const BILLING: Record<string, string> = {
  em_dia: '✓ em dia',
  pendente: '• pendente',
  atrasado: '⚠️ atrasado',
  isento: 'isento',
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function diasAtras(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default async function AdminHomePage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: metrics }, { data: growth }] = await Promise.all([
    supabase.rpc('platform_metrics'),
    supabase.rpc('platform_growth'),
  ]);

  const empresas = (metrics ?? []) as any[];
  const evolucao = (growth ?? []) as GrowthPoint[];

  const ativas = empresas.filter((e) => e.account_status === 'ativa');
  const emTeste = empresas.filter((e) => e.account_status === 'teste');
  const suspensas = empresas.filter((e) => e.account_status === 'suspensa');
  const atrasadas = empresas.filter((e) => e.billing_status === 'atrasado');

  const mrr = ativas
    .filter((e) => e.billing_status !== 'isento')
    .reduce((s, e) => s + Number(e.monthly_fee), 0);
  const mrrPotencial = empresas
    .filter((e) => e.account_status !== 'cancelada')
    .reduce((s, e) => s + Number(e.monthly_fee), 0);

  const totalClientes = empresas.reduce((s, e) => s + e.clients_active, 0);
  const totalLimpezas = empresas.reduce((s, e) => s + e.bookings_month, 0);
  const totalConcluidas = empresas.reduce((s, e) => s + e.bookings_done_month, 0);
  const volumeProcessado = empresas.reduce((s, e) => s + Number(e.revenue_month), 0);
  const faturasAbertas = empresas.reduce((s, e) => s + Number(e.invoices_open_amount), 0);
  const ocorrencias = empresas.reduce((s, e) => s + e.incidents_open, 0);
  const usuarios = empresas.reduce((s, e) => s + e.users_count, 0);

  // Empresas que merecem atenção
  const inativas = empresas.filter((e) => {
    const d = diasAtras(e.last_activity);
    return e.account_status === 'ativa' && (d === null || d > 7);
  });

  const pins: CompanyPin[] = empresas.map((e) => ({
    id: e.company_id,
    name: e.company_name,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    plan: planName(e.plan),
    account_status: e.account_status,
    billing_status: e.billing_status,
    clients_active: e.clients_active,
    bookings_month: e.bookings_month,
    monthly_fee: Number(e.monthly_fee),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Painel CleanFlow</h1>
        <div className="flex gap-2">
          <Link href="/admin/nova" className="btn-primary">+ Nova empresa</Link>
          <Link href="/termos" className="btn-ghost">📜 Contrato</Link>
        </div>
      </div>

      {/* Receita */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Receita da plataforma</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card bg-brand-900 !border-brand-900 text-white">
          <p className="text-brand-100">MRR (receita mensal)</p>
          <p className="text-3xl font-bold text-aqua-400">{usd(mrr)}</p>
          <p className="text-sm text-brand-100">{usd(mrr * 12)} por ano</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Potencial com todas</p>
          <p className="text-3xl font-bold">{usd(mrrPotencial)}</p>
          <p className="text-sm text-brand-800">se todas ativarem e pagarem</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Ticket médio</p>
          <p className="text-3xl font-bold">{ativas.length > 0 ? usd(mrr / ativas.length) : '—'}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Pagamentos em atraso</p>
          <p className={`text-3xl font-bold ${atrasadas.length > 0 ? 'text-red-700' : ''}`}>
            {atrasadas.length}
          </p>
          {atrasadas.length > 0 && (
            <p className="text-sm text-brand-800">
              {usd(atrasadas.reduce((s, e) => s + Number(e.monthly_fee), 0))} a receber
            </p>
          )}
        </div>
      </div>

      {/* Contas */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Contas</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Ativas</p>
          <p className="text-3xl font-bold text-brand-700">{ativas.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Em teste</p>
          <p className="text-3xl font-bold text-sun">{emTeste.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Suspensas</p>
          <p className="text-3xl font-bold">{suspensas.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Usuários no sistema</p>
          <p className="text-3xl font-bold">{usuarios}</p>
        </div>
      </div>

      {/* Uso */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Uso da plataforma neste mês</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card">
          <p className="text-brand-800">Clientes atendidos</p>
          <p className="text-3xl font-bold">{totalClientes}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Limpezas agendadas</p>
          <p className="text-3xl font-bold">{totalLimpezas}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Já concluídas</p>
          <p className="text-3xl font-bold text-brand-700">{totalConcluidas}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Volume processado</p>
          <p className="text-3xl font-bold">{usd(volumeProcessado)}</p>
          <p className="text-sm text-brand-800">faturado pelas empresas</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Faturas em aberto</p>
          <p className="text-3xl font-bold">{usd(faturasAbertas)}</p>
        </div>
      </div>

      {/* Mapa */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Onde estão as empresas</h2>
      <div className="card mb-8">
        <PlatformMap companies={pins} />
      </div>

      {/* Evolução */}
      {evolucao.length > 0 && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-brand-900">Evolução (12 meses)</h2>
          <div className="card mb-8">
            <GrowthChart data={evolucao} />
          </div>
        </>
      )}

      {/* Atenção */}
      {(atrasadas.length > 0 || inativas.length > 0 || ocorrencias > 0) && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-brand-900">Precisa de atenção</h2>
          <div className="card mb-8 space-y-3">
            {atrasadas.map((e) => (
              <Link
                key={`a-${e.company_id}`}
                href={`/admin/${e.company_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-red-50 p-3 hover:bg-red-100"
              >
                <span className="font-medium text-red-800">⚠️ {e.company_name}</span>
                <span className="text-red-800">
                  pagamento atrasado · {usd(e.monthly_fee)}/mês
                  {e.next_due_date &&
                    ` · vencia ${new Date(e.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                </span>
              </Link>
            ))}
            {inativas.map((e) => (
              <Link
                key={`i-${e.company_id}`}
                href={`/admin/${e.company_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-sun/10 p-3 hover:bg-sun/20"
              >
                <span className="font-medium text-brand-900">😴 {e.company_name}</span>
                <span className="text-brand-800">
                  {e.last_activity
                    ? `sem movimento há ${diasAtras(e.last_activity)} dias`
                    : 'nunca usou o sistema'}
                </span>
              </Link>
            ))}
            {ocorrencias > 0 && (
              <p className="rounded-card bg-brand-50 p-3 text-brand-800">
                {ocorrencias} ocorrência(s) em aberto nas empresas — elas resolvem internamente,
                mas volume alto pode indicar dificuldade de operação.
              </p>
            )}
          </div>
        </>
      )}

      {/* Lista */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Todas as empresas</h2>
      <div className="space-y-3">
        {empresas.map((e) => {
          const badge = ACCOUNT[e.account_status] ?? ACCOUNT.ativa;
          const dias = diasAtras(e.last_activity);
          return (
            <Link
              key={e.company_id}
              href={`/admin/${e.company_id}`}
              className="card block hover:border-aqua-500"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-brand-900">{e.company_name}</p>
                  <p className="text-brand-800">{e.city ?? 'Sem endereço cadastrado'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className={`rounded-full px-3 py-1 font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {e.commercial_enabled && (
                      <span className="rounded-full bg-brand-900 px-3 py-1 font-medium text-white">
                        🏢 Comercial
                      </span>
                    )}
                    <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                      {planName(e.plan)}
                      {e.extra_teams > 0 ? ` +${e.extra_teams}` : ''}
                    </span>
                    <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
                      {usd(e.monthly_fee)}/mês · {BILLING[e.billing_status] ?? e.billing_status}
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm text-brand-800">
                  <p>{e.users_count} usuários · {e.teams_count} equipe(s)</p>
                  <p>{e.clients_active} clientes ativos</p>
                  <p>
                    {e.bookings_done_month}/{e.bookings_month} limpezas no mês
                  </p>
                  <p>{usd(e.revenue_month)} faturado</p>
                  {dias !== null && (
                    <p className={dias > 7 ? 'text-sun' : ''}>
                      {dias === 0 ? 'ativa hoje' : `último uso há ${dias}d`}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-brand-800">
        Todos os números acima são agregados. Os dados dos clientes de cada empresa (nomes,
        endereços, valores individuais) não são acessíveis por esta área.
      </p>
    </div>
  );
}
