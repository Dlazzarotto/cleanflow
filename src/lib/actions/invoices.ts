'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

/** Registra o recebimento de uma fatura (Zelle, Venmo, cheque, dinheiro...). */
export async function markInvoicePaidAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode dar baixa em faturas');

  const id = String(formData.get('id'));
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paga',
      paid_at: new Date().toISOString(),
      paid_method: String(formData.get('paid_method') ?? '') || null,
      paid_notes: String(formData.get('paid_notes') ?? '') || null,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/faturas');
  revalidatePath('/dashboard');
}

/** Reabre ou cancela uma fatura. */
export async function setInvoiceStatusAction(id: string, status: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode alterar faturas');

  const { error } = await supabase
    .from('invoices')
    .update({
      status,
      ...(status === 'aberta' ? { paid_at: null, paid_method: null, paid_notes: null } : {}),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/faturas');
}

/** Atualiza faturas vencidas (chamado ao abrir a tela). */
export async function refreshOverdueAction() {
  const { supabase } = await getAuth();
  await supabase.rpc('mark_overdue_invoices');
}
