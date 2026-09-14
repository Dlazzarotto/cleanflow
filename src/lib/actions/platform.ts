'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/platform';
import { monthlyFee, planKey } from '@/lib/plans';

/** Atualiza os dados comerciais/administrativos de uma empresa assinante. */
export async function updateCompanyAccountAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = String(formData.get('id'));
  const planoEscolhido = planKey(String(formData.get('plan') ?? ''));
  const equipesExtras = Math.max(0, Number(formData.get('extra_teams') ?? 0));

  const { data: alterado, error } = await supabase
    .from('companies')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      representative_name: String(formData.get('representative_name') ?? '') || null,
      phone: String(formData.get('phone') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      website: String(formData.get('website') ?? '') || null,
      plan: planoEscolhido,
      extra_teams: equipesExtras,
      // O comercial faz parte do Plus — nao e mais somado a mensalidade.
      monthly_fee:
        Number(formData.get('monthly_fee') ?? 0) > 0
          ? Number(formData.get('monthly_fee'))
          : monthlyFee(planoEscolhido, equipesExtras),
      account_status: String(formData.get('account_status') ?? 'ativa'),
      billing_status: String(formData.get('billing_status') ?? 'em_dia'),
      next_due_date: String(formData.get('next_due_date') ?? '') || null,
      commercial_enabled: formData.get('commercial_enabled') === 'on',
      commercial_price: Number(formData.get('commercial_price') ?? 20),
      ...(formData.get('commercial_enabled') === 'on'
        ? { commercial_since: new Date().toISOString() }
        : {}),
      platform_notes: String(formData.get('platform_notes') ?? '') || null,
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!alterado?.length) {
    throw new Error('Nada foi alterado: a empresa não foi encontrada ou o acesso foi recusado.');
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/${id}`);
}

/** Suspende ou reativa o acesso de uma empresa (inadimplencia, cancelamento). */
export async function setAccountStatusAction(id: string, status: string) {
  const { supabase } = await requirePlatformAdmin();
  const { data: alterado, error } = await supabase
    .from('companies')
    .update({ account_status: status })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!alterado?.length) {
    throw new Error('Nada foi alterado: a empresa não foi encontrada ou o acesso foi recusado.');
  }
  revalidatePath('/admin');
  revalidatePath(`/admin/${id}`);
}

/** Ajusta o papel de uma pessoa dentro de uma empresa (suporte a acessos). */
export async function setMemberRolePlatformAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const membershipId = String(formData.get('membership_id'));
  const companyId = String(formData.get('company_id'));
  const role = String(formData.get('role'));

  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('id', membershipId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${companyId}`);
}
