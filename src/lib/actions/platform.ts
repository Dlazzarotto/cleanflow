'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/platform';
import { monthlyFee } from '@/lib/plans';

/** Atualiza os dados comerciais/administrativos de uma empresa assinante. */
export async function updateCompanyAccountAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = String(formData.get('id'));

  const { error } = await supabase
    .from('companies')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      representative_name: String(formData.get('representative_name') ?? '') || null,
      phone: String(formData.get('phone') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      website: String(formData.get('website') ?? '') || null,
      plan: String(formData.get('plan') ?? 'standard'),
      extra_teams: Number(formData.get('extra_teams') ?? 0),
      monthly_fee:
        Number(formData.get('monthly_fee') ?? 0) > 0
          ? Number(formData.get('monthly_fee'))
          : monthlyFee(String(formData.get('plan') ?? 'standard'), Number(formData.get('extra_teams') ?? 0)),
      account_status: String(formData.get('account_status') ?? 'ativa'),
      billing_status: String(formData.get('billing_status') ?? 'em_dia'),
      next_due_date: String(formData.get('next_due_date') ?? '') || null,
      platform_notes: String(formData.get('platform_notes') ?? '') || null,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath(`/admin/${id}`);
}

/** Suspende ou reativa o acesso de uma empresa (inadimplencia, cancelamento). */
export async function setAccountStatusAction(id: string, status: string) {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from('companies')
    .update({ account_status: status })
    .eq('id', id);
  if (error) throw new Error(error.message);
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
