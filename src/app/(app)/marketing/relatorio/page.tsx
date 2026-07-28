import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireMarketingAccess, isManager } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function pct(n: number, total: number) {
  if (total === 0) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

function usd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function RelatorioMarketingPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const { role } = await requireMarketingAccess();
  const verValores = isManager(role);

  const dias = [30, 90, 365].includes(Number(searchParams.dias)) ? Number(searchParams.dias) : 90;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const supabase = createClient();
  const [{ data: clientRows }, { data: estimateRows }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, status, source, lost_reason, marketing_opt_in, last_contact_at, created_at'),
    supabase
      .from('estimates')
      .select('id, client_id, status, final_price, price_low, created_at')
      .gte('created_at', desde),
  ]);

  const clients = clientRows ?? [];
  const estimates = estimateRows ?? [];
  const novos = clients.filter((c: any) => c.created_at >= desde);

  // ---- Funil do período ----
  const enviados = estimates.filter((e: any) => ['enviado', 'aprovado', 'recusado'].includes(e.status));
  const aprovados = estimates.filter((e: any) => e.status === 'aprovado');
  const recusados = estimates.filter((e: any) => e.status === 'recusado');
  const pendentes = estimates.filter((e: any) => e.status === 'enviado');
  const receitaGanha = aprovados.reduce(
    (s: number, e: any) => s + Number(e.final_price ?? e.price_low ?? 0),
    0
  );
  const receitaEmJogo = pendentes.reduce(
    (s: number, e: any) => s + Number(e.final_price ?? e.price_low ?? 0),
    0
  );

  // ---- Situação atual da carteira ----
  const porStatus = clients.reduce<Record<string, number>>((acc: any, c: any) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  // ---- Origens: quantos leads e quantos viraram cliente ----
  const origens = new Map<string, { total: number; ativos: number; perdidos: number }>();
  for (const c of clients as any[]) {
    if (c.status === 'deletado') continue;
    const key = (c.source ?? '').trim() || 'Sem origem registrada';
    const o = origens.get(key) ?? { total: 0, ativos: 0, perdidos: 0 };
    o.total += 1;
    if (c.status === 'ativo') o.ativos += 1;
    if (c.status === 'perdido') o.perdidos += 1;
    origens.set(key, o);
  }
  const origensOrdenadas = Array.from(origens.entries())
    .map(([nome, o]) => ({ nome, ...o, taxa: o.total > 0 ? o.ativos / o.total : 0 }))
    .sort((a, b) => b.total - a.total);

  // ---- Motivos de perda ----
  const motivos = new Map<string, number>();
  for (const c of clients as any[]) {
    if (c.status !== 'perdido' && c.status !== 'inativo') continue;
    const m = (c.lost_reason ?? '').trim();
    if (!m) continue;
    const key = m.length > 60 ? m.slice(0, 60) + '…' : m;
    motivos.set(key, (motivos.get(key) ?? 0) + 1);
  }
  const motivosOrdenados = Array.from(motivos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // ---- Follow-up: quem está parado há mais tempo ----
  const semContato = (clients as any[])
    .filter((c) => ['lead', 'em_espera'].includes(c.status) && c.marketing_opt_in)
    .map((c) => ({
      ...c,
      diasParado: Math.floor(
        (Date.now() - new Date(c.last_contact_at ?? c.created_at).getTime()) / 86400000
      ),
    }))
    .sort((a, b) => b.diasParado - a.diasParado)
    .slice(0, 10);

  const contatosNoPeriodo = (clients as any[]).filter(
    (c) => c.last_contact_at && c.last_contact_at >= desde
  ).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">📊 Relatório de marketing</h1>
        <div className="flex gap-2">
          {[30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/marketing/relatorio?dias=${d}`}
              className={d === dias ? 'btn-primary' : 'btn-ghost'}
            >
              {d === 365 ? '1 ano' : `${d} dias`}
            </Link>
          ))}
        </div>
      </div>

      {/* Funil */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Funil do período</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card">
          <p className="text-brand-800">Novos leads</p>
          <p className="text-3xl font-bold">{novos.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Estimates enviados</p>
          <p className="text-3xl font-bold">{enviados.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Aguardando resposta</p>
          <p className="text-3xl font-bold">{pendentes.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Fechados</p>
          <p className="text-3xl font-bold text-brand-700">{aprovados.length}</p>
          <p className="text-sm text-brand-800">
            {pct(aprovados.length, enviados.length)} dos enviados
          </p>
        </div>
        <div className="card">
          <p className="text-brand-800">Não fecharam</p>
          <p className="text-3xl font-bold">{recusados.length}</p>
        </div>
      </div>

      {verValores && (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="text-brand-800">Receita por limpeza conquistada no período</p>
            <p className="text-3xl font-bold text-brand-900">{usd(receitaGanha)}</p>
            <p className="text-sm text-brand-800">soma do valor fechado dos estimates aprovados</p>
          </div>
          <div className="card">
            <p className="text-brand-800">Em jogo (aguardando resposta)</p>
            <p className="text-3xl font-bold text-sun">{usd(receitaEmJogo)}</p>
            <p className="text-sm text-brand-800">valor dos estimates enviados sem resposta</p>
          </div>
        </div>
      )}

      {/* Carteira */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Situação da carteira hoje</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['🌱 Leads', 'lead'],
          ['🟢 Ativos', 'ativo'],
          ['🟡 Em espera', 'em_espera'],
          ['⚪ Ex-clientes', 'inativo'],
          ['💤 Não fecharam', 'perdido'],
        ].map(([label, key]) => (
          <div key={key} className="card">
            <p className="text-brand-800">{label}</p>
            <p className="text-3xl font-bold">{porStatus[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Origens */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">De onde vêm os clientes</h2>
      {origensOrdenadas.length === 0 ? (
        <div className="card mb-8 text-brand-800">
          Nenhuma origem registrada ainda. Preencha o campo &quot;Origem&quot; ao cadastrar um lead
          para saber qual canal traz mais clientes.
        </div>
      ) : (
        <div className="card mb-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-100 text-brand-800">
                <th className="py-2">Origem</th>
                <th className="py-2">Total</th>
                <th className="py-2">Viraram clientes</th>
                <th className="py-2">Não fecharam</th>
                <th className="py-2">Taxa de conversão</th>
              </tr>
            </thead>
            <tbody>
              {origensOrdenadas.map((o) => (
                <tr key={o.nome} className="border-b border-brand-100 last:border-0">
                  <td className="py-2 font-medium">{o.nome}</td>
                  <td className="py-2">{o.total}</td>
                  <td className="py-2">{o.ativos}</td>
                  <td className="py-2">{o.perdidos}</td>
                  <td className="py-2 font-semibold text-brand-900">{pct(o.ativos, o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Motivos de perda */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Por que não fecham</h2>
      {motivosOrdenados.length === 0 ? (
        <div className="card mb-8 text-brand-800">
          Nenhum motivo registrado. Anote o motivo na aba Marketing quando um orçamento não fechar —
          é o dado que mostra se o problema é preço, frequência ou timing.
        </div>
      ) : (
        <div className="card mb-8 space-y-2">
          {motivosOrdenados.map(([motivo, n]) => (
            <div key={motivo} className="flex items-center justify-between gap-3">
              <span>{motivo}</span>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-900">
                {n}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">
        Prioridade de follow-up
      </h2>
      <p className="mb-3 text-brand-800">
        {contatosNoPeriodo} contato(s) registrados no período. Quem está esperando há mais tempo:
      </p>
      {semContato.length === 0 ? (
        <div className="card text-brand-800">Ninguém parado — carteira em dia. 🎉</div>
      ) : (
        <div className="card space-y-2">
          {semContato.map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 pb-2 last:border-0">
              <Link href={`/clientes/${c.id}`} className="font-medium text-brand-900 hover:underline">
                {c.full_name}
              </Link>
              <span className="text-sm text-brand-800">
                {c.status === 'lead' ? '🌱 lead' : '🟡 aguardando resposta'} · parado há{' '}
                <strong>{c.diasParado} dias</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
