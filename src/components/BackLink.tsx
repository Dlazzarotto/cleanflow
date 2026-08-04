import Link from 'next/link';

/**
 * Botao de voltar para a tela anterior na hierarquia.
 * Use sempre no topo das paginas internas.
 */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-touch items-center gap-2 font-medium text-brand-700 hover:underline print:hidden"
    >
      ← {label}
    </Link>
  );
}
