'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

/** Registra o recebimento de uma fatura (Zelle, Venmo, cheque, dinheiro...). */
export async function markInvoicePaidAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode dar baixa em faturas');

  const id = String(formData.get('id'));
  const { data: linhasInvoices22, error } = await supabase
    .from('invoices')
    .update({
      status: 'paga',
      paid_at: new Date().toISOString(),
      paid_method: String(formData.get('paid_method') ?? '') || null,
      paid_notes: String(formData.get('paid_notes') ?? '') || null,
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasInvoices22 || linhasInvoices22.length === 0) {
    throw new Error(
      'Não foi possível salvar a fatura: apenas a gestão pode alterar.'
    );
  }

  revalidatePath('/faturas');
  revalidatePath('/dashboard');
}

/** Reabre ou cancela uma fatura. */
export async function setInvoiceStatusAction(id: string, status: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode alterar faturas');

  const { data: linhasInvoices23, error } = await supabase
    .from('invoices')
    .update({
      status,
      ...(status === 'aberta' ? { paid_at: null, paid_method: null, paid_notes: null } : {}),
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasInvoices23 || linhasInvoices23.length === 0) {
    throw new Error(
      'Não foi possível salvar a fatura: apenas a gestão pode alterar.'
    );
  }

  revalidatePath('/faturas');
}

/** Atualiza faturas vencidas (chamado ao abrir a tela). */
export async function refreshOverdueAction() {
  const { supabase } = await getAuth();
  await supabase.rpc('mark_overdue_invoices');
}


/** Edita uma fatura em aberto: valor, descrição, vencimento. */
export async function updateInvoiceAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode editar faturas');

  const id = String(formData.get('id'));
  const valor = Number(formData.get('amount') ?? 0);
  const descricao = String(formData.get('description') ?? '').trim();
  const vencimento = String(formData.get('due_at') ?? '') || null;

  if (valor <= 0) throw new Error('Informe um valor maior que zero');

  const { data: linhasInvoices24, error } = await supabase
    .from('invoices')
    .update({ amount: valor, due_at: vencimento })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasInvoices24 || linhasInvoices24.length === 0) {
    throw new Error(
      'Não foi possível salvar a fatura: apenas a gestão pode alterar.'
    );
  }

  // Refaz os itens para bater com o novo valor
  const { data: itens } = await supabase
    .from('invoice_items')
    .select('id, description, amount, sort_order')
    .eq('invoice_id', id)
    .order('sort_order');

  const lista = itens ?? [];
  if (lista.length === 0) {
    await supabase.from('invoice_items').insert({
      invoice_id: id,
      description: descricao || 'Limpeza',
      amount: valor,
      sort_order: 0,
    });
  } else if (lista.length === 1) {
    await supabase
      .from('invoice_items')
      .update({ description: descricao || lista[0].description, amount: valor })
      .eq('id', lista[0].id)
    .select('id');
  } else {
    // Vários itens: o primeiro absorve a diferença, os extras ficam intactos
    const extras = lista.slice(1).reduce((s: number, i: any) => s + Number(i.amount), 0);
    await supabase
      .from('invoice_items')
      .update({
        description: descricao || lista[0].description,
        amount: Math.max(valor - extras, 0),
      })
      .eq('id', lista[0].id)
    .select('id');
  }

  revalidatePath('/faturas');
  revalidatePath('/dashboard');
}

/**
 * Recalcula uma fatura a partir da limpeza e dos extras aprovados.
 * Útil quando o valor do cliente mudou depois da fatura ter nascido.
 */
export async function recalcInvoiceAction(id: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode recalcular faturas');

  const { data: inv } = await supabase
    .from('invoices')
    .select('id, booking_id, client_id, status')
    .eq('id', id)
    .single();
  if (!inv) throw new Error('Fatura não encontrada');
  if (inv.status === 'paga') throw new Error('Desfaça a baixa antes de recalcular');

  // O cadastro do cliente é a fonte de verdade.
  // O valor do agendamento só prevalece se foi definido a mão naquela limpeza.
  let base = 0;
  if (inv.client_id) {
    const { data: c } = await supabase
      .from('clients')
      .select('default_price')
      .eq('id', inv.client_id)
      .single();
    base = Number(c?.default_price ?? 0);
  }

  if (inv.booking_id) {
    const { data: b } = await supabase
      .from('bookings')
      .select('price, price_manual')
      .eq('id', inv.booking_id)
      .single();
    if (b?.price_manual && Number(b.price) > 0) base = Number(b.price);
    if (base === 0) base = Number(b?.price ?? 0);
  }

  let extras = 0;
  if (inv.booking_id) {
    const { data: ex } = await supabase
      .from('booking_extras')
      .select('price')
      .eq('booking_id', inv.booking_id)
      .eq('status', 'aprovado');
    extras = (ex ?? []).reduce((s: number, e: any) => s + Number(e.price ?? 0), 0);
  }

  const total = base + extras;
  if (total <= 0) throw new Error('O cliente não tem valor definido no cadastro');

  await supabase.from('invoices').update({ amount: total }).eq('id', id)
    .select('id');

  // Item principal passa a valer o novo valor da limpeza
  const { data: itens } = await supabase
    .from('invoice_items')
    .select('id, sort_order')
    .eq('invoice_id', id)
    .order('sort_order');
  const primeiro = (itens ?? [])[0];
  if (primeiro) {
    await supabase.from('invoice_items').update({ amount: base }).eq('id', primeiro.id)
    .select('id');
  } else {
    await supabase
      .from('invoice_items')
      .insert({ invoice_id: id, description: 'Limpeza', amount: base, sort_order: 0 });
  }

  revalidatePath('/faturas');
  revalidatePath('/dashboard');
}
