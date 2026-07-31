import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { INVOICE_I18N } from '@/lib/i18n/invoice';
import { normalizeLang } from '@/lib/i18n/documents';
import { sendAccessEmail } from '@/lib/emails/acesso';

/**
 * POST /api/faturas/enviar { invoice_id? , booking_id? }
 * Envia a fatura por email ao cliente, no idioma dele.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let body: { invoice_id?: string; booking_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  let query = supabase
    .from('invoices')
    .select('*, clients(full_name, email, language), companies(name, phone, email)')
    .limit(1);
  if (body.invoice_id) query = query.eq('id', body.invoice_id);
  else if (body.booking_id) query = query.eq('booking_id', body.booking_id);
  else return NextResponse.json({ error: 'Informe invoice_id ou booking_id' }, { status: 400 });

  const { data } = await query.single();
  if (!data) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  const inv = data as any;
  const to = inv.clients?.email;
  if (!to) {
    return NextResponse.json(
      { error: 'Este cliente não tem email cadastrado. Adicione na ficha para enviar a fatura.' },
      { status: 400 }
    );
  }

  const lang = normalizeLang(inv.clients?.language);
  const t = INVOICE_I18N[lang];
  const companyName = inv.companies?.name ?? 'CleanFlow';
  const origin = new URL(request.url).origin;
  const link = `${origin}/fatura/${inv.public_token}`;
  const valor = Number(inv.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#122221;font-size:16px;line-height:1.5;">
    <div style="background:#083A38;color:#ffffff;padding:24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:24px;font-weight:bold;">${companyName}</p>
      <p style="margin:4px 0 0;color:#D9F2F0;">${t.title} ${t.number} ${inv.number}</p>
    </div>
    <div style="border:1px solid #D9F2F0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
      <p><strong>${t.emailHello(inv.clients?.full_name ?? '')}</strong></p>
      <p>${t.emailIntro(companyName)}</p>
      <div style="background:#EFFAF9;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#0C4B48;">${t.total}</p>
        <p style="margin:4px 0 0;font-size:32px;font-weight:bold;color:#083A38;">${valor}</p>
        ${inv.due_at ? `<p style="margin:8px 0 0;color:#0C4B48;">${t.due}: ${new Date(inv.due_at + 'T12:00:00').toLocaleDateString('en-US')}</p>` : ''}
      </div>
      <p style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#0F5C58;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold;">
          ${t.emailCta}
        </a>
      </p>
      <p style="font-size:14px;color:#0C4B48;margin-top:20px;">
        ${t.questions} ${[inv.companies?.phone, inv.companies?.email].filter(Boolean).join(' · ')}
      </p>
      <p style="margin-top:20px;">${t.emailRegards}<br/><strong>${companyName}</strong></p>
    </div>
  </div>`;

  const erro = await sendAccessEmail({
    to,
    subject: t.emailSubject(inv.number, companyName),
    html,
    companyName,
    replyTo: inv.companies?.email ?? null,
  });

  if (erro) return NextResponse.json({ error: erro }, { status: 502 });

  await supabase
    .from('invoices')
    .update({ sent_at: new Date().toISOString(), email_to: to })
    .eq('id', inv.id);

  return NextResponse.json({ ok: true, to });
}
