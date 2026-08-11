import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { SEGMENT_LABEL, SEGMENT_ICON } from '@/lib/commercial';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

const SITUACAO: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-brand-100 text-brand-900' },
  enviado: { label: 'Enviada', cls: 'bg-sun/30 text-brand-900' },
  aprovado: { label: 'Aprovada ✓', cls: 'bg-aqua-500 text-white' },
  recusado: { label: 'Recusada', cls: 'bg-brand-50 text-brand-800' },
};

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: { situacao?: string };
}) {
  await requireManager();
  const supabase = createClient();

  const filtro = ['aberta', 'aprovado', 'recusado', 'todas'].includes(searchParams.situacao ?? '')
    ? searchParams.situacao!
    : 'aberta';

  const statuses =
    filtro === 'aberta'
      ? ['rascunho', 'enviado']
      : filtro === 'todas'
        ? ['rascunho', 'enviado', 'aprovado', 'recusado']
        : [filtro];

  const [{ data: propostas }, { data: todas }] = await Promise.all([
    supabase
      .from('commercial_estimates')
      .select('*, clients(full_name)')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('commercial_estimates').select('status, price_monthly, final_monthly'),
  ]);

  const lista = (propostas ?? []) as any[];
  const geral = (todas ?? []) as any[];

  const contar = (sts: string[]) => geral.filter((p) => sts.includes(p.status)).length;
  const aprovadas = geral.filter((p) => p.status === 'aprovado');
  const valorAprovado = aprovadas.reduce(
    (s, p) => s + Number(p.final_monthly ?? p.price_monthly),
    0
  );
  const emAberto = geral.filter((p) => ['rascunho', 'enviado'].includes(p.status));
  const valorEmJogo = emAberto.reduce((s, p) => s + Number(p.final_monthly ?? p.price_monthly), 0);

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">🧮 Propostas comerciais</h1>
          <p className="text-brand-800">Orçamento por área, item e grau de sujeira</p>
        </div>
        <Link href="/comercial/propostas/nova" className="btn-primary">+ Nova proposta</Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Em negociação</p>
          <p className="text-3xl font-bold text-sun">{emAberto.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Valor em jogo</p>
          <p className="text-3xl font-bold text-brand-900">{usd(valorEmJogo)}</p>
          <p className="text-xs text-brand-800">por mês, se todas fecharem</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Aprovadas</p>
          <p className="text-3xl font-bold text-brand-700">{aprovadas.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Receita conquistada</p>
          <p className="text-3xl font-bold text-brand-700">{usd(valorAprovado)}</p>
          <p className="text-xs text-brand-800">por mês</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { chave: 'aberta', rotulo: 'Em aberto', sts: ['rascunho', 'enviado'] },
          { chave: 'aprovado', rotulo: 'Aprovadas', sts: ['aprovado'] },
          { chave: 'recusado', rotulo: 'Recusadas', sts: ['recusado'] },
          { chave: 'todas', rotulo: 'Todas', sts: ['rascunho', 'enviado', 'aprovado', 'recusado'] },
        ].map((g) => (
          <Link
            key={g.chave}
            href={`/comercial/propostas?situacao=${g.chave}`}
            className={`flex min-h-touch items-center rounded-card border px-4 py-2 font-medium ${
              filtro === g.chave
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            {g.rotulo} ({contar(g.sts)})
          </Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="card text-brand-800">
          Nenhuma proposta neste filtro.{' '}
          <Link href="/comercial/propostas/nova" className="font-semibold text-brand-700 underline">
            Criar a primeira
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((p) => {
            const s = SITUACAO[p.status] ?? SITUACAO.rascunho;
            const valor = Number(p.final_monthly ?? p.price_monthly);
            return (
              <Link
                key={p.id}
                href={`/comercial/propostas/${p.id}`}
                className="card block hover:border-aqua-500"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-brand-900">
                      {SEGMENT_ICON[p.segment] ?? '🏢'}{' '}
                      {p.clients?.full_name ?? p.lead_name ?? 'Sem nome'}
                    </p>
                    <p className="text-brand-800">
                      {SEGMENT_LABEL[p.segment]?.replace(/^\S+\s/, '') ?? p.segment}
                      {p.address ? ` · ${p.address}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <span className={`rounded-full px-3 py-1 font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">
                        {Math.round(Number(p.total_minutes) / 60)}h por visita
                      </span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-brand-900">{usd(valor)}</p>
                    <p className="text-sm text-brand-800">por mês</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
