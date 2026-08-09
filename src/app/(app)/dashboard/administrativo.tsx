import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function pct(a: number, b: number) {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

/** 📊 ADMINISTRATIVO — o negócio inteiro. */
export default async function DashboardAdministrativo() {
  const supabase = createClient();

  const [{ data: dados }, { data: evolucao }, { data: equipes }, { data: pessoas }] =
    await Promise.all([
      supabase.rpc('dash_geral'),
      supabase.rpc('dash_evolucao'),
      supabase.from('teams').select('id, name, color').eq('active', true).order('name'),
      supabase
        .from('work_shifts')
        .select('person_name, started_at, ended_at')
        .gte('started_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .not('ended_at', 'is', null),
    ]);

  const d = (Array.isArray(dados) ? dados[0] : dados) ?? {};
  const meses = (evolucao ?? []) as any[];

  const receita = Number(d.receita_mes ?? 0);
  const anterior = Number(d.mes_anterior ?? 0);
  const variacao = pct(receita, anterior);

  const resid = Number(d.receita_residencial ?? 0);
  const comer = Number(d.receita_comercial ?? 0);
  const totalMix = resid + comer;

  // Horas por pessoa nos últimos 30 dias
  const horasPessoa = new Map<string, number>();
  for (const s of (pessoas ?? []) as any[]) {
    const h = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
    if (h <= 0 || h > 16) continue;
    horasPessoa.set(s.person_name, (horasPessoa.get(s.person_name) ?? 0) + h);
  }
  const ranking = Array.from(horasPessoa.entries()).sort((a, b) => b[1] - a[1]);


  return (
    <div>
      {/* Dinheiro */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Dinheiro neste mês</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Faturado"
          valor={usd(receita)}
          nota={
            variacao !== null
              ? `${variacao >= 0 ? '↑' : '↓'} ${Math.abs(variacao)}% vs mês anterior`
              : 'primeiro mês'
          }
          cor="escuro"
          icone="📈"
        />
        <StatCard
          rotulo="Recebido"
          valor={usd(Number(d.recebido_mes ?? 0))}
          nota="faturas pagas no mês"
          cor="ok"
          icone="✅"
          href="/faturas?status=paga"
        />
        <StatCard
          rotulo="A receber"
          valor={usd(Number(d.a_receber ?? 0))}
          nota={
            Number(d.vencido ?? 0) > 0 ? `${usd(Number(d.vencido))} já vencido` : 'nada vencido'
          }
          cor={Number(d.vencido ?? 0) > 0 ? 'alerta' : 'neutro'}
          icone="⏳"
          href="/faturas"
        />
        <StatCard
          rotulo="Receita por hora"
          valor={usd(Number(d.receita_por_hora ?? 0))}
          nota={`${Number(d.horas_trabalhadas ?? 0)}h em campo`}
          icone="⚡"
          href="/relatorios"
        />
      </div>

      {/* Composição */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <p className="mb-3 text-xl font-semibold text-brand-900">
            De onde vem a receita
          </p>
          {totalMix === 0 ? (
            <p className="text-brand-800">Nenhuma limpeza concluída neste mês ainda.</p>
          ) : (
            <>
              <div className="flex h-8 overflow-hidden rounded-card">
                {resid > 0 && (
                  <div
                    className="flex items-center justify-center bg-brand-700 text-xs font-medium text-white"
                    style={{ width: `${(resid / totalMix) * 100}%` }}
                  >
                    {Math.round((resid / totalMix) * 100)}%
                  </div>
                )}
                {comer > 0 && (
                  <div
                    className="flex items-center justify-center bg-aqua-500 text-xs font-medium text-white"
                    style={{ width: `${(comer / totalMix) * 100}%` }}
                  >
                    {Math.round((comer / totalMix) * 100)}%
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-card bg-brand-50 p-3">
                  <p className="text-sm text-brand-800">
                    <span className="mr-1 inline-block h-3 w-3 rounded bg-brand-700" />
                    🏠 Residencial
                  </p>
                  <p className="text-2xl font-bold text-brand-900">{usd(resid)}</p>
                  <p className="text-sm text-brand-800">
                    {d.clientes_residencial ?? 0} cliente(s)
                  </p>
                </div>
                <div className="rounded-card bg-brand-50 p-3">
                  <p className="text-sm text-brand-800">
                    <span className="mr-1 inline-block h-3 w-3 rounded bg-aqua-500" />
                    🏢 Comercial
                  </p>
                  <p className="text-2xl font-bold text-brand-900">{usd(comer)}</p>
                  <p className="text-sm text-brand-800">
                    {d.clientes_comercial ?? 0} contrato(s)
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <p className="mb-3 text-xl font-semibold text-brand-900">A empresa hoje</p>
          <div className="space-y-2">
            {[
              ['Clientes ativos', d.clientes_ativos ?? 0],
              ['Limpezas no mês', d.limpezas_mes ?? 0],
              ['Pessoas com acesso', d.pessoas_ativas ?? 0],
              ['Equipes', d.equipes ?? 0],
              ['Novos clientes no mês', `+${d.novos_clientes_mes ?? 0}`],
            ].map(([rotulo, valor]) => (
              <div
                key={String(rotulo)}
                className="flex items-center justify-between border-b border-brand-100 pb-2 last:border-0"
              >
                <span className="text-brand-800">{rotulo}</span>
                <span className="text-xl font-bold text-brand-900">{valor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evolução */}
      {meses.length > 0 && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-brand-900">Evolução (6 meses)</h2>
          <div className="card mb-6">
            <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ height: 200 }}>
              {meses.map((m) => {
                const total = Number(m.residencial) + Number(m.comercial);
                const maxTotal = Math.max(
                  ...meses.map((x) => Number(x.residencial) + Number(x.comercial)),
                  1
                );
                const alturaR = (Number(m.residencial) / maxTotal) * 150;
                const alturaC = (Number(m.comercial) / maxTotal) * 150;
                return (
                  <div key={m.mes} className="flex min-w-16 flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-medium text-brand-900">
                      {total > 0 ? usd(total) : ''}
                    </span>
                    <div className="flex w-full flex-col justify-end" style={{ height: 150 }}>
                      {Number(m.comercial) > 0 && (
                        <div
                          className="w-full rounded-t bg-aqua-500"
                          style={{ height: Math.max(alturaC, 3) }}
                          title={`Comercial: ${usd(Number(m.comercial))}`}
                        />
                      )}
                      {Number(m.residencial) > 0 && (
                        <div
                          className="w-full bg-brand-700"
                          style={{ height: Math.max(alturaR, 3) }}
                          title={`Residencial: ${usd(Number(m.residencial))}`}
                        />
                      )}
                    </div>
                    <span className="text-xs text-brand-800">
                      {new Date(m.mes + 'T12:00:00').toLocaleDateString('pt-BR', {
                        month: 'short',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-brand-800">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-brand-700" /> residencial
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-aqua-500" /> comercial
              </span>
            </div>
          </div>
        </>
      )}

      {/* Equipe e pendências */}
      <div className="grid gap-4 lg:grid-cols-2">
        {ranking.length > 0 && (
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">
              Horas em campo (30 dias)
            </p>
            <div className="space-y-2">
              {ranking.map(([nome, horas]) => {
                const maior = ranking[0][1];
                return (
                  <div key={nome}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-brand-900">{nome}</span>
                      <span className="text-brand-800">{horas.toFixed(1)}h</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-100">
                      <div
                        className="h-full bg-brand-700"
                        style={{ width: `${(horas / maior) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card">
          <p className="mb-3 text-xl font-semibold text-brand-900">Precisa de atenção</p>
          <div className="space-y-2">
            {Number(d.vencido ?? 0) > 0 && (
              <Link href="/faturas?status=vencida" className="block rounded-card bg-red-50 p-3 hover:opacity-90">
                <span className="font-medium text-red-800">
                  💸 {usd(Number(d.vencido))} em faturas vencidas
                </span>
                <span className="block text-sm text-brand-800">Toque para cobrar</span>
              </Link>
            )}
            {Number(d.ocorrencias_abertas ?? 0) > 0 && (
              <Link href="/ocorrencias" className="block rounded-card bg-sun/15 p-3 hover:opacity-90">
                <span className="font-medium text-brand-900">
                  ⚠️ {d.ocorrencias_abertas} ocorrência(s) em aberto
                </span>
                <span className="block text-sm text-brand-800">Aguardando tratativa</span>
              </Link>
            )}
            {Number(d.vencido ?? 0) === 0 && Number(d.ocorrencias_abertas ?? 0) === 0 && (
              <p className="text-brand-800">✅ Nada pendente. Operação em ordem.</p>
            )}
          </div>

          <div className="mt-4 border-t border-brand-100 pt-4">
            <p className="mb-2 font-semibold text-brand-900">Relatórios</p>
            <div className="space-y-2">
              <Link href="/relatorios" className="btn-ghost block text-center">
                📈 Produtividade das equipes
              </Link>
              <Link href="/marketing/relatorio" className="btn-ghost block text-center">
                📣 Funil de marketing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
