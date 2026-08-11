import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';

/**
 * POST /api/comercial/mercado
 * Pesquisa o que a região cobra para aquele tipo de comércio.
 * O resultado fica em cache por 30 dias, por cidade + segmento.
 */
export async function POST(request: Request) {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isManager(auth.role)) {
    return NextResponse.json({ error: 'Acesso restrito à gestão.' }, { status: 403 });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return NextResponse.json(
      { error: 'Pesquisa de mercado não configurada (ANTHROPIC_API_KEY ausente).' },
      { status: 500 }
    );
  }

  let body: { segment?: string; city?: string; area_sqft?: number; frequency?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const segmento = body.segment ?? 'comercial';
  const cidade = (body.city ?? '').trim();
  if (!cidade) {
    return NextResponse.json(
      { error: 'Informe a cidade do local para pesquisar os preços da região.' },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const chaveCache = `comercial:${segmento}:${cidade.toLowerCase()}`;

  // Cache de 30 dias
  const { data: cache } = await supabase
    .from('market_cache')
    .select('*')
    .eq('city', chaveCache)
    .gt('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .maybeSingle();

  if (cache) {
    return NextResponse.json({
      ok: true,
      cached: true,
      hourly_low: Number(cache.hourly_low),
      hourly_high: Number(cache.hourly_high),
      sqft_low: cache.visit_low !== null ? Number(cache.visit_low) : null,
      sqft_high: cache.visit_high !== null ? Number(cache.visit_high) : null,
      monthly_low: cache.deep_low !== null ? Number(cache.deep_low) : null,
      monthly_high: cache.deep_high !== null ? Number(cache.deep_high) : null,
      resumo: cache.resumo,
    });
  }

  const SEGMENTO_TEXTO: Record<string, string> = {
    restaurante: 'restaurantes e lanchonetes',
    escritorio: 'escritórios corporativos',
    hotel: 'hotéis e pousadas',
    condominio: 'condomínios residenciais e prédios',
    supermercado: 'supermercados e mercados',
    academia: 'academias e estúdios',
    clinica: 'clínicas e consultórios',
    escola: 'escolas e creches',
    loja: 'lojas e comércio de rua',
    galeria: 'galerias e showrooms',
    igreja: 'igrejas e templos',
    fabrica: 'fábricas e galpões industriais',
  };

  const instrucao = `Pesquise os preços atuais de limpeza comercial (janitorial / commercial cleaning) para ${
    SEGMENTO_TEXTO[segmento] ?? 'estabelecimentos comerciais'
  } na região de ${cidade}, Estados Unidos.

Responda apenas com JSON, sem nenhum texto fora dele:
{
  "hourly_low": <menor valor por hora praticado, número>,
  "hourly_high": <maior valor por hora, número>,
  "sqft_low": <menor valor por sq ft por visita, número com decimais, ou null>,
  "sqft_high": <maior valor por sq ft por visita, ou null>,
  "monthly_low": <menor contrato mensal típico para este tipo de lugar, ou null>,
  "monthly_high": <maior contrato mensal típico, ou null>,
  "resumo": "<3 a 4 frases sobre como esse tipo de comércio costuma ser cobrado na região, o que puxa o preço para cima e o que os clientes valorizam>"
}

Todos os valores em dólares americanos.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: instrucao }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      return NextResponse.json(
        { error: `A pesquisa falhou: ${detalhe.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const texto = (data.content ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');

    const limpo = texto.replace(/```json|```/g, '').trim();
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    const resultado = JSON.parse(limpo.slice(inicio, fim + 1));

    // Guarda no cache
    await supabase.from('market_cache').insert({
      company_id: auth.companyId,
      city: chaveCache,
      hourly_low: resultado.hourly_low,
      hourly_high: resultado.hourly_high,
      visit_low: resultado.sqft_low,
      visit_high: resultado.sqft_high,
      deep_low: resultado.monthly_low,
      deep_high: resultado.monthly_high,
      resumo: resultado.resumo,
    });

    return NextResponse.json({ ok: true, cached: false, ...resultado });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível interpretar a pesquisa. Tente novamente.' },
      { status: 502 }
    );
  }
}
