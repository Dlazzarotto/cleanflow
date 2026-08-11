'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

export interface ItemProposta {
  area: string;
  item: string;
  unit: string;
  qty: number;
  minutes_per_unit: number;
  soil_multiplier: number;
  minutes: number;
  sort_order: number;
}

/** Salva um orçamento comercial com os itens escolhidos. */
export async function saveCommercialEstimateAction(input: {
  client_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  address: string | null;
  segment: string;
  area_sqft: number | null;
  frequency: string;
  visits_per_month: number;
  soil_level: string;
  crew_size: number;
  night_shift: boolean;
  supplies_included: boolean;
  total_minutes: number;
  hourly_rate: number;
  price_per_visit: number;
  price_monthly: number;
  notes: string | null;
  items: ItemProposta[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, companyId, userId, role } = await getAuth();
  if (!isManager(role)) return { ok: false, error: 'Apenas a gestão cria propostas' };

  const { data: proposta, error } = await supabase
    .from('commercial_estimates')
    .insert({
      company_id: companyId,
      client_id: input.client_id,
      lead_name: input.lead_name,
      lead_phone: input.lead_phone,
      lead_email: input.lead_email,
      address: input.address,
      segment: input.segment,
      area_sqft: input.area_sqft,
      frequency: input.frequency,
      visits_per_month: input.visits_per_month,
      soil_level: input.soil_level,
      crew_size: input.crew_size,
      night_shift: input.night_shift,
      supplies_included: input.supplies_included,
      total_minutes: input.total_minutes,
      hourly_rate: input.hourly_rate,
      price_per_visit: input.price_per_visit,
      price_monthly: input.price_monthly,
      notes: input.notes,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !proposta) return { ok: false, error: error?.message ?? 'Falha ao salvar' };

  if (input.items.length > 0) {
    const linhas = input.items.map((i) => ({ ...i, estimate_id: proposta.id }));
    const { error: erroItens } = await supabase.from('commercial_estimate_items').insert(linhas);
    if (erroItens) return { ok: false, error: erroItens.message };
  }

  revalidatePath('/comercial/propostas');
  return { ok: true, id: proposta.id };
}

/** Ajusta o valor final e a situação da proposta. */
export async function updateCommercialEstimateAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão altera propostas');

  const id = String(formData.get('id'));
  const finalValue = String(formData.get('final_monthly') ?? '');

  const { data, error } = await supabase
    .from('commercial_estimates')
    .update({
      final_monthly: finalValue === '' ? null : Number(finalValue),
      status: String(formData.get('status') ?? 'rascunho'),
      notes: String(formData.get('notes') ?? '') || null,
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Não foi possível salvar a proposta.');

  revalidatePath('/comercial/propostas');
  revalidatePath(`/comercial/propostas/${id}`);
}

/** Aprova a proposta: vira contrato no cadastro do cliente. */
export async function approveCommercialEstimateAction(id: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão aprova propostas');

  const { data: e } = await supabase
    .from('commercial_estimates')
    .select('*')
    .eq('id', id)
    .single();
  if (!e) throw new Error('Proposta não encontrada');

  const valor = Number(e.final_monthly ?? e.price_monthly);

  if (e.client_id) {
    await supabase
      .from('clients')
      .update({
        status: 'ativo',
        client_type: 'comercial',
        business_segment: e.segment,
        area_sqft: e.area_sqft,
        billing_type: 'mensal_fixo',
        monthly_contract_value: valor,
        frequency: ['semanal', 'quinzenal', 'mensal'].includes(e.frequency) ? e.frequency : null,
      })
      .eq('id', e.client_id)
      .select('id');
  }

  await supabase
    .from('commercial_estimates')
    .update({ status: 'aprovado' })
    .eq('id', id)
    .select('id');

  revalidatePath('/comercial/propostas');
  revalidatePath(`/comercial/propostas/${id}`);
  revalidatePath('/clientes');
}
