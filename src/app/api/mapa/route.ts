import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { etTodayRange } from '@/lib/tz';

/**
 * GET /api/mapa — dados do mapa em tempo real (gestao; RLS garante).
 * people: ultima posicao de cada pessoa nos ultimos 15 minutos.
 * houses: limpezas de hoje com coordenadas.
 */
export async function GET() {
  // Auditoria: rota administrativa — exige papel de gestao
  try {
    const { getAuth, isManager } = await import('@/lib/auth');
    const ctx = await getAuth();
    if (!isManager(ctx.role)) {
      return NextResponse.json({ error: 'Acesso restrito à gestão.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const since = new Date(Date.now() - 15 * 60000).toISOString();
  const { start, end } = etTodayRange();

  const [{ data: pings }, { data: members }, { data: teamMembers }, { data: teams }, { data: bookings }, { data: companyRow }, { data: clientRows }] =
    await Promise.all([
      supabase
        .from('location_pings')
        .select('user_id, lat, lng, accuracy_m, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('memberships').select('user_id, full_name'),
      supabase.from('team_members').select('team_id, profile_id'),
      supabase.from('teams').select('id, name, color'),
      supabase
        .from('bookings')
        .select('id, client_id, status, scheduled_at, clients(full_name, address, unit, lat, lng), teams(name, color)')
        .gte('scheduled_at', start)
        .lt('scheduled_at', end)
        .neq('status', 'cancelado'),
      supabase.from('companies').select('name, lat, lng').limit(1).single(),
      supabase
        .from('clients')
        .select('id, full_name, address, unit, status, frequency, lat, lng')
        .not('lat', 'is', null),
    ]);

  const nameByUser = new Map((members ?? []).map((m: any) => [m.user_id, m.full_name]));
  const teamById = new Map((teams ?? []).map((t: any) => [t.id, t]));
  const teamByUser = new Map<string, any>();
  for (const tm of teamMembers ?? []) {
    if (!teamByUser.has((tm as any).profile_id)) {
      teamByUser.set((tm as any).profile_id, teamById.get((tm as any).team_id));
    }
  }

  // Ultima posicao por pessoa
  const seen = new Set<string>();
  const people: any[] = [];
  for (const p of pings ?? []) {
    const row = p as any;
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const team = teamByUser.get(row.user_id);
    people.push({
      user_id: row.user_id,
      name: nameByUser.get(row.user_id) ?? 'Pessoa',
      lat: row.lat,
      lng: row.lng,
      minutes_ago: Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000),
      team_name: team?.name ?? null,
      team_color: team?.color ?? '#13706B',
    });
  }

  const houses = (bookings ?? [])
    .filter((b: any) => b.clients?.lat && b.clients?.lng)
    .map((b: any) => ({
      id: b.id,
      status: b.status,
      time: b.scheduled_at,
      client: b.clients.full_name,
      address: b.clients.address,
      unit: b.clients.unit,
      lat: b.clients.lat,
      lng: b.clients.lng,
      team_name: b.teams?.name ?? null,
      team_color: b.teams?.color ?? '#8AA6A3',
    }));

  const base =
    companyRow && (companyRow as any).lat && (companyRow as any).lng
      ? { name: (companyRow as any).name, lat: (companyRow as any).lat, lng: (companyRow as any).lng }
      : null;

  // Clientes com coordenadas, separados por status
  const todayClientIds = new Set((bookings ?? []).map((b: any) => b.client_id));
  const clients = (clientRows ?? []).map((c: any) => ({
    id: c.id,
    name: c.full_name,
    address: c.address,
    unit: c.unit,
    status: c.status,
    frequency: c.frequency,
    lat: c.lat,
    lng: c.lng,
    has_today: todayClientIds.has(c.id),
  }));

  return NextResponse.json({ people, houses, base, clients });
}
