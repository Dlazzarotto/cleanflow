import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';
import { sendAccessEmail } from '@/lib/emails/acesso';
import { sendSms, toE164 } from '@/lib/sms';

/** POST /api/inspecoes/enviar { inspection_id } — manda o relatório ao cliente. */
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

  let body: { inspection_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.inspection_id) {
    return NextResponse.json({ error: 'inspection_id é obrigatório' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: insp } = await supabase
    .from('inspections')
    .select('*, clients(full_name, email, phone, sms_opt_in), companies(name, phone, email)')
    .eq('id', body.inspection_id)
    .single();

  if (!insp) return NextResponse.json({ error: 'Inspeção não encontrada' }, { status: 404 });

  const cliente = (insp as any).clients;
  const empresa = (insp as any).companies;
  const email = cliente?.email;
  const telefone = toE164(cliente?.phone);

  if (!email && !telefone) {
    return NextResponse.json(
      { error: 'Este cliente não tem email nem telefone cadastrado.' },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const link = `${origin}/inspecao/${(insp as any).public_token}`;
  const nota = (insp as any).percent !== null ? `${(insp as any).percent}%` : '—';
  const companyName = empresa?.name ?? 'CleanFlow';
  const primeiroNome = (cliente?.full_name ?? '').split(' ')[0];

  let enviouSms = false;
  if (telefone && cliente?.sms_opt_in !== false) {
    const erroSms = await sendSms(
      telefone,
      `${companyName}: Olá, ${primeiroNome}! Fizemos uma inspeção de qualidade no seu local. ` +
        `Nota ${nota}. Veja o relatório: ${link}`
    );
    enviouSms = erroSms === null;
  }

  let erroEmail: string | null = null;
  if (email) {
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#122221;font-size:16px;line-height:1.5;">
      <div style="background:#083A38;color:#ffffff;padding:24px;border-radius:12px 12px 0 0;">
        <p style="margin:0;font-size:24px;font-weight:bold;">${companyName}</p>
        <p style="margin:4px 0 0;color:#D9F2F0;">Relatório de inspeção de qualidade</p>
      </div>
      <div style="border:1px solid #D9F2F0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
        <p><strong>Olá, ${primeiroNome}!</strong></p>
        <p>Nossa supervisão fez uma inspeção de qualidade no seu local. Segue o resultado:</p>
        <div style="background:#EFFAF9;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;color:#0C4B48;">Nota da inspeção</p>
          <p style="margin:4px 0 0;font-size:36px;font-weight:bold;color:#083A38;">${nota}</p>
        </div>
        ${(insp as any).notes ? `<p>${(insp as any).notes}</p>` : ''}
        <p style="text-align:center;margin-top:20px;">
          <a href="${link}" style="display:inline-block;background:#0F5C58;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold;">
            Ver relatório completo
          </a>
        </p>
        <p style="font-size:14px;color:#0C4B48;margin-top:20px;">
          O relatório traz cada ponto avaliado, com fotos. Qualquer dúvida, responda este email ou
          fale conosco: ${[empresa?.phone, empresa?.email].filter(Boolean).join(' · ')}
        </p>
        <p style="margin-top:20px;">Obrigado pela confiança,<br/><strong>${companyName}</strong></p>
      </div>
    </div>`;

    erroEmail = await sendAccessEmail({
      to: email,
      subject: `Relatório de inspeção — ${companyName}`,
      html,
      companyName,
      replyTo: empresa?.email ?? null,
    });
  }

  if (!enviouSms && erroEmail) {
    return NextResponse.json({ error: erroEmail }, { status: 502 });
  }
  if (!enviouSms && !email) {
    return NextResponse.json({ error: 'Não foi possível enviar.' }, { status: 502 });
  }

  await supabase
    .from('inspections')
    .update({ status: 'enviada', sent_at: new Date().toISOString() })
    .eq('id', body.inspection_id);

  return NextResponse.json({ ok: true, to: enviouSms ? telefone : email });
}
