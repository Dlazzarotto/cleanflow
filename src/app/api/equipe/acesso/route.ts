import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAuth, isManager } from '@/lib/auth';
import { accessEmailHtml, sendAccessEmail } from '@/lib/emails/acesso';

/**
 * POST /api/equipe/acesso
 * { membership_id, password?, send_email?: boolean }
 * Redefine a senha da pessoa e, se pedido, envia por email.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis da Vercel.' },
      { status: 500 }
    );
  }

  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isManager(auth.role)) {
    return NextResponse.json({ error: 'Apenas administradores podem redefinir acessos.' }, { status: 403 });
  }

  let body: { membership_id?: string; password?: string; send_email?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.membership_id) {
    return NextResponse.json({ error: 'membership_id é obrigatório' }, { status: 400 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: membership } = await admin
    .from('memberships')
    .select('user_id, full_name, company_id')
    .eq('id', body.membership_id)
    .single();

  if (!membership || membership.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Vínculo não encontrado nesta empresa.' }, { status: 404 });
  }

  const password = (body.password ?? '').trim() || Math.random().toString(36).slice(-10) + 'A1!';

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    membership.user_id,
    { password }
  );
  if (updateError || !updated.user) {
    return NextResponse.json({ error: `Falha ao redefinir: ${updateError?.message}` }, { status: 502 });
  }

  const email = updated.user.email ?? '';
  let emailStatus: string | null = null;

  if (body.send_email && email) {
    const { data: company } = await admin
      .from('companies')
      .select('name, email')
      .eq('id', auth.companyId)
      .single();
    const companyName = company?.name ?? 'CleanFlow';
    const origin = new URL(request.url).origin;

    emailStatus = await sendAccessEmail({
      to: email,
      subject: `Seu acesso ao CleanFlow — ${companyName}`,
      companyName,
      replyTo: company?.email ?? null,
      html: accessEmailHtml({
        fullName: membership.full_name,
        companyName,
        loginUrl: `${origin}/login`,
        email,
        password,
        isReset: true,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    email,
    password,
    email_sent: body.send_email ? emailStatus === null : false,
    email_error: emailStatus,
  });
}
