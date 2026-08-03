import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';
import { sendSms, toE164 } from '@/lib/sms';
import { SMS_I18N } from '@/lib/i18n/sms';

/** POST /api/diagnostico/sms { to } — testa o envio de SMS. */
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

  const configurado = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );

  let body: { to?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!configurado) {
    return NextResponse.json({
      ok: false,
      configurado: false,
      diagnostico:
        'SMS ainda não configurado. Crie uma conta na Twilio, compre um número e adicione TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER nas variáveis da Vercel.',
    });
  }

  const destino = toE164(body.to ?? '');
  if (!destino) {
    return NextResponse.json({ ok: false, configurado: true, diagnostico: 'Informe um telefone válido (ex: 617 555 0100).' });
  }

  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('name').eq('id', auth.companyId).single();

  const erro = await sendSms(destino, SMS_I18N.pt.testMessage);

  return NextResponse.json({
    ok: erro === null,
    configurado: true,
    remetente: process.env.TWILIO_PHONE_NUMBER,
    destino,
    empresa: company?.name,
    diagnostico: erro === null ? `SMS enviado para ${destino}.` : erro,
  });
}
