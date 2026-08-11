import { NextResponse } from 'next/server';
import { getAuth, isManager } from '@/lib/auth';

/**
 * POST /api/comercial/analisar
 * Recebe fotos do local e devolve o que a IA identificou:
 * itens a limpar, grau de sujeira e estimativa de área.
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
      { error: 'Análise por foto não configurada (ANTHROPIC_API_KEY ausente).' },
      { status: 500 }
    );
  }

  let body: {
    segment?: string;
    catalogo?: Array<{ id: string; area: string; item: string; unit: string }>;
    fotos?: Array<{ media_type: string; data: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const fotos = (body.fotos ?? []).slice(0, 6);
  if (fotos.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos uma foto.' }, { status: 400 });
  }

  const catalogo = body.catalogo ?? [];
  const listaItens = catalogo
    .map((c) => `${c.id} | ${c.area} > ${c.item} (unidade: ${c.unit})`)
    .join('\n');

  const instrucao = `Você está ajudando uma empresa de limpeza comercial a orçar um serviço.

Analise as fotos do local (tipo: ${body.segment ?? 'comercial'}) e responda em JSON, sem nenhum texto fora do JSON.

Itens disponíveis no catálogo (id | área > item):
${listaItens}

Formato da resposta:
{
  "itens": [
    { "id": "<id do catálogo>", "qty": <quantidade que você vê ou estima>, "sujeira": "leve|medio|pesado", "motivo": "<o que na foto indica isso, em uma frase curta>" }
  ],
  "area_estimada_sqft": <número ou null>,
  "observacoes": "<2 a 3 frases sobre o estado do local e o que exige atenção especial>",
  "alerta": "<algo que encareceria o serviço e o orçador não deveria esquecer, ou null>"
}

Regras:
- Só inclua itens que você realmente identifica nas fotos.
- Seja conservador na quantidade: se não dá para contar, estime pelo que aparece.
- "pesado" só quando há acúmulo visível (gordura, encardido, obra).
- Escreva tudo em português.`;

  const conteudo: any[] = fotos.map((f) => ({
    type: 'image',
    source: { type: 'base64', media_type: f.media_type, data: f.data },
  }));
  conteudo.push({ type: 'text', text: instrucao });

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: conteudo }],
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      return NextResponse.json(
        { error: `A análise falhou: ${detalhe.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const texto = (data.content ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');

    const limpo = texto.replace(/```json|```/g, '').trim();
    const analise = JSON.parse(limpo);

    return NextResponse.json({ ok: true, ...analise });
  } catch (e) {
    return NextResponse.json(
      { error: 'Não foi possível interpretar a análise. Tente com fotos mais nítidas.' },
      { status: 502 }
    );
  }
}
