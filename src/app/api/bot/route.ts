import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Bot IA do CleanFlow — Fase 1 (canal web).
 * POST { conversationId?: string, message: string }
 * O bot coleta dados para orçamento e responde em nome da empresa.
 * Fases futuras: WhatsApp/SMS (Twilio), tool use para agendar/cancelar direto no banco.
 */

const SYSTEM_PROMPT = `Você é o assistente virtual de uma empresa de limpeza residencial e comercial nos EUA.
Seu papel:
1. Atender clientes com cordialidade, em português ou inglês (siga o idioma do cliente).
2. Para novos orçamentos, colete: cidade, tamanho do imóvel (sq ft ou nº de quartos), nº de banheiros, se tem pets, e se é primeira limpeza (deep clean) ou manutenção.
3. Quando tiver todos os dados, estime: manutenção = $0.10/sq ft (mínimo $120); primeira limpeza = 1.6x o valor de manutenção. Apresente como estimativa sujeita a confirmação.
4. Para reagendamento ou cancelamento, colete nome completo e data atual da limpeza, e informe que a alteração será confirmada por mensagem.
5. Nunca invente disponibilidade de agenda; diga que o sistema confirmará o horário.
6. Respostas curtas e objetivas, uma pergunta por vez.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no ambiente.' },
      { status: 500 }
    );
  }

  let body: { conversationId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const userMessage = (body.message ?? '').trim();
  if (!userMessage) {
    return NextResponse.json({ error: 'Campo "message" é obrigatório.' }, { status: 400 });
  }

  const supabase = createClient();

  // Carrega ou cria a conversa
  let conversationId = body.conversationId ?? null;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (conversationId) {
    const { data } = await supabase
      .from('bot_conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();
    if (data?.messages) {
      history = (data.messages as Array<{ role: string; content: string }>).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }
  }

  const messages = [...history, { role: 'user' as const, content: userMessage }];

  // Chamada à Anthropic API
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return NextResponse.json(
      { error: 'Falha na chamada ao modelo.', detail },
      { status: 502 }
    );
  }

  const data = await anthropicRes.json();
  const reply: string = (data.content ?? [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('\n');

  // Persiste a conversa (best-effort)
  const newMessages = [
    ...messages,
    { role: 'assistant', content: reply, at: new Date().toISOString() },
  ];

  try {
    if (conversationId) {
      await supabase
        .from('bot_conversations')
        .update({ messages: newMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        if (profile) {
          const { data: created } = await supabase
            .from('bot_conversations')
            .insert({ company_id: profile.company_id, channel: 'web', messages: newMessages })
            .select('id')
            .single();
          conversationId = created?.id ?? null;
        }
      }
    }
  } catch {
    // persistência é best-effort; a resposta ao cliente tem prioridade
  }

  return NextResponse.json({ reply, conversationId });
}
