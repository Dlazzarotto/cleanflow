import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Suggestion } from '@/lib/types';

// Fuso da operacao (ajustavel por empresa em fases futuras)
const TZ = 'America/New_York';

function localDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)); // YYYY-MM-DD
}

function localTime(d: Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d); // HH:MM
}

/**
 * GET /api/sugestoes?clientId=...
 * Analisa os proximos 21 dias e sugere os melhores encaixes (dia + equipe)
 * com base na distancia entre o novo cliente e as limpezas ja agendadas.
 */

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8; // raio da Terra em milhas
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: client } = await supabase
    .from('clients')
    .select('lat, lng')
    .eq('id', clientId)
    .single();

  if (!client?.lat || !client?.lng) {
    return NextResponse.json({
      suggestions: [],
      message: 'Este cliente não tem endereço com coordenadas. Cadastre o endereço pela busca para receber sugestões de rota.',
    });
  }

  const now = new Date();
  const end = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_at, duration_minutes, team_id, clients(full_name, lat, lng), teams(name, color)')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', end.toISOString())
    .in('status', ['agendado', 'a_caminho', 'em_andamento'])
    .not('team_id', 'is', null);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message: 'Ainda não há limpezas agendadas nos próximos 21 dias — qualquer dia está livre para este cliente.',
    });
  }

  // Agrupa por dia + equipe
  type Row = (typeof bookings)[number];
  const groups = new Map<string, Row[]>();
  for (const b of bookings) {
    const day = localDate(b.scheduled_at);
    const key = `${day}|${b.team_id}`;
    const arr = groups.get(key) ?? [];
    arr.push(b);
    groups.set(key, arr);
  }

  const suggestions: Suggestion[] = [];
  groups.forEach((rows, key) => {
    const [date] = key.split('|');
    let best: { dist: number; name: string } | null = null;
    let lastEnd = 0;

    for (const b of rows) {
      const c = b.clients as unknown as { full_name: string; lat: number | null; lng: number | null } | null;
      if (c?.lat && c?.lng) {
        const dist = haversineMiles(client.lat!, client.lng!, c.lat, c.lng);
        if (!best || dist < best.dist) best = { dist, name: c.full_name };
      }
      const endMs = new Date(b.scheduled_at).getTime() + (b.duration_minutes ?? 120) * 60000;
      if (endMs > lastEnd) lastEnd = endMs;
    }
    if (!best) return;

    // horario sugerido: 30 min apos a ultima limpeza do dia, arredondado a 15 min
    const suggested = new Date(lastEnd + 30 * 60000);
    suggested.setMinutes(Math.ceil(suggested.getMinutes() / 15) * 15, 0, 0);
    const t = rows[0].teams as unknown as { name: string; color: string } | null;

    suggestions.push({
      date,
      team_id: String(rows[0].team_id),
      team_name: t?.name ?? 'Equipe',
      team_color: t?.color ?? '#13706B',
      distance_mi: Math.round(best.dist * 10) / 10,
      nearest_client: best.name,
      suggested_time: localTime(suggested),
      bookings_that_day: rows.length,
    });
  });

  suggestions.sort((a, b) => a.distance_mi - b.distance_mi || a.date.localeCompare(b.date));
  return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
}
