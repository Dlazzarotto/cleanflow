import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bookings?start=...&end=...
 * Limpezas do período, filtradas pelo modo ativo (residencial ou comercial).
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: 'Informe start e end' }, { status: 400 });
  }

  // Modo ativo: o calendário mostra só o que pertence a ele
  const { data: modo } = await supabase.rpc('current_mode');
  const tipo = modo === 'comercial' ? 'comercial' : 'residencial';

  const { data: idsModo } = await supabase
    .from('clients')
    .select('id')
    .eq('client_type', tipo);
  const clientesDoModo = (idsModo ?? []).map((c: any) => c.id);

  if (clientesDoModo.length === 0) {
    return NextResponse.json({ bookings: [] });
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*, clients(full_name, address, client_type), teams(name, color)')
    .in('client_id', clientesDoModo)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}
