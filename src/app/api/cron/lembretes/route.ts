import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { reminderHtml, REMINDER_I18N } from '@/lib/i18n/messages';
import { SMS_I18N } from '@/lib/i18n/sms';
import { normalizeLang } from '@/lib/i18n/documents';
import { sendAccessEmail } from '@/lib/emails/acesso';
import { sendSms, toE164 } from '@/lib/sms';

/**
 * Lembrete de vespera — rotina diaria da Vercel.
 * Canal padrao: SMS (configuravel por empresa).
 */

const TZ = 'America/New_York';
const LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-US', fr: 'fr-FR' };

function ymdInTz(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export async function GET(request: Request) {
  return processar(request);
}
export async function POST(request: Request) {
  return processar(request);
}

async function processar(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  const viaCron = Boolean(secret) && auth === `Bearer ${secret}`;

  let companyFilter: string | null = null;
  if (!viaCron) {
    const { getAuth, isManager } = await import('@/lib/auth');
    try {
      const ctx = await getAuth();
      if (!isManager(ctx.role)) {
        return NextResponse.json({ error: 'Acesso restrito à gestão.' }, { status: 403 });
      }
      companyFilter = ctx.companyId;
    } catch {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const diaAlvo = ymdInTz(amanha);
  const inicio = new Date(`${diaAlvo}T00:00:00-04:00`).toISOString();
  const fim = new Date(`${diaAlvo}T23:59:59-04:00`).toISOString();

  let query = admin
    .from('bookings')
    .select(
      'id, company_id, scheduled_at, clients(id, full_name, email, phone, language, sms_opt_in), companies(name, phone, email)'
    )
    .gte('scheduled_at', inicio)
    .lte('scheduled_at', fim)
    .in('status', ['agendado', 'a_caminho']);
  if (companyFilter) query = query.eq('company_id', companyFilter);

  const { data: bookings, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resultado = {
    data: diaAlvo,
    total: (bookings ?? []).length,
    sms: 0,
    email: 0,
    pulados: 0,
    falhas: 0,
    detalhes: [] as string[],
  };

  for (const b of (bookings ?? []) as any[]) {
    const cliente = b.clients;
    if (!cliente) {
      resultado.pulados += 1;
      continue;
    }

    const { data: settings } = await admin
      .from('pricing_settings')
      .select('reminder_enabled, reminder_channel, cancel_notice_hours, reminder_extra_note')
      .eq('company_id', b.company_id)
      .single();

    if (settings?.reminder_enabled === false) {
      resultado.pulados += 1;
      continue;
    }

    const { data: jaEnviado } = await admin
      .from('client_messages')
      .select('id')
      .eq('booking_id', b.id)
      .eq('kind', 'lembrete')
      .maybeSingle();
    if (jaEnviado) {
      resultado.pulados += 1;
      continue;
    }

    const canal = settings?.reminder_channel ?? 'sms';
    const lang = normalizeLang(cliente.language);
    const quando = new Date(b.scheduled_at);
    const companyName = b.companies?.name ?? 'CleanFlow';
    const horas = settings?.cancel_notice_hours ?? 48;
    const extra = settings?.reminder_extra_note ?? null;

    const dataCurta = quando.toLocaleDateString(LOCALE[lang], {
      timeZone: TZ,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const dataLonga = quando.toLocaleDateString(LOCALE[lang], {
      timeZone: TZ,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });

    let enviouAlgo = false;
    let ultimoErro: string | null = null;

    // --- SMS ---
    const telefone = toE164(cliente.phone);
    if ((canal === 'sms' || canal === 'ambos') && telefone && cliente.sms_opt_in !== false) {
      const texto = SMS_I18N[lang].reminder({
        company: companyName,
        name: (cliente.full_name ?? '').split(' ')[0],
        date: dataCurta,
        hours: horas,
        extra,
      });
      const erro = await sendSms(telefone, texto);
      await admin.from('client_messages').insert({
        company_id: b.company_id,
        client_id: cliente.id,
        booking_id: b.id,
        kind: 'lembrete',
        channel: 'sms',
        sent_to: telefone,
        status: erro ? 'falhou' : 'enviado',
        error: erro,
      });
      if (erro) {
        ultimoErro = erro;
      } else {
        resultado.sms += 1;
        enviouAlgo = true;
      }
    }

    // --- Email (canal escolhido, ou reserva quando o SMS falha/não há telefone) ---
    const precisaEmail =
      canal === 'email' || canal === 'ambos' || (canal === 'sms' && !enviouAlgo);
    if (precisaEmail && cliente.email) {
      const html = reminderHtml({
        lang,
        companyName,
        clientName: cliente.full_name,
        dateLabel: dataLonga,
        cancelHours: horas,
        contact: [b.companies?.phone, b.companies?.email].filter(Boolean).join(' · '),
        extraNote: extra,
      });
      const erro = await sendAccessEmail({
        to: cliente.email,
        subject: REMINDER_I18N[lang].subject(companyName),
        html,
        companyName,
        replyTo: b.companies?.email ?? null,
      });
      if (!enviouAlgo) {
        await admin.from('client_messages').insert({
          company_id: b.company_id,
          client_id: cliente.id,
          booking_id: b.id,
          kind: 'lembrete',
          channel: 'email',
          sent_to: cliente.email,
          status: erro ? 'falhou' : 'enviado',
          error: erro,
        });
      }
      if (erro) ultimoErro = erro;
      else {
        resultado.email += 1;
        enviouAlgo = true;
      }
    }

    if (!enviouAlgo) {
      resultado.falhas += 1;
      if (ultimoErro && resultado.detalhes.length < 5) {
        resultado.detalhes.push(`${cliente.full_name}: ${ultimoErro}`);
      } else if (!telefone && !cliente.email && resultado.detalhes.length < 5) {
        resultado.detalhes.push(`${cliente.full_name}: sem telefone nem email cadastrado`);
      }
    }
  }

  return NextResponse.json({ ok: true, ...resultado });
}
