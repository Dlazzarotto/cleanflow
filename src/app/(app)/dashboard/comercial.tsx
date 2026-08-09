import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SEGMENT_LABEL, SEGMENT_ICON } from '@/lib/commercial';
import StatCard from '@/components/StatCard';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function corNota(p: number) {
  if (p >= 90) return 'bg-aqua-500 text-white';
  if (p >= 75) return 'bg-aqua-400 text-white';
  if (p >= 60) return 'bg-sun text-brand-900';
  if (p > 0) return 'bg-red-700 text-white';
  return 'bg-brand-100 text-brand-900';
}

function diasAtras(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** 🏢 COMERCIAL — contratos e qualidade. */
export default async function DashboardComercial() {
  const supabase = createClient();

  const [{ data: dados }, { data: contratos }, { data: inspecoes }, { data: criticos }] =
    await Promise.all([
      supabase.rpc('dash_comercial'),
      supabase
        .from('clients')
        .select('id, full_name, business_segment, billing_type, monthly_contract_value, default_price, frequency, area_sqft, payment_terms')
        .eq('client_type', 'comercial')
        .eq('status', 'ativo')
        .order('full_name'),
      supabase
        .from('inspections')
        .select('id, client_id, percent, status, created_at, clients(full_name)')
        .in('status', ['concluida', 'enviada'])
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('inspection_results')
        .select('area, item, rating, inspections(client_id, created_at, clients(full_name, client_type))')
        .lte('rating', 2)
        .not('rating', 'is', null)
        .order('id', { ascending: false })
        .limit(60),
    ]);

  const d = (Array.isArray(dados) ? dados[0] : dados) ?? {};
  const lista = (contratos ?? []) as any[];
  const insp = (inspecoes ?? []) as any[];

  // Última inspeção por cliente
  const ultimaPorCliente = new Map<string, any>();
  for (const i of insp) {
    if (i.client_id && !ultimaPorCliente.has(i.client_id)) ultimaPorCliente.set(i.client_id, i);
  }

  // Valor mensal de cada contrato
  function mensal(c: any) {
    if (c.billing_type === 'mensal_fixo') return Number(c.monthly_contract_value ?? 0);
    const mult: Record<string, number> = {
      semanal: 4.3,
      quinzenal: 2.15,
      tres_semanas: 1.43,
      mensal: 1,
    };
    return Number(c.default_price ?? 0) * (mult[c.frequency ?? 'mensal'] ?? 1);
  }

  // Contratos por segmento
  const porSegmento = new Map<string, { qtd: number; valor: number }>();
  for (const c of lista) {
    const seg = c.business_segment ?? 'outro';
    const atual = porSegmento.get(seg) ?? { qtd: 0, valor: 0 };
    atual.qtd += 1;
    atual.valor += mensal(c);
    porSegmento.set(seg, atual);
  }

  // Problemas que se repetem
  const recorrentes = new Map<string, number>();
  for (const r of (criticos ?? []) as any[]) {
    if ((r.inspections as any)?.clients?.client_type !== 'comercial') continue;
    const chave = `${r.area} — ${r.item}`;
    recorrentes.set(chave, (recorrentes.get(chave) ?? 0) + 1);
  }
  const topProblemas = Array.from(recorrentes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const nota = Number(d.nota_media ?? 0);

  return (
    <div>
      {/* Receita recorrente */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Receita recorrente"
          valor={usd(Number(d.receita_recorrente ?? 0))}
          nota={`${usd(Number(d.receita_recorrente ?? 0) * 12)} por ano`}
          cor="escuro"
          icone="🔁"
        />
        <StatCard
          rotulo="Contratos ativos"
          valor={String(d.contratos_ativos ?? 0)}
          nota={`${d.segmentos ?? 0} segmento(s) · ${Number(d.area_total ?? 0).toLocaleString('pt-BR')} sq ft`}
          icone="📋"
          href="/clientes"
        />
        <StatCard
          rotulo="Ticket médio"
          valor={usd(Number(d.ticket_medio ?? 0))}
          nota="por contrato"
          icone="💼"
        />
        <StatCard
          rotulo="A receber"
          valor={usd(Number(d.a_receber ?? 0))}
          cor={Number(d.a_receber ?? 0) > 0 ? 'alerta' : 'ok'}
          icone="💰"
          href="/faturas"
        />
      </div>

      {/* Qualidade */}
      <h2 className="mb-3 text-xl font-semibold text-brand-900">Qualidade do serviço</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-brand-800">🔍 Nota média das inspeções</p>
          <span className={`mt-1 inline-block rounded-card px-4 py-2 text-3xl font-bold ${corNota(nota)}`}>
            {nota > 0 ? `${nota}%` : '—'}
          </span>
        </div>
        <StatCard
          rotulo="Inspeções no mês"
          valor={String(d.inspecoes_mes ?? 0)}
          icone="📝"
          href="/inspecoes"
        />
        <StatCard
          rotulo="Sem inspeção há 60 dias"
          valor={String(d.contratos_sem_inspecao ?? 0)}
          nota={Number(d.contratos_sem_inspecao ?? 0) > 0 ? 'risco de perder o contrato' : 'tudo em dia'}
          cor={Number(d.contratos_sem_inspecao ?? 0) > 0 ? 'alerta' : 'ok'}
          icone="⏰"
          href="/inspecoes"
        />
        <StatCard
          rotulo="Pontos críticos (30d)"
          valor={String(d.pontos_criticos ?? 0)}
          nota="notas 1 e 2 nas inspeções"
          cor={Number(d.pontos_criticos ?? 0) > 0 ? 'alerta' : 'ok'}
          icone="⚠️"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contratos */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-semibold text-brand-900">Contratos ativos</p>
              <Link href="/inspecoes" className="btn-ghost">🔍 Nova inspeção</Link>
            </div>

            {lista.length === 0 ? (
              <p className="text-brand-800">
                Nenhum cliente comercial ainda. Marque um cliente como comercial na ficha dele.
              </p>
            ) : (
              <div className="space-y-2">
                {lista.map((c) => {
                  const ultima = ultimaPorCliente.get(c.id);
                  const dias = ultima ? diasAtras(ultima.created_at) : null;
                  const p = ultima?.percent !== null && ultima ? Number(ultima.percent) : 0;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-100 p-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="font-semibold text-brand-900 hover:underline"
                        >
                          {SEGMENT_ICON[c.business_segment] ?? '🏢'} {c.full_name}
                        </Link>
                        <p className="text-sm text-brand-800">
                          {SEGMENT_LABEL[c.business_segment]?.replace(/^\S+\s/, '') ?? 'Comercial'}
                          {c.area_sqft ? ` · ${Number(c.area_sqft).toLocaleString('pt-BR')} sq ft` : ''}
                          {c.payment_terms ? ` · ${c.payment_terms}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {ultima ? (
                          <span className={`rounded-full px-3 py-1 text-sm font-medium ${corNota(p)}`}>
                            {p}% · {dias}d
                          </span>
                        ) : (
                          <span className="rounded-full bg-sun/20 px-3 py-1 text-sm font-medium text-brand-900">
                            sem inspeção
                          </span>
                        )}
                        <span className="text-xl font-bold text-brand-900">
                          {usd(mensal(c))}
                          <span className="text-sm font-medium text-brand-800">/mês</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Segmentos */}
          {porSegmento.size > 0 && (
            <div className="card">
              <p className="mb-3 text-xl font-semibold text-brand-900">Por segmento</p>
              <div className="space-y-2">
                {Array.from(porSegmento.entries())
                  .sort((a, b) => b[1].valor - a[1].valor)
                  .map(([seg, v]) => (
                    <div
                      key={seg}
                      className="flex items-center justify-between border-b border-brand-100 pb-2 last:border-0"
                    >
                      <span className="text-brand-900">
                        {SEGMENT_ICON[seg] ?? '📦'}{' '}
                        {SEGMENT_LABEL[seg]?.replace(/^\S+\s/, '') ?? seg}
                        <span className="ml-1 text-sm text-brand-800">({v.qtd})</span>
                      </span>
                      <span className="font-bold text-brand-900">{usd(v.valor)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Problemas recorrentes */}
          {topProblemas.length > 0 && (
            <div className="card border-2 border-sun">
              <p className="mb-2 text-xl font-semibold text-brand-900">
                🔁 Falhas que se repetem
              </p>
              <p className="mb-3 text-sm text-brand-800">
                Pontos com nota baixa em várias inspeções — vale treinar a equipe.
              </p>
              <div className="space-y-2">
                {topProblemas.map(([nome, qtd]) => (
                  <div key={nome} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-brand-900">{nome}</span>
                    <span className="shrink-0 rounded-full bg-red-700 px-2 py-1 text-xs font-bold text-white">
                      {qtd}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Produção do mês */}
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">Serviço no mês</p>
            <div className="flex items-center justify-between border-b border-brand-100 pb-2">
              <span className="text-brand-800">Limpezas previstas</span>
              <span className="text-xl font-bold">{d.limpezas_mes ?? 0}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-brand-800">Já concluídas</span>
              <span className="text-xl font-bold text-brand-700">{d.concluidas_mes ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
