'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuth, isManager } from '@/lib/auth';

/** Inicia uma inspeção a partir de um modelo. */
export async function startInspectionAction(formData: FormData) {
  const { supabase, companyId, userId, fullName, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão realiza inspeções');

  const templateId = String(formData.get('template_id'));
  const clientId = String(formData.get('client_id') ?? '') || null;
  const bookingId = String(formData.get('booking_id') ?? '') || null;

  const { data: inspecao, error } = await supabase
    .from('inspections')
    .insert({
      company_id: companyId,
      client_id: clientId,
      booking_id: bookingId,
      template_id: templateId,
      inspector_id: userId,
      inspector_name: fullName || 'Supervisão',
    })
    .select('id')
    .single();
  if (error || !inspecao) throw new Error(error?.message ?? 'Falha ao iniciar a inspeção');

  // Copia os pontos do modelo para esta inspeção
  const { data: pontos } = await supabase
    .from('inspection_points')
    .select('area, item, sort_order')
    .eq('template_id', templateId)
    .order('sort_order');

  if (pontos && pontos.length > 0) {
    const linhas = pontos.map((p: any) => ({
      inspection_id: inspecao.id,
      area: p.area,
      item: p.item,
      sort_order: p.sort_order,
    }));
    const { error: erroPontos } = await supabase.from('inspection_results').insert(linhas);
    if (erroPontos) throw new Error(erroPontos.message);
  }

  redirect(`/inspecoes/${inspecao.id}`);
}

/** Salva a avaliação de um ponto. */
export async function rateItemAction(input: {
  result_id: string;
  rating: number | null;
  na: boolean;
  comment: string | null;
  photos?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) return { ok: false, error: 'Apenas a gestão avalia' };

  const patch: any = {
    rating: input.na ? null : input.rating,
    na: input.na,
    comment: input.comment,
  };
  if (input.photos) patch.photos = input.photos;

  const { data, error } = await supabase
    .from('inspection_results')
    .update(patch)
    .eq('id', input.result_id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Não foi possível salvar a avaliação.' };

  return { ok: true };
}

/** Conclui a inspeção. */
export async function finishInspectionAction(formData: FormData) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão conclui inspeções');

  const id = String(formData.get('id'));
  const { data, error } = await supabase
    .from('inspections')
    .update({
      status: 'concluida',
      notes: String(formData.get('notes') ?? '') || null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Não foi possível concluir a inspeção.');

  revalidatePath('/inspecoes');
  revalidatePath(`/inspecoes/${id}`);
}

/** Reabre para correção. */
export async function reopenInspectionAction(id: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode reabrir');

  const { error } = await supabase
    .from('inspections')
    .update({ status: 'rascunho', finished_at: null })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);

  revalidatePath(`/inspecoes/${id}`);
}

/** Apaga uma inspeção ainda em rascunho. */
export async function deleteInspectionAction(id: string) {
  const { supabase, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode excluir');

  const { error } = await supabase
    .from('inspections')
    .delete()
    .eq('id', id)
    .eq('status', 'rascunho');
  if (error) throw new Error(error.message);

  revalidatePath('/inspecoes');
  redirect('/inspecoes');
}
