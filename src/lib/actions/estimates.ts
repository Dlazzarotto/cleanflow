'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { calcEstimate, DEFAULT_SETTINGS, type EstimateInput, type PricingSettings } from '@/lib/pricing';

async function getCompanyId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Perfil não encontrado');
  return { supabase, companyId: profile.company_id as string };
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const { supabase, companyId } = await getCompanyId();
  const { data } = await supabase
    .from('pricing_settings')
    .select('*')
    .eq('company_id', companyId)
    .single();
  if (!data) return DEFAULT_SETTINGS;
  return {
    hourly_rate: Number(data.hourly_rate ?? DEFAULT_SETTINGS.hourly_rate),
    min_price: Number(data.min_price ?? DEFAULT_SETTINGS.min_price),
    deep_multiplier: Number(data.deep_multiplier ?? DEFAULT_SETTINGS.deep_multiplier),
    cancel_notice_hours: Number(data.cancel_notice_hours ?? DEFAULT_SETTINGS.cancel_notice_hours),
    lockout_fee: Number(data.lockout_fee ?? DEFAULT_SETTINGS.lockout_fee),
    termination_notice_days: Number(data.termination_notice_days ?? DEFAULT_SETTINGS.termination_notice_days),
    solicitation_fee: Number(data.solicitation_fee ?? DEFAULT_SETTINGS.solicitation_fee),
  };
}

export async function savePricingSettingsAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const { error } = await supabase.from('pricing_settings').upsert({
    company_id: companyId,
    hourly_rate: Number(formData.get('hourly_rate') ?? 55),
    min_price: Number(formData.get('min_price') ?? 130),
    deep_multiplier: Number(formData.get('deep_multiplier') ?? 1.5),
    cancel_notice_hours: Number(formData.get('cancel_notice_hours') ?? 48),
    lockout_fee: Number(formData.get('lockout_fee') ?? 70),
    termination_notice_days: Number(formData.get('termination_notice_days') ?? 30),
    solicitation_fee: Number(formData.get('solicitation_fee') ?? 2500),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/estimates');
}

export async function saveEstimateAction(payload: {
  client_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  frequency: string | null;
  input: EstimateInput;
  market_notes: string | null;
}) {
  const { supabase, companyId } = await getCompanyId();
  const settings = await getPricingSettings();
  const result = calcEstimate(payload.input, settings);

  const { error } = await supabase.from('estimates').insert({
    company_id: companyId,
    client_id: payload.client_id,
    lead_name: payload.client_id ? null : payload.lead_name,
    lead_phone: payload.client_id ? null : payload.lead_phone,
    lead_email: payload.client_id ? null : payload.lead_email,
    address: payload.address,
    city: payload.city,
    lat: payload.lat,
    lng: payload.lng,
    frequency: payload.frequency,
    bedrooms: payload.input.bedrooms,
    full_baths: payload.input.full_baths,
    half_baths: payload.input.half_baths,
    extras: payload.input.extras,
    bedroom_tasks: payload.input.bedroom_tasks,
    bathroom_tasks: payload.input.bathroom_tasks,
    laundry: payload.input.laundry,
    laundry_loads: payload.input.laundry_loads,
    deep_clean: payload.input.deep_clean,
    minutes: result.minutes,
    price_low: result.price_low,
    price_high: result.price_high,
    hourly_rate: settings.hourly_rate,
    market_notes: payload.market_notes,
    status: 'rascunho',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/estimates');
}

export async function updateEstimateStatusAction(id: string, status: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from('estimates').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/estimates');
}

/** Aprova o estimate definindo o preco fechado (usado no contrato). */
export async function approveEstimateAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const id = String(formData.get('id'));
  const finalPrice = Number(formData.get('final_price') ?? 0);
  const { error } = await supabase
    .from('estimates')
    .update({ status: 'aprovado', final_price: finalPrice > 0 ? finalPrice : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/estimates');
}


/** Transforma o lead de um estimate em cliente cadastrado e vincula ao estimate. */
export async function convertEstimateToClientAction(id: string) {
  const { supabase, companyId } = await getCompanyId();

  const { data: e, error: fetchError } = await supabase
    .from('estimates')
    .select('id, client_id, lead_name, lead_phone, lead_email, address, lat, lng, frequency')
    .eq('id', id)
    .single();
  if (fetchError || !e) throw new Error('Estimate não encontrado');
  if (e.client_id) return; // ja tem cliente vinculado

  const { data: created, error: insertError } = await supabase
    .from('clients')
    .insert({
      company_id: companyId,
      full_name: e.lead_name?.trim() || e.address || 'Cliente sem nome',
      phone: e.lead_phone || null,
      email: e.lead_email || null,
      address: e.address || null,
      lat: e.lat,
      lng: e.lng,
      frequency: e.frequency || null,
    })
    .select('id')
    .single();
  if (insertError || !created) throw new Error(insertError?.message ?? 'Falha ao criar cliente');

  const { error: linkError } = await supabase
    .from('estimates')
    .update({ client_id: created.id })
    .eq('id', id);
  if (linkError) throw new Error(linkError.message);

  revalidatePath('/estimates');
  revalidatePath('/clientes');
}
