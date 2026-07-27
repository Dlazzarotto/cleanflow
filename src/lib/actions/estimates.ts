'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { calcEstimate, DEFAULT_SETTINGS, type EstimateInput, type PricingSettings } from '@/lib/pricing';
import { etToUtcIso, addDaysYmd } from '@/lib/tz';

async function getCompanyId() {
  const { supabase, companyId } = await getAuth();
  return { supabase, companyId };
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
  language: string | null;
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
    language: payload.language ?? 'pt',
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

  // Espelha no cliente: enviado -> em espera; recusado -> inativo
  const { data: est } = await supabase.from('estimates').select('client_id').eq('id', id).single();
  if (est?.client_id) {
    if (status === 'enviado') {
      await supabase.from('clients').update({ status: 'em_espera' }).eq('id', est.client_id).neq('status', 'ativo');
    } else if (status === 'recusado') {
      // Nunca teve limpeza concluida => nao fechou (perdido); ja foi cliente => ex-cliente
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', est.client_id)
        .eq('status', 'concluido');
      const novoStatus = (count ?? 0) > 0 ? 'inativo' : 'perdido';
      await supabase
        .from('clients')
        .update({ status: novoStatus })
        .eq('id', est.client_id)
        .in('status', ['em_espera', 'lead']);
    }
  }
  revalidatePath('/estimates');
  revalidatePath('/clientes');
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

  // Estimate aprovado: o cliente vira ativo
  const { data: est } = await supabase.from('estimates').select('client_id').eq('id', id).single();
  if (est?.client_id) {
    await supabase.from('clients').update({ status: 'ativo' }).eq('id', est.client_id);
  }
  revalidatePath('/estimates');
  revalidatePath('/clientes');
}


/** Transforma o lead de um estimate em cliente cadastrado e vincula ao estimate. */
export async function convertEstimateToClientAction(id: string) {
  const { supabase, companyId } = await getCompanyId();

  const { data: e, error: fetchError } = await supabase
    .from('estimates')
    .select('id, client_id, lead_name, lead_phone, lead_email, address, lat, lng, frequency, language')
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
      language: e.language || 'pt',
      status: 'em_espera',
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


/** Atualiza um estimate existente, recalculando tempo e faixa de preco. */
export async function updateEstimateAction(
  id: string,
  payload: {
    client_id: string | null;
    lead_name: string | null;
    lead_phone: string | null;
    lead_email: string | null;
    address: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    frequency: string | null;
    language: string | null;
    input: EstimateInput;
    market_notes: string | null;
  }
) {
  const { supabase } = await getCompanyId();
  const settings = await getPricingSettings();
  const result = calcEstimate(payload.input, settings);

  const { error } = await supabase
    .from('estimates')
    .update({
      client_id: payload.client_id,
      lead_name: payload.client_id ? null : payload.lead_name,
      lead_phone: payload.client_id ? null : payload.lead_phone,
      lead_email: payload.client_id ? null : payload.lead_email,
      address: payload.address,
      city: payload.city,
      lat: payload.lat,
      lng: payload.lng,
      frequency: payload.frequency,
      language: payload.language ?? 'pt',
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
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/estimates');
}


/**
 * Gera a serie de limpezas a partir de um estimate aprovado.
 * Usa a frequencia e o preco fechado do estimate.
 */
export async function createRecurrenceFromEstimateAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const id = String(formData.get('estimate_id'));
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '09:00');
  const teamId = String(formData.get('team_id') ?? '') || null;
  const occurrences = Math.min(Math.max(Number(formData.get('occurrences') ?? 12), 1), 52);

  const { data: e, error: fetchError } = await supabase
    .from('estimates')
    .select('id, client_id, frequency, minutes, final_price, price_low')
    .eq('id', id)
    .single();
  if (fetchError || !e) throw new Error('Estimate não encontrado');
  if (!e.client_id) throw new Error('Converta o lead em cliente antes de agendar a recorrência');

  const step =
    e.frequency === 'semanal' ? 7 : e.frequency === 'quinzenal' ? 14 : e.frequency === 'mensal' ? 28 : 0;
  const total = step > 0 ? occurrences : 1;
  const seriesId = step > 0 ? crypto.randomUUID() : null;
  const price = Number(e.final_price ?? e.price_low ?? 0);

  const rows = Array.from({ length: total }, (_, i) => ({
    company_id: companyId,
    type: 'limpeza',
    client_id: e.client_id,
    team_id: teamId,
    scheduled_at: etToUtcIso(addDaysYmd(date, i * step), time),
    duration_minutes: e.minutes ?? 120,
    price,
    status: 'agendado',
    series_id: seriesId,
  }));

  const { error } = await supabase.from('bookings').insert(rows);
  if (error) throw new Error(error.message);

  await supabase.from('estimates').update({ series_id: seriesId }).eq('id', id);
  await supabase.from('clients').update({ status: 'ativo' }).eq('id', e.client_id);

  revalidatePath('/calendario');
  revalidatePath('/agendamentos');
  revalidatePath('/estimates');
  redirect('/calendario');
}
