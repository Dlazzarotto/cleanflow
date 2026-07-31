import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAuth, isManager } from '@/lib/auth';
import { accessEmailHtml, sendAccessEmail } from '@/lib/emails/acesso';

/**
 * POST /api/equipe/convidar
 * { email, full_name, role, password?, team_id? }
 * Cria (ou reaproveita) o login da pessoa e cria o vinculo com a empresa.
 * Se o email ja existe em outra empresa, NAO cria novo usuario:
 * apenas adiciona o vinculo — a pessoa usa o mesmo login em todas.
 * Requer SUPABASE_SERVICE_ROLE_KEY nas variaveis de ambiente.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada (Supabase → Settings → API → service_role).' },
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
    return NextResponse.json({ error: 'Apenas administradores podem convidar.' }, { status: 403 });
  }

  let body: { email?: string; full_name?: string; role?: string; password?: string; team_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const fullName = (body.full_name ?? '').trim();
  const role = ['admin', 'supervisor', 'cleaner', 'marketing'].includes(body.role ?? '')
    ? body.role!
    : 'cleaner';
  if (!email || !fullName) {
    return NextResponse.json({ error: 'Email e nome são obrigatórios.' }, { status: 400 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Procura usuario existente pelo email (pessoa pode vir de outra empresa)
  let userId: string | null = null;
  for (let page = 1; page <= 5 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (found) userId = found.id;
    if (data.users.length < 200) break;
  }

  let createdNew = false;
  if (!userId) {
    const password = body.password?.trim() || Math.random().toString(36).slice(-10) + 'A1!';
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: `Falha ao criar usuário: ${error?.message}` }, { status: 502 });
    }
    userId = data.user.id;
    createdNew = true;
    (body as any)._password = password;
  }

  // 2) Cria ou reativa o vinculo com ESTA empresa.
  // Protecoes: convite NUNCA rebaixa um owner nem sobrescreve o nome
  // de quem ja existe — apenas cria ou reativa.
  const { data: existing } = await admin
    .from('memberships')
    .select('id, role, full_name, active')
    .eq('user_id', userId)
    .eq('company_id', auth.companyId)
    .single();

  let memberError = null as { message: string } | null;
  let alreadyLinked = false;

  if (existing) {
    alreadyLinked = true;
    const keepOwner = existing.role === 'owner';
    const { error } = await admin
      .from('memberships')
      .update({
        active: true,
        role: keepOwner ? 'owner' : role,
      })
      .eq('id', existing.id);
    memberError = error;
  } else {
    const { error } = await admin.from('memberships').insert({
      user_id: userId,
      company_id: auth.companyId,
      role,
      full_name: fullName,
      active: true,
    });
    memberError = error;
  }

  if (memberError) {
    return NextResponse.json({ error: `Falha no vínculo: ${memberError.message}` }, { status: 502 });
  }

  // 3) Empresa ativa padrao (se a pessoa nao tiver uma)
  const { data: settings } = await admin.from('user_settings').select('user_id').eq('user_id', userId).single();
  if (!settings) {
    await admin.from('user_settings').insert({ user_id: userId, active_company_id: auth.companyId });
  }

  // 4) Coloca na equipe, se pedido
  if (body.team_id) {
    const { data: team } = await admin
      .from('teams')
      .select('id')
      .eq('id', body.team_id)
      .eq('company_id', auth.companyId)
      .single();
    if (team) {
      await admin.from('team_members').upsert(
        { team_id: body.team_id, profile_id: userId },
        { onConflict: 'team_id,profile_id' }
      );
    }
  }

  // 5) Email com os dados de acesso (best-effort)
  let emailStatus: string | null = null;
  if (createdNew) {
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
        fullName,
        companyName,
        loginUrl: `${origin}/login`,
        email,
        password: (body as any)._password,
        isReset: false,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    created_new_user: createdNew,
    temp_password: createdNew ? (body as any)._password : null,
    email_sent: createdNew ? emailStatus === null : false,
    email_error: emailStatus,
    message: createdNew
      ? 'Acesso criado. Anote a senha temporária e entregue à pessoa.'
      : alreadyLinked
        ? 'Esta pessoa já tinha vínculo com a sua empresa — o acesso foi reativado sem alterar o nome nem rebaixar o papel.'
        : 'Esta pessoa já tinha login (de outra empresa) — o vínculo com a sua empresa foi criado com o mesmo email e senha que ela já usa.',
  });
}
