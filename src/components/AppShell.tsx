'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CompanySwitcher, { type CompanyOption } from '@/components/CompanySwitcher';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export default function AppShell({
  nav,
  companyName,
  personName,
  companyId,
  empresas,
  isPlatformAdmin,
  children,
}: {
  nav: NavItem[];
  companyName: string;
  personName: string | null;
  companyId: string | null;
  empresas: CompanyOption[];
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // Fecha o menu ao trocar de página
  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  // Impede a página de rolar por trás do menu aberto
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberto]);

  const atual = nav.find((n) => caminho === n.href || caminho.startsWith(n.href + '/'));

  const conteudoMenu = (
    <>
      <div className="p-5">
        <p className="text-2xl font-bold">
          Clean<span className="text-aqua-400">Flow</span>
        </p>
        <p className="mt-1 text-sm text-brand-100">{companyName}</p>
        {personName && <p className="text-sm text-brand-100">{personName}</p>}
      </div>

      {companyId && <CompanySwitcher empresas={empresas} atual={companyId} />}

      <nav className="flex-1 overflow-y-auto pb-4">
        {nav.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-touch items-center gap-3 px-5 py-3 whitespace-nowrap ${
                ativo ? 'bg-brand-800 font-semibold text-white' : 'hover:bg-brand-800'
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isPlatformAdmin && (
        <Link
          href="/admin"
          className="mx-5 mb-3 flex min-h-touch items-center justify-center gap-2 rounded-card border border-aqua-400 px-4 text-aqua-400"
        >
          ⚙️ Painel CleanFlow
        </Link>
      )}

      <a
        href="/instalar"
        className="mx-5 mb-3 flex min-h-touch items-center justify-center gap-2 rounded-card border border-brand-100/40 px-4 text-brand-100"
      >
        📲 Instalar no celular
      </a>

      <form action="/api/logout" method="post" className="px-5 pb-5">
        <button className="btn-ghost w-full !border-brand-100 !text-brand-100 hover:!bg-brand-800">
          Sair
        </button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Barra superior — só no celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-900 px-4 py-3 text-white md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="flex h-11 w-11 items-center justify-center rounded-card hover:bg-brand-800"
        >
          <span className="flex flex-col gap-[5px]">
            <span className="block h-[3px] w-6 rounded bg-white" />
            <span className="block h-[3px] w-6 rounded bg-white" />
            <span className="block h-[3px] w-6 rounded bg-white" />
          </span>
        </button>

        <span className="min-w-0 flex-1 px-2 text-center">
          <span className="block truncate font-semibold">
            {atual ? `${atual.icon} ${atual.label}` : 'CleanFlow'}
          </span>
        </span>

        <span className="h-11 w-11" aria-hidden />
      </header>

      {/* Menu deslizante no celular */}
      {aberto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-brand-900 text-white shadow-2xl md:hidden">
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-card text-2xl text-brand-100 hover:bg-brand-800"
            >
              ×
            </button>
            {conteudoMenu}
          </aside>
        </>
      )}

      {/* Menu fixo no computador */}
      <aside className="hidden bg-brand-900 text-white md:flex md:w-64 md:shrink-0 md:flex-col print:hidden">
        {conteudoMenu}
      </aside>

      <main className="flex-1 p-5 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
