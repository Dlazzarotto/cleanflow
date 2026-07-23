import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/agendamentos', label: 'Agendamentos', icon: '🗓️' },
  { href: '/clientes', label: 'Clientes', icon: '👤' },
  { href: '/equipes', label: 'Equipes', icon: '🧹' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, companies(name)')
    .eq('id', user.id)
    .single();

  const companyName =
    (profile as any)?.companies?.name ?? 'Sua empresa';

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) / topo (mobile) */}
      <aside className="bg-brand-900 text-white md:w-64 md:shrink-0">
        <div className="p-5">
          <p className="text-2xl font-bold">
            Clean<span className="text-aqua-400">Flow</span>
          </p>
          <p className="mt-1 text-brand-100 text-sm">{companyName}</p>
        </div>
        <nav className="flex overflow-x-auto md:block">
          {NAV.map((item) => (
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
        <form action="/api/logout" method="post" className="p-5">
          <button className="btn-ghost w-full !border-brand-100 !text-brand-100 hover:!bg-brand-800">
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
