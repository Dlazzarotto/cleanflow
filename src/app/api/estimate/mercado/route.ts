import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/estimate/mercado  { city: string }
 * Pesquisa precos de limpeza residencial na regiao.
 * Usa cache de 30 dias por cidade para economizar chamadas de IA.
 */

const CACHE_DAYS = 30;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let body: { city?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const city = (body.city ?? '').trim();
  if (!city) return NextResponse.json({ error: 'Informe a cidade' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 400 });

  const cityKey = city.toLowerCase().replace(/\s+/g, ' ');

  // 1) Cache
  const { data: cached } = await supabase
    .from('market_cache')
    .select('data, created_at')
    .eq('company_id', profile.company_id)
    .eq('city_key', cityKey)
    .single();

  if (cached) {
    const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86400000;
    if (ageDays < CACHE_DAYS) {
      return NextResponse.json({ market: cached.data, cached: true });
    }
  }

  // 2) Pesquisa via IA + web search
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada — pesquisa de mercado indisponível.' },
      { status: 500 }
    );
  }

  const prompt = `Pesquise na web os preços atuais de limpeza residencial (house cleaning) na região de ${city}, Estados Unidos.
Quero: faixa de preço por hora (por profissional) e faixa de preço por visita para uma casa média de 3 quartos e 2 banheiros, tanto limpeza de manutenção quanto deep cleaning.
Responda SOMENTE com um objeto JSON válido, sem markdown e sem texto antes ou depois, no formato:
{"hourly_low": number, "hourly_high": number, "visit_low": number, "visit_high": number, "deep_low": number, "deep_high": number, "resumo": "2 a 3 frases em português resumindo o mercado local e as fontes"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: 'Falha na pesquisa de mercado.', detail }, { status: 502 });
    }

    const data = await res.json();
    const text: string = (data.content ?? [])
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('\n');

    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Não foi possível interpretar a pesquisa.', raw: text }, { status: 502 });
    }

    const market = JSON.parse(jsonMatch[0]);

    // 3) Grava no cache (best-effort)
    await supabase.from('market_cache').upsert({
      company_id: profile.company_id,
      city_key: cityKey,
      data: market,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ market, cached: false });
  } catch {
    return NextResponse.json({ error: 'Erro na pesquisa de mercado.' }, { status: 502 });
  }
}
