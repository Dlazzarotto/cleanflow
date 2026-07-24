import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatMinutes } from '@/lib/pricing';
import { buildServiceList } from '@/lib/estimate-view';
import { EMAIL_I18N, FREQ, normalizeLang } from '@/lib/i18n/documents';

/**
 * POST /api/estimate/enviar  { id: string }
 * Envia o estimate por email (Resend) ao cliente/lead e marca como enviado.
 * Requer RESEND_API_KEY; EMAIL_FROM opcional (padrao onboarding@resend.dev).
 */

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export async function POST(request: Request) {
  // Auditoria: rota administrativa — exige papel de gestao
  try {
    const { getAuth, isManager } = await import('@/lib/auth');
    const ctx = await getAuth();
    if (!isManager(ctx.role)) {
      return NextResponse.json({ error: 'Acesso restrito à gestão.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Envio de email não configurado. Adicione RESEND_API_KEY nas variáveis da Vercel (resend.com — plano gratuito).' },
      { status: 500 }
    );
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

  const [{ data: estimate }, { data: company }] = await Promise.all([
    supabase.from('estimates').select('*, clients(full_name, email, language)').eq('id', body.id).single(),
    supabase.from('companies').select('name, phone, email, address').limit(1).single(),
  ]);
  if (!estimate) return NextResponse.json({ error: 'Estimate não encontrado' }, { status: 404 });

  const e = estimate as any;
  const to: string | null = e.clients?.email ?? e.lead_email ?? null;
  if (!to) {
    return NextResponse.json(
      { error: 'Este estimate não tem email do cliente/lead. Edite o estimate e adicione um email.' },
      { status: 400 }
    );
  }

  const lang = normalizeLang(e.language ?? e.clients?.language);
  const t = EMAIL_I18N[lang];
  const dateLocale = { pt: 'pt-BR', en: 'en-US', es: 'es-US', fr: 'fr-FR' }[lang];
  const clientName = e.clients?.full_name ?? e.lead_name ?? 'Cliente';
  const companyName = company?.name ?? 'Empresa de Limpeza';
  const price = e.final_price ? usd(e.final_price) : `${usd(e.price_low)} – ${usd(e.price_high)}`;
  const sections = buildServiceList(e, lang);
  const validade = new Date(new Date(e.created_at).getTime() + 30 * 86400000).toLocaleDateString(dateLocale);

  const servicesHtml = sections
    .map(
      (s) => `
      <p style="margin:12px 0 4px;font-weight:bold;color:#0C4B48;">${s.title}</p>
      <ul style="margin:0 0 0 20px;padding:0;color:#122221;">
        ${s.items.map((i) => `<li style="margin:2px 0;">${i}</li>`).join('')}
      </ul>`
    )
    .join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#122221;font-size:16px;line-height:1.5;">
    <div style="background:#083A38;color:#ffffff;padding:24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:24px;font-weight:bold;">${companyName}</p>
      <p style="margin:4px 0 0;color:#D9F2F0;">${t.tagline}</p>
    </div>
    <div style="border:1px solid #D9F2F0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
      <p><strong>${t.hello(clientName)}</strong></p>
      <p>${t.intro(e.address ?? '')}</p>
      ${servicesHtml}
      <div style="background:#EFFAF9;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0;"><strong>${t.frequency}:</strong> ${FREQ[lang][e.frequency] ?? FREQ[lang].indef}</p>
        <p style="margin:4px 0 0;"><strong>${t.time}:</strong> ${formatMinutes(e.minutes)}</p>
        <p style="margin:12px 0 0;font-size:22px;font-weight:bold;color:#083A38;">${t.investment}: ${price}</p>
      </div>
      <p style="font-size:14px;color:#0C4B48;">${t.validity(validade)}</p>
      <p>${t.reply(company?.phone ?? '')}</p>
      <p style="margin-top:20px;">${t.regards}<br/><strong>${companyName}</strong></p>
    </div>
  </div>`;

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: `${companyName} <${from}>`,
      to: [to],
      reply_to: company?.email ?? undefined,
      subject: t.subject(companyName),
      html,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text();
    return NextResponse.json({ error: 'Falha no envio do email.', detail }, { status: 502 });
  }

  if (e.status === 'rascunho') {
    await supabase.from('estimates').update({ status: 'enviado' }).eq('id', e.id);
  }

  return NextResponse.json({ ok: true, to });
}
