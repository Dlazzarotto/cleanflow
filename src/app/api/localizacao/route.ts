import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** POST /api/localizacao { lat, lng, accuracy_m } — ping da equipe. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let body: { lat?: number; lng?: number; accuracy_m?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'lat e lng são obrigatórios' }, { status: 400 });
  }

  const { data: companyId } = await supabase.rpc('current_company_id');
  if (!companyId) return NextResponse.json({ error: 'Sem empresa ativa' }, { status: 400 });

  await supabase.from('location_pings').insert({
    company_id: companyId,
    user_id: user.id,
    lat: body.lat,
    lng: body.lng,
    accuracy_m: body.accuracy_m ?? null,
  });

  return NextResponse.json({ ok: true });
}
