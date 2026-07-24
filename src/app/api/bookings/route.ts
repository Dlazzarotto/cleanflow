import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bookings?start=ISO&end=ISO
 * Lista limpezas do periodo (para o calendario).
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: 'start e end são obrigatórios' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data, error } = await supabase
    .from('bookings')
    .select('id, client_id, team_id, series_id, scheduled_at, duration_minutes, price, status, notes, clients(full_name, address), teams(name, color)')
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)
    .order('scheduled_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}
