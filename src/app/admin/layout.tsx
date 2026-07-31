import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/platform';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName, email } = await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-ink text-white md:w-64 md:shrink-0">
        <div className="p-5">
          <p className="text-2xl font-bold">
            Clean<span className="text-aqua-400">Flow</span>
          </p>
          <p className="mt-1 text-sm text-brand-100">Administração da plataforma</p>
          <p className="mt-3 text-sm text-brand-100">{fullName}</p>
          <p className="text-xs text-brand-100 opacity-70">{email}</p>
        </div>
        <nav className="flex overflow-x-auto md:block">
          <Link href="/admin" className="flex min-h-touch items-center gap-3 px-5 py-3 hover:bg-brand-900 whitespace-nowrap">
            🏢 Empresas
          </Link>
          <Link href="/dashboard" className="flex min-h-touch items-center gap-3 px-5 py-3 hover:bg-brand-900 whitespace-nowrap">
            ↩︎ Ir para o app
          </Link>
        </nav>
        <form action="/api/logout" method="post" className="p-5">
          <button className="btn-ghost w-full !border-brand-100 !text-brand-100 hover:!bg-brand-900">
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
