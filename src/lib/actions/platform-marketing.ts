'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/platform';

function slugify(t: string) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function createPlatformCampaignAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const nome = String(formData.get('name') ?? '').trim();

  const { error } = await supabase.from('platform_campaigns').insert({
    slug: slugify(nome) + '-' + Math.random().toString(36).slice(-4),
    name: nome,
    partner_name: String(formData.get('partner_name') ?? '') || null,
    channel: String(formData.get('channel') ?? '') || null,
    commission_type: String(formData.get('commission_type') ?? 'por_assinatura'),
    commission_value: Number(formData.get('commission_value') ?? 0),
    notes: String(formData.get('notes') ?? '') || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing');
}

export async function updatePlatformCampaignAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const { data: linhasPlatformCampaigns25, error } = await supabase
    .from('platform_campaigns')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      partner_name: String(formData.get('partner_name') ?? '') || null,
      channel: String(formData.get('channel') ?? '') || null,
      commission_type: String(formData.get('commission_type') ?? 'por_assinatura'),
      commission_value: Number(formData.get('commission_value') ?? 0),
      active: formData.get('active') === 'on',
    })
    .eq('id', String(formData.get('id')))
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasPlatformCampaigns25 || linhasPlatformCampaigns25.length === 0) {
    throw new Error(
      'Não foi possível salvar a campanha.'
    );
  }
  revalidatePath('/admin/marketing');
}

export async function updatePlatformLeadAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const { data: linhasPlatformLeads26, error } = await supabase
    .from('platform_leads')
    .update({
      status: String(formData.get('status') ?? 'novo'),
      notes: String(formData.get('notes') ?? '') || null,
      lost_reason: String(formData.get('lost_reason') ?? '') || null,
      company_id: String(formData.get('company_id') ?? '') || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(formData.get('id')))
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasPlatformLeads26 || linhasPlatformLeads26.length === 0) {
    throw new Error(
      'Não foi possível salvar o lead.'
    );
  }
  revalidatePath('/admin/marketing');
}
