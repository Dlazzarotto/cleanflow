import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/platform';

const MANAGER_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/calendario', label: 'Calendário', icon: '🗓️' },
  { href: '/estimates', label: 'Estimates', icon: '🧮' },
  { href: '/agendamentos', label: 'Agendamentos', icon: '📋' },
  { href: '/clientes', label: 'Clientes', icon: '👤' },
  { href: '/regularizacao', label: 'Regularização', icon: '✅' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/equipes', label: 'Equipes', icon: '🧹' },
  { href: '/ocorrencias', label: 'Ocorrências', icon: '⚠️' },
  { href: '/relatorios', label: 'Relatórios', icon: '📈' },
  { href: '/mapa', label: 'Mapa', icon: '🗺️' },
  { href: '/minha-agenda', label: 'Minha agenda', icon: '📱' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

const MARKETING_NAV = [
  { href: '/marketing', label: 'Meus leads', icon: '🌱' },
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-brand-900 text-white md:w-64 md:shrink-0 print:hidden">
        <div className="p-5">
          <p className="text-2xl font-bold">
            Clean<span className="text-aqua-400">Flow</span>
          </p>
          <p className="mt-1 text-brand-100 text-sm">{companyName}</p>
          {(membership as any)?.full_name && (
            <p className="text-brand-100 text-sm">{(membership as any).full_name}</p>
          )}
        </div>
        <nav className="flex overflow-x-auto md:block">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-touch items-center gap-3 px-5 py-3 hover:bg-brand-800 whitespace-nowrap"
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        {platform && (
          <Link
            href="/admin"
            className="mx-5 mt-3 flex min-h-touch items-center justify-center gap-2 rounded-card border border-aqua-400 px-4 text-aqua-400"
          >
            ⚙️ Painel CleanFlow
          </Link>
        )}
        <form action="/api/logout" method="post" className="p-5">
          <button className="btn-ghost w-full !border-brand-100 !text-brand-100 hover:!bg-brand-800">
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
