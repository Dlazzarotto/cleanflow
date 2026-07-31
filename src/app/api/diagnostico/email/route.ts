import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';
import { sendAccessEmail } from '@/lib/emails/acesso';

/**
 * POST /api/diagnostico/email { to }
 * Testa a configuracao de envio e devolve o erro exato do provedor.
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

  const temChave = Boolean(process.env.RESEND_API_KEY);
  const remetente = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
  const dominioProprio = Boolean(process.env.EMAIL_FROM);

  let body: { to?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const destino = (body.to ?? user?.email ?? '').trim();

  if (!temChave) {
    return NextResponse.json({
      ok: false,
      chave_configurada: false,
      remetente,
      dominio_proprio: dominioProprio,
      diagnostico:
        'A variável RESEND_API_KEY não está configurada na Vercel. Sem ela, nenhum email sai do sistema.',
    });
  }

  if (!destino) {
    return NextResponse.json({ ok: false, error: 'Informe um email de destino.' }, { status: 400 });
  }

  const erro = await sendAccessEmail({
    to: destino,
    subject: 'Teste de envio — CleanFlow',
    companyName: 'CleanFlow',
    html: `<p>Este é um teste de configuração de email do CleanFlow.</p>
           <p>Se você recebeu esta mensagem, o envio para <strong>${destino}</strong> está funcionando.</p>`,
  });

  return NextResponse.json({
    ok: erro === null,
    chave_configurada: true,
    remetente,
    dominio_proprio: dominioProprio,
    destino,
    diagnostico:
      erro === null
        ? `Email enviado para ${destino}. Se não chegar em alguns minutos, verifique o spam.`
        : erro,
  });
}
