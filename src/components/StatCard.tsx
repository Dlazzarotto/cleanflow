import Link from 'next/link';

export interface StatProps {
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: 'destaque' | 'ok' | 'alerta' | 'neutro' | 'escuro';
  href?: string;
  icone?: string;
}

const CORES: Record<string, string> = {
  destaque: 'text-brand-900',
  ok: 'text-brand-700',
  alerta: 'text-red-700',
  neutro: 'text-brand-900',
  escuro: 'text-aqua-400',
};

/** Indicador simples, com link opcional para a tela que detalha. */
export default function StatCard({ rotulo, valor, nota, cor = 'neutro', href, icone }: StatProps) {
  const escuro = cor === 'escuro';
  const conteudo = (
    <div
      className={`card h-full ${escuro ? 'bg-brand-900 !border-brand-900' : ''} ${
        href ? 'transition hover:border-aqua-500' : ''
      }`}
    >
      <p className={`text-sm ${escuro ? 'text-brand-100' : 'text-brand-800'}`}>
        {icone ? `${icone} ` : ''}
        {rotulo}
      </p>
      <p className={`text-3xl font-bold ${CORES[cor]}`}>{valor}</p>
      {nota && (
        <p className={`mt-1 text-xs ${escuro ? 'text-brand-100' : 'text-brand-800'}`}>{nota}</p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
