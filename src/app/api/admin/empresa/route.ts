import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getPlatformAdmin } from '@/lib/platform';
import { monthlyFee, planKey } from '@/lib/plans';

/**
 * POST /api/admin/empresa — cria uma nova empresa assinante + o acesso do dono.
 * Somente administradores da plataforma.
 */
export async function POST(request: Request) {
  const platform = await getPlatformAdmin();
  if (!platform) {
    return NextResponse.json({ error: 'Acesso restrito à administração da plataforma.' }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const ownerEmail = String(body.owner_email ?? '').trim().toLowerCase();
  const ownerName = String(body.owner_name ?? '').trim();
  const plan = planKey(String(body.plan ?? ''));
  // Equipe adicional vale em qualquer plano.
  const extraTeams = Math.max(0, Number(body.extra_teams ?? 0));
  // Idioma do aplicativo escolhido no cadastro da responsável. Inglês é o padrão.
  const locale = ['en', 'pt', 'es', 'fr'].includes(String(body.locale)) ? String(body.locale) : 'en';

  if (!name || !ownerEmail || !ownerName) {
    return NextResponse.json(
      { error: 'Nome da empresa, nome e email do responsável são obrigatórios.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Empresa
  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) +
    '-' + Math.random().toString(36).slice(-4);

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name,
      slug,
      phone: String(body.phone ?? '') || null,
      email: String(body.email ?? '') || null,
      address: String(body.address ?? '') || null,
      representative_name: ownerName,
      website: String(body.website ?? '') || null,
      plan,
      extra_teams: extraTeams,
      monthly_fee: monthlyFee(plan, extraTeams),
      account_status: String(body.account_status ?? 'teste'),
      billing_status: 'pendente',
    })
    .select('id')
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: `Falha ao criar empresa: ${companyError?.message}` }, { status: 502 });
  }

  // 2) Usuario do responsavel (reaproveita se ja existir)
  let userId: string | null = null;
  for (let page = 1; page <= 5 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === ownerEmail);
    if (found) userId = found.id;
    if (data.users.length < 200) break;
  }

  let tempPassword: string | null = null;
  if (!userId) {
    tempPassword = String(body.password ?? '').trim() || Math.random().toString(36).slice(-10) + 'A1!';
    const { data, error } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: `Falha ao criar acesso: ${error?.message}` }, { status: 502 });
    }
    userId = data.user.id;
  }

  // 3) Vinculo como dono
  const { error: memberError } = await admin.from('memberships').insert({
    user_id: userId,
    company_id: company.id,
    role: 'owner',
    full_name: ownerName,
    active: true,
  });
  if (memberError) {
    return NextResponse.json({ error: `Falha no vínculo: ${memberError.message}` }, { status: 502 });
  }

  // 4) Empresa ativa padrao e idioma do app para o usuario, se ele ainda nao tiver.
  // Se ja tiver, o idioma dele e preferencia pessoal — nao sobrescrevemos aqui.
  const { data: settings } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  let avisoSettings: string | null = null;
  if (!settings) {
    const { data: criado, error: settingsError } = await admin
      .from('user_settings')
      .insert({ user_id: userId, active_company_id: company.id, locale })
      .select('user_id');
    if (settingsError || !criado?.length) {
      avisoSettings =
        ' Atenção: não foi possível gravar o idioma e a empresa ativa do responsável — confira em Configurações depois do primeiro acesso.';
    }
  } else {
    avisoSettings = ' O responsável já tinha conta; o idioma do app dele foi mantido como estava.';
  }

  const base = tempPassword
    ? 'Empresa criada. Anote a senha temporária e entregue ao responsável.'
    : 'Empresa criada. O responsável já tinha login e usará a mesma senha.';

  return NextResponse.json({
    ok: true,
    company_id: company.id,
    temp_password: tempPassword,
    message: base + (avisoSettings ?? ''),
  });
}
