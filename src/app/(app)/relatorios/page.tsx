import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { COMPANY_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

/**
 * Relatorios gerenciais (somente gestao — RLS ja garante).
 * Base: limpezas CONCLUIDAS com check-in e check-out registrados.
 * - Tempo real em casa = checkout - checkin
 * - Trajeto = intervalo entre o checkout de uma casa e o checkin da
 *   seguinte, da MESMA equipe no MESMO dia (intervalos > 3h sao
 *   ignorados como pausa/almoco para nao distorcer a media).
 */

interface Row {
  id: string;
  team_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  checkin_at: string | null;
  checkout_at: string | null;
  clients: { lat: number | null; lng: number | null } | null;
  teams: { name: string; color: string } | null;
}

interface TeamStats {
  name: string;
  color: string;
  cleanings: number;
  houseMinutes: number;
  travelMinutes: number;
  travelLegs: number;
  travelMiles: number;
  deviationPctSum: number;
  deviationCount: number;
  revenue: number;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtMin(min: number) {
  if (!isFinite(min) || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

function usd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function localDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TZ }).format(new Date(iso));
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  await requireManager();
  const dias = [30, 90, 180].includes(Number(searchParams.dias)) ? Number(searchParams.dias) : 30;
  const since = new Date(Date.now() - dias * 86400000);

  const supabase = createClient();
  const { data: shiftRows } = await supabase
    .from('work_shifts')
    .select('person_name, started_at, ended_at')
    .gte('started_at', since.toISOString())
    .not('ended_at', 'is', null);

  const { data } = await supabase
    .from('bookings')
    .select('id, team_id, scheduled_at, duration_minutes, price, checkin_at, checkout_at, clients(lat, lng), teams(name, color)')
    .eq('status', 'concluido')
    .gte('scheduled_at', since.toISOString())
    .order('checkin_at');

  const rows = (data ?? []) as unknown as Row[];
  const done = rows.filter((r) => r.checkin_at && r.checkout_at);

  // ---- Agregacao por equipe ----
  const stats = new Map<string, TeamStats>();
  for (const r of done) {
    const key = r.team_id ?? 'sem-equipe';
    const s = stats.get(key) ?? {
      name: r.teams?.name ?? 'Sem equipe',
      color: r.teams?.color ?? '#8AA6A3',
      cleanings: 0,
      houseMinutes: 0,
      travelMinutes: 0,
      travelLegs: 0,
      travelMiles: 0,
      deviationPctSum: 0,
      deviationCount: 0,
      revenue: 0,
    };
    const realMin = (new Date(r.checkout_at!).getTime() - new Date(r.checkin_at!).getTime()) / 60000;
    if (realMin > 0 && realMin < 12 * 60) {
      s.cleanings += 1;
      s.houseMinutes += realMin;
      s.revenue += Number(r.price);
      if (r.duration_minutes > 0) {
        s.deviationPctSum += ((realMin - r.duration_minutes) / r.duration_minutes) * 100;
        s.deviationCount += 1;
      }
    }
    stats.set(key, s);
  }

  // ---- Trajetos: pares consecutivos da mesma equipe no mesmo dia ----
  const byTeamDay = new Map<string, Row[]>();
  for (const r of done) {
    if (!r.team_id) continue;
    const key = `${r.team_id}|${localDay(r.checkin_at!)}`;
    const arr = byTeamDay.get(key) ?? [];
    arr.push(r);
    byTeamDay.set(key, arr);
  }
  byTeamDay.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) => new Date(a.checkin_at!).getTime() - new Date(b.checkin_at!).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gapMin =
        (new Date(curr.checkin_at!).getTime() - new Date(prev.checkout_at!).getTime()) / 60000;
      if (gapMin <= 0 || gapMin > 180) continue; // pausas longas nao contam
      // Mesmo predio/endereco (varias unidades): trajeto zero, nao conta
      if (
        prev.clients?.lat && prev.clients?.lng && curr.clients?.lat && curr.clients?.lng &&
        haversineMiles(prev.clients.lat, prev.clients.lng, curr.clients.lat, curr.clients.lng) < 0.05
      ) continue;
      const s = stats.get(curr.team_id!);
      if (!s) continue;
      s.travelMinutes += gapMin;
      s.travelLegs += 1;
      if (prev.clients?.lat && prev.clients?.lng && curr.clients?.lat && curr.clients?.lng) {
        s.travelMiles += haversineMiles(
          prev.clients.lat, prev.clients.lng, curr.clients.lat, curr.clients.lng
        );
      }
    }
  });

  const teamStats = Array.from(stats.values())
    .filter((s) => s.cleanings > 0)
    .sort((a, b) => b.cleanings - a.cleanings);

  // ---- Totais ----
  const totalCleanings = teamStats.reduce((n, s) => n + s.cleanings, 0);
  const totalHouseMin = teamStats.reduce((n, s) => n + s.houseMinutes, 0);
  const totalTravelMin = teamStats.reduce((n, s) => n + s.travelMinutes, 0);
  const totalRevenue = teamStats.reduce((n, s) => n + s.revenue, 0);
  const productivePct =
    totalHouseMin + totalTravelMin > 0
      ? Math.round((totalHouseMin / (totalHouseMin + totalTravelMin)) * 100)
      : 0;

  // Jornadas por pessoa
  const jornada = new Map<string, { dias: number; minutos: number }>();
  for (const sh of (shiftRows ?? []) as any[]) {
    const min = (new Date(sh.ended_at).getTime() - new Date(sh.started_at).getTime()) / 60000;
    if (min <= 0 || min > 16 * 60) continue;
    const j = jornada.get(sh.person_name) ?? { dias: 0, minutos: 0 };
    j.dias += 1;
    j.minutos += min;
    jornada.set(sh.person_name, j);
  }
  const jornadas = Array.from(jornada.entries())
    .map(([nome, j]) => ({ nome, ...j }))
    .sort((a, b) => b.minutos - a.minutos);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-brand-900">Relatórios gerenciais</h1>
        <div className="flex gap-2">
          {[30, 90, 180].map((d) => (
            <Link
              key={d}
              href={`/relatorios?dias=${d}`}
              className={d === dias ? 'btn-primary' : 'btn-ghost'}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      {done.length === 0 ? (
        <div className="card text-brand-800">
          Ainda não há limpezas concluídas com check-in e check-out no período.
          Os relatórios se constroem sozinhos conforme a equipe usa o app no dia a dia.
        </div>
      ) : (
        <>
          {/* Totais */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="card">
              <p className="text-brand-800">Limpezas concluídas</p>
              <p className="text-3xl font-bold">{totalCleanings}</p>
            </div>
            <div className="card">
              <p className="text-brand-800">Horas em casas</p>
              <p className="text-3xl font-bold">{fmtMin(totalHouseMin)}</p>
            </div>
            <div className="card">
              <p className="text-brand-800">Horas em trajeto</p>
              <p className="text-3xl font-bold">{fmtMin(totalTravelMin)}</p>
            </div>
            <div className="card">
              <p className="text-brand-800">Tempo produtivo</p>
              <p className="text-3xl font-bold">{productivePct}%</p>
              <p className="text-sm text-brand-800">do tempo total em casas</p>
            </div>
            <div className="card">
              <p className="text-brand-800">Receita no período</p>
              <p className="text-3xl font-bold">{usd(totalRevenue)}</p>
            </div>
          </div>

          {/* Comparativo entre equipes */}
          <h2 className="mb-3 text-xl font-semibold text-brand-900">Comparativo entre equipes</h2>
          <div className="space-y-4">
            {teamStats.map((s) => {
              const avgHouse = s.houseMinutes / s.cleanings;
              const avgTravel = s.travelLegs > 0 ? s.travelMinutes / s.travelLegs : 0;
              const avgMiles = s.travelLegs > 0 ? s.travelMiles / s.travelLegs : 0;
              const deviation = s.deviationCount > 0 ? s.deviationPctSum / s.deviationCount : 0;
              const revPerHour = s.houseMinutes > 0 ? s.revenue / (s.houseMinutes / 60) : 0;
              return (
                <div key={s.name} className="card" style={{ borderLeft: `6px solid ${s.color}` }}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xl font-bold text-brand-900">{s.name}</p>
                    <p className="text-brand-800">{s.cleanings} limpezas · {usd(s.revenue)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div>
                      <p className="text-sm text-brand-800">Tempo médio na casa</p>
                      <p className="text-xl font-bold">{fmtMin(avgHouse)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-brand-800">Trajeto médio</p>
                      <p className="text-xl font-bold">{fmtMin(avgTravel)}</p>
                      {avgMiles > 0 && (
                        <p className="text-sm text-brand-800">~{avgMiles.toFixed(1)} mi entre casas</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-brand-800">Real vs estimado</p>
                      <p className={`text-xl font-bold ${deviation > 15 ? 'text-red-700' : 'text-brand-900'}`}>
                        {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%
                      </p>
                      <p className="text-sm text-brand-800">
                        {deviation > 15 ? 'estourando o previsto' : deviation < -15 ? 'muito abaixo do previsto' : 'dentro do previsto'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-brand-800">Horas totais em casas</p>
                      <p className="text-xl font-bold">{fmtMin(s.houseMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-brand-800">Receita por hora</p>
                      <p className="text-xl font-bold">{usd(revPerHour)}/h</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {jornadas.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-xl font-semibold text-brand-900">
                Jornada da equipe no período
              </h2>
              <div className="card space-y-2">
                {jornadas.map((j) => (
                  <div key={j.nome} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 pb-2 last:border-0">
                    <span className="font-medium">{j.nome}</span>
                    <span className="text-brand-800">
                      {j.dias} dia(s) · {fmtMin(j.minutos)} em campo · média{' '}
                      {fmtMin(j.minutos / j.dias)}/dia
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-sm text-brand-800">
            Como ler: o tempo na casa vem do check-in/check-out real da equipe; o trajeto é o intervalo
            entre casas do mesmo dia (pausas acima de 3h não contam); a distância é em linha reta entre
            os endereços. "Real vs estimado" acima de +15% indica que os estimates daquele tipo de casa
            podem estar subdimensionados — vale ajustar os minutos das tarefas na configuração de preços.
          </p>
        </>
      )}
    </div>
  );
}
