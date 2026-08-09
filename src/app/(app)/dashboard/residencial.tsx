import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { etTodayRange } from '@/lib/tz';
import { STATUS_LABEL } from '@/lib/types';
import { SERVICE_TYPE_LABEL } from '@/lib/pricing';
import StatCard from '@/components/StatCard';
import DayAgenda, { type AgendaItem } from '@/components/DayAgenda';
import HealthPanel from '@/components/HealthPanel';

const TZ = 'America/New_York';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 🏠 RESIDENCIAL — a operação do dia. */
export default async function DashboardResidencial() {
  const supabase = createClient();
  const { start, end } = etTodayRange();

  const [{ data: dados }, { data: hojeRows }, { data: shifts }] = await Promise.all([
    supabase.rpc('dash_residencial'),
    supabase
      .from('bookings')
      .select('*, clients(full_name, address, client_type), teams(name, color)')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at'),
    supabase
      .from('work_shifts')
      .select('person_name, started_at, ended_at')
      .gte('started_at', start)
      .order('started_at'),
  ]);

  const d = (Array.isArray(dados) ? dados[0] : dados) ?? {};
  const hoje = ((hojeRows ?? []) as any[]).filter(
    (b) => (b.clients?.client_type ?? 'residencial') === 'residencial'
  );
  const emCampo = ((shifts ?? []) as any[]).filter((s) => !s.ended_at);

  const agenda: AgendaItem[] = hoje.map((b) => {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(b.scheduled_at));
    const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
    return {
      id: b.id,
      hora: hora(b.scheduled_at),
      minutoInicio: h * 60 + m,
      duracao: b.duration_minutes ?? 120,
      cliente: b.clients?.full_name ?? 'Cliente',
      endereco: b.clients?.address ?? null,
      equipe: b.teams?.name ?? null,
      cor: b.teams?.color ?? '#13706B',
      status: b.status,
      statusRotulo: STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status,
      valor: Number(b.price) > 0 ? usd(b.price) : null,
      tipo:
        b.service_type && b.service_type !== 'manutencao'
          ? SERVICE_TYPE_LABEL[b.service_type] ?? null
          : null,
    };
  });

  const dataLabel = new Date().toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div>
      <HealthPanel />

      {/* O dia */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Limpezas hoje"
          valor={String(d.limpezas_hoje ?? 0)}
          nota={`${d.concluidas_hoje ?? 0} concluída(s)`}
          cor="escuro"
          icone="🧹"
          href="/agendamentos"
        />
        <StatCard
          rotulo="Previsto hoje"
          valor={usd(Number(d.previsto_hoje ?? 0))}
          nota={`${usd(Number(d.realizado_hoje ?? 0))} já realizado`}
          icone="💵"
        />
        <StatCard
          rotulo="Equipe em campo"
          valor={String(emCampo.length)}
          nota={
            emCampo.length > 0
              ? emCampo.map((s: any) => s.person_name.split(' ')[0]).join(', ')
              : 'ninguém iniciou o dia'
          }
          icone="👷"
          href="/equipes"
        />
        <StatCard
          rotulo="Próximos 7 dias"
          valor={String(d.proxima_semana ?? 0)}
          nota="limpezas agendadas"
          icone="📅"
          href="/calendario"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DayAgenda itens={agenda} dataLabel={dataLabel} />
        </div>

        <div className="space-y-4">
          {/* Carteira */}
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">Carteira residencial</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Clientes ativos</span>
                <span className="text-xl font-bold">{d.clientes_ativos ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Ticket médio</span>
                <span className="text-xl font-bold">{usd(Number(d.ticket_medio ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-100 pb-2">
                <span className="text-brand-800">Novos no mês</span>
                <span className="text-xl font-bold text-brand-700">+{d.novos_no_mes ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-800">Perdidos no mês</span>
                <span className="text-xl font-bold">−{d.perdidos_no_mes ?? 0}</span>
              </div>
            </div>
          </div>

          {/* A receber */}
          <Link
            href="/faturas"
            className={`card block hover:opacity-90 ${
              Number(d.a_receber ?? 0) > 0 ? 'border-2 border-sun' : ''
            }`}
          >
            <p className="text-brand-800">💰 A receber</p>
            <p className="text-3xl font-bold text-brand-900">{usd(Number(d.a_receber ?? 0))}</p>
            <p className="mt-1 text-sm text-brand-800">
              {d.faturas_abertas ?? 0} fatura(s) em aberto · toque para cobrar
            </p>
          </Link>

          {Number(d.sem_valor ?? 0) > 0 && (
            <Link href="/regularizacao" className="card block border-2 border-red-700 hover:opacity-90">
              <p className="font-semibold text-red-800">
                ⚠️ {d.sem_valor} limpeza(s) sem valor
              </p>
              <p className="mt-1 text-sm text-brand-800">
                A fatura não é gerada. Toque para resolver.
              </p>
            </Link>
          )}

          <div className="card">
            <p className="mb-3 font-semibold text-brand-900">Atalhos</p>
            <div className="space-y-2">
              <Link href="/agendamentos/novo" className="btn-primary block text-center">
                + Nova limpeza
              </Link>
              <Link href="/clientes/novo" className="btn-ghost block text-center">
                👤 Novo cliente
              </Link>
              <Link href="/estimates/novo" className="btn-ghost block text-center">
                🧮 Novo orçamento
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
