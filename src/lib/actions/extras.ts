'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

/** Equipe registra um extra pedido pelo cliente durante o serviço. */
export async function requestExtraAction(input: {
  booking_id: string;
  extra_id: string | null;
  description: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await getAuth();

  if (!input.extra_id && input.description.trim().length < 3) {
    return { ok: false, error: 'Descreva o serviço que o cliente pediu.' };
  }

  // O preço vem do catálogo, resolvido no banco — o app da equipe nunca envia valores
  const { error } = await supabase.rpc('request_extra', {
    p_booking: input.booking_id,
    p_extra: input.extra_id,
    p_description: input.description.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/minha-agenda');
  revalidatePath('/faturas');
  return { ok: true };
}

/** Gestão define o preço e aprova (ou recusa) um extra fora do catálogo. */
export async function decideExtraAction(formData: FormData) {
  const { supabase, userId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão decide sobre serviços extras');

  const id = String(formData.get('id'));
  const decisao = String(formData.get('decision'));
  const preco = String(formData.get('price') ?? '');

  const { error } = await supabase
    .from('booking_extras')
    .update({
      status: decisao === 'aprovar' ? 'aprovado' : 'recusado',
      price: decisao === 'aprovar' && preco !== '' ? Number(preco) : null,
      notes: String(formData.get('notes') ?? '') || null,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/faturas');
  revalidatePath('/minha-agenda');
}

/** Catálogo de extras. */
export async function createExtraCatalogAction(formData: FormData) {
  const { supabase, companyId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão administra o catálogo');

  const { error } = await supabase.from('service_extras').insert({
    company_id: companyId,
    name: String(formData.get('name') ?? '').trim(),
    price: Number(formData.get('price') ?? 0),
    minutes: Number(formData.get('minutes') ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/faturas');
}

export async function updateExtraCatalogAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão administra o catálogo');

  const { error } = await supabase
    .from('service_extras')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      price: Number(formData.get('price') ?? 0),
      minutes: Number(formData.get('minutes') ?? 0),
      active: formData.get('active') === 'on',
    })
    .eq('id', String(formData.get('id')));
  if (error) throw new Error(error.message);
  revalidatePath('/faturas');
}

/** Fatura avulsa: extra pedido fora de uma limpeza, cobrança separada. */
export async function createStandaloneInvoiceAction(formData: FormData) {
  const { supabase, companyId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão emite faturas');

  const clientId = String(formData.get('client_id'));
  const descricao = String(formData.get('description') ?? '').trim();
  const valor = Number(formData.get('amount') ?? 0);
  if (!clientId || valor <= 0) throw new Error('Selecione o cliente e informe o valor');

  const { data: last } = await supabase
    .from('invoices')
    .select('number')
    .eq('company_id', companyId)
    .order('number', { ascending: false })
    .limit(1)
    .single();

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('invoice_due_days')
    .eq('company_id', companyId)
    .single();

  const dias = settings?.invoice_due_days ?? 3;
  const vence = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      company_id: companyId,
      client_id: clientId,
      number: (last?.number ?? 0) + 1,
      amount: valor,
      due_at: vence,
    })
    .select('id')
    .single();
  if (error || !invoice) throw new Error(error?.message ?? 'Falha ao criar a fatura');

  await supabase.from('invoice_items').insert({
    invoice_id: invoice.id,
    description: descricao || 'Serviço avulso',
    amount: valor,
  });

  revalidatePath('/faturas');
}
