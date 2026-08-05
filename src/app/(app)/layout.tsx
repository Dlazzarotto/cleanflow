import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/platform';
import AppShell from '@/components/AppShell';

const MANAGER_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/calendario', label: 'Calendário', icon: '🗓️' },
  { href: '/estimates', label: 'Estimates', icon: '🧮' },
  { href: '/agendamentos', label: 'Agendamentos', icon: '📋' },
  { href: '/clientes', label: 'Clientes', icon: '👤' },
  { href: '/faturas', label: 'Faturas', icon: '🧾' },
  { href: '/regularizacao', label: 'Regularização', icon: '✅' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/campanhas', label: 'Campanhas', icon: '🔗' },
  { href: '/equipes', label: 'Equipes', icon: '🧹' },
  { href: '/ocorrencias', label: 'Ocorrências', icon: '⚠️' },
  { href: '/relatorios', label: 'Relatórios', icon: '📈' },
  { href: '/mapa', label: 'Mapa', icon: '🗺️' },
  { href: '/minha-agenda', label: 'Minha agenda', icon: '📱' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

const MARKETING_NAV = [
  { href: '/marketing', label: 'Meus leads', icon: '🌱' },
  { href: '/campanhas', label: 'Minhas campanhas', icon: '🔗' },
  { href: '/marketing/novo', label: 'Cadastrar lead', icon: '➕' },
  { href: '/marketing/relatorio', label: 'Relatório', icon: '📊' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

const CLEANER_NAV = [
  { href: '/minha-agenda', label: 'Minha agenda', icon: '📱' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const platform = await getPlatformAdmin();
  const { data: companyId } = await supabase.rpc('current_company_id');
  if (!companyId && platform) redirect('/admin');
  const { data: membership } = companyId
    ? await supabase
        .from('memberships')
        .select('full_name, role, companies(name, account_status)')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .single()
    : { data: null };

  // Registra a primeira entrada e a última atividade da pessoa
  if (companyId) {
    await supabase.rpc('touch_my_membership');
  }

  // Empresas em que a pessoa tem vínculo ativo (agência de marketing pode ter várias)
  const { data: vinculos } = await supabase
    .from('memberships')
    .select('company_id, role, companies(name)')
    .eq('user_id', user.id)
    .eq('active', true);

  const empresas = (vinculos ?? []).map((v: any) => ({
    id: v.company_id,
    name: v.companies?.name ?? 'Empresa',
    role: v.role,
  }));

  const accountStatus = (membership as any)?.companies?.account_status ?? 'ativa';
  if (accountStatus === 'suspensa' || accountStatus === 'cancelada') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-900 p-5">
        <div className="card max-w-md text-center">
          <p className="text-2xl font-bold text-brand-900">Acesso temporariamente suspenso</p>
          <p className="mt-3 text-brand-800">
            O acesso desta conta está suspenso. Seus dados estão preservados. Entre em contato com o
            suporte do CleanFlow para regularizar.
          </p>
          <form action="/api/logout" method="post" className="mt-5">
            <button className="btn-ghost w-full">Sair</button>
          </form>
        </div>
      </main>
    );
  }

  const companyName = (membership as any)?.companies?.name ?? 'Sua empresa';
  const role = (membership as any)?.role ?? 'cleaner';
  const nav = role === 'cleaner' ? CLEANER_NAV : role === 'marketing' ? MARKETING_NAV : MANAGER_NAV;

  return (
    <AppShell
      nav={nav}
      companyName={companyName}
      personName={(membership as any)?.full_name ?? null}
      companyId={(companyId as string) ?? null}
      empresas={empresas}
      isPlatformAdmin={Boolean(platform)}
    >
      {children}
    </AppShell>
  );
}
