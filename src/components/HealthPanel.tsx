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
  const [{ data }, { data: abertas }] = await Promise.all([
    supabase.rpc('operation_health'),
    supabase
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, clients(full_name), teams(name)')
      .eq('status', 'em_andamento')
      .order('scheduled_at'),
  ]);

  const itens = (data ?? []) as any[];

  // Limpezas que passaram bem do tempo previsto — equipe pode ter esquecido o check-out
  const esquecidas = ((abertas ?? []) as any[]).filter((b) => {
    const fimPrevisto = new Date(b.scheduled_at).getTime() + (b.duration_minutes + 90) * 60000;
    return Date.now() > fimPrevisto;
  });

  if (itens.length === 0 && esquecidas.length === 0) return null;

  const altas = itens.filter((i) => i.gravidade === 'alta');
  const medias = itens.filter((i) => i.gravidade !== 'alta');

  return (
    <>
    {esquecidas.length > 0 && (
      <div className="card mb-6 border-2 border-sun">
        <p className="mb-1 text-xl font-semibold text-brand-900">
          ⏰ Limpezas sem check-out
        </p>
        <p className="mb-3 text-brand-800">
          Passaram do tempo previsto e continuam abertas. Pode ser esquecimento da equipe — a fatura
          só nasce depois do check-out.
        </p>
        <div className="space-y-2">
          {esquecidas.map((b: any) => (
            <div key={b.id} className="rounded-card bg-sun/15 p-3">
              <span className="font-medium text-brand-900">
                {b.clients?.full_name ?? 'Limpeza'}
              </span>
              <span className="block text-sm text-brand-800">
                {b.teams?.name ? `${b.teams.name} · ` : ''}
                começou {new Date(b.scheduled_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {itens.length > 0 && (
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
    )}
    </>
  );
}
