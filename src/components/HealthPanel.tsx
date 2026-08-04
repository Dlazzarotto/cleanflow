import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const GRAVIDADE: Record<string, string> = {
  alta: 'bg-red-50 text-red-800',
  media: 'bg-sun/15 text-brand-900',
};

const ICONE: Record<string, string> = {
  pessoa: '👤',
  cliente: '📍',
  agenda: '📅',
  cobranca: '💵',
};

const DESTINO: Record<string, string> = {
  pessoa: '/equipes',
  cliente: '/clientes',
  agenda: '/agendamentos',
  cobranca: '/regularizacao',
};

/**
 * Mostra problemas de configuração ANTES de a equipe travar em campo.
 */
export default async function HealthPanel() {
  const supabase = createClient();
  const { data } = await supabase.rpc('operation_health');
  const itens = (data ?? []) as any[];
  if (itens.length === 0) return null;

  const altas = itens.filter((i) => i.gravidade === 'alta');
  const medias = itens.filter((i) => i.gravidade !== 'alta');

  return (
    <div className="card mb-6 border-2 border-sun">
      <p className="mb-1 text-xl font-semibold text-brand-900">
        🔧 Ajustes que evitam problemas em campo
      </p>
      <p className="mb-3 text-brand-800">
        {altas.length > 0
          ? `${altas.length} item(ns) podem travar a equipe hoje.`
          : 'Nada urgente, mas vale resolver.'}
      </p>

      <div className="space-y-2">
        {[...altas, ...medias].slice(0, 12).map((i, idx) => (
          <Link
            key={idx}
            href={DESTINO[i.tipo] ?? '/dashboard'}
            className={`block rounded-card p-3 hover:opacity-90 ${GRAVIDADE[i.gravidade] ?? GRAVIDADE.media}`}
          >
            <span className="font-medium">
              {ICONE[i.tipo] ?? '•'} {i.item}
            </span>
            <span className="block text-sm">{i.detalhe}</span>
          </Link>
        ))}
      </div>

      {itens.length > 12 && (
        <p className="mt-2 text-sm text-brand-800">e mais {itens.length - 12} item(ns).</p>
      )}
    </div>
  );
}
