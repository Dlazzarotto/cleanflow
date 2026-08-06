'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function createCampaignAction(formData: FormData) {
  const { supabase, companyId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão cria campanhas');

  const nome = String(formData.get('name') ?? '').trim();
  const base = slugify(String(formData.get('slug') ?? '') || nome);
  const slug = base + '-' + Math.random().toString(36).slice(-4);

  const { error } = await supabase.from('campaigns').insert({
    company_id: companyId,
    slug,
    name: nome,
    partner_name: String(formData.get('partner_name') ?? '') || null,
    channel: String(formData.get('channel') ?? '') || null,
    owner_user_id: String(formData.get('owner_user_id') ?? '') || null,
    commission_type: String(formData.get('commission_type') ?? 'por_fechamento'),
    commission_value: Number(formData.get('commission_value') ?? 0),
    notes: String(formData.get('notes') ?? '') || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/campanhas');
}

export async function updateCampaignAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão altera campanhas');

  const { data: linhasCampaigns0, error } = await supabase
    .from('campaigns')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      partner_name: String(formData.get('partner_name') ?? '') || null,
      channel: String(formData.get('channel') ?? '') || null,
      owner_user_id: String(formData.get('owner_user_id') ?? '') || null,
      commission_type: String(formData.get('commission_type') ?? 'por_fechamento'),
      commission_value: Number(formData.get('commission_value') ?? 0),
      active: formData.get('active') === 'on',
      notes: String(formData.get('notes') ?? '') || null,
    })
    .eq('id', String(formData.get('id')))
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasCampaigns0 || linhasCampaigns0.length === 0) {
    throw new Error(
      'Não foi possível salvar a campanha.'
    );
  }

  revalidatePath('/campanhas');
}
