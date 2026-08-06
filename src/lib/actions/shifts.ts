'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';

/** Inicia a jornada do dia (registra hora e local de saida). */
export async function startDayAction(input: {
  lat: number | null;
  lng: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, companyId, userId, fullName } = await getAuth();

  const { data: open } = await supabase.rpc('my_open_shift');
  if (open) return { ok: false, error: 'Você já tem um dia em andamento.' };

  const { error } = await supabase.from('work_shifts').insert({
    company_id: companyId,
    user_id: userId,
    person_name: fullName || 'Equipe',
    start_lat: input.lat,
    start_lng: input.lng,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/minha-agenda');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** Encerra a jornada do dia. */
export async function endDayAction(input: {
  lat: number | null;
  lng: number | null;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await getAuth();

  const { data: openId } = await supabase.rpc('my_open_shift');
  if (!openId) return { ok: false, error: 'Nenhum dia em andamento.' };

  const { data: linhasJornada, error } = await supabase
    .from('work_shifts')
    .update({
      ended_at: new Date().toISOString(),
      end_lat: input.lat,
      end_lng: input.lng,
      note: input.note?.trim() || null,
    })
    .eq('id', openId as string)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!linhasJornada || linhasJornada.length === 0) {
    return { ok: false, error: 'Não foi possível encerrar o dia. Tente novamente.' };
  }

  revalidatePath('/minha-agenda');
  revalidatePath('/dashboard');
  return { ok: true };
}
