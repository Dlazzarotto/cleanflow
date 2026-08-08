'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

/** Junta dois cadastros do mesmo cliente em um só. */
export async function mergeClientsAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode juntar cadastros');

  const principal = String(formData.get('principal'));
  const duplicado = String(formData.get('duplicado'));

  const { error } = await supabase.rpc('merge_clients', {
    p_principal: principal,
    p_duplicado: duplicado,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/clientes');
  revalidatePath('/clientes/duplicados');
  revalidatePath('/dashboard');
}
