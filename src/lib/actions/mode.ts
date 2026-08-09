'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Troca entre o modo residencial e o comercial. */
export async function switchModeAction(modo: 'residencial' | 'comercial') {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_mode', { p_mode: modo });
  if (error) throw new Error(error.message);

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
