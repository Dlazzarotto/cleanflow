'use server';

import { revalidatePath } from 'next/cache';
import { getAuth, isManager } from '@/lib/auth';

export interface IncidentInput {
  booking_id: string | null;
  client_id: string | null;
  kind: string;
  moment: string;
  severity: string;
  description: string;
  photos: string[];
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
}

/** Registra uma ocorrencia. Qualquer pessoa da empresa pode reportar. */
export async function createIncidentAction(
  input: IncidentInput
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, companyId, userId, fullName } = await getAuth();

  const description = input.description.trim();
  if (description.length < 10) {
    return { ok: false, error: 'Descreva o que aconteceu com pelo menos 10 caracteres.' };
  }

  const { error } = await supabase.from('incidents').insert({
    company_id: companyId,
    booking_id: input.booking_id,
    client_id: input.client_id,
    reported_by: userId,
    reporter_name: fullName || 'Equipe',
    kind: input.kind,
    moment: input.moment,
    severity: input.severity,
    description,
    photos: input.photos,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    distance_m: input.distance_m ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/minha-agenda');
  revalidatePath('/ocorrencias');
  return { ok: true };
}

/** Gestao trata a ocorrencia (o relato original permanece intacto). */
export async function resolveIncidentAction(formData: FormData) {
  const { supabase, userId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode tratar ocorrências');

  const id = String(formData.get('id'));
  const status = String(formData.get('status') ?? 'em_analise');
  const notes = String(formData.get('resolution_notes') ?? '') || null;

  const { error } = await supabase
    .from('incidents')
    .update({
      status,
      resolution_notes: notes,
      resolved_by: status === 'resolvida' ? userId : null,
      resolved_at: status === 'resolvida' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/ocorrencias');
}


/**
 * Equipe fez check-in, tentou contato e nao conseguiu entrar.
 * NAO gera cobranca sozinho: fica como pedido para a gestao aprovar.
 */
export async function requestLockoutAction(input: {
  booking_id: string;
  client_id: string | null;
  reason: string;
  attempts: string[];
  description: string;
  photos: string[];
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, companyId, userId, fullName } = await getAuth();

  if (input.attempts.length === 0) {
    return { ok: false, error: 'Marque ao menos uma tentativa de contato com o cliente.' };
  }

  const { error: rpcError } = await supabase.rpc('request_lockout', {
    p_booking: input.booking_id,
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (rpcError) return { ok: false, error: rpcError.message };

  const texto = [
    input.reason,
    `Tentativas: ${input.attempts.join(', ')}`,
    input.description.trim(),
  ]
    .filter(Boolean)
    .join(' — ');

  const { error } = await supabase.from('incidents').insert({
    company_id: companyId,
    booking_id: input.booking_id,
    client_id: input.client_id,
    reported_by: userId,
    reporter_name: fullName || 'Equipe',
    kind: 'acesso',
    moment: 'chegada',
    severity: 'alta',
    description: `Equipe compareceu e não conseguiu entrar. ${texto}`,
    photos: input.photos,
    lat: input.lat,
    lng: input.lng,
    distance_m: input.distance_m,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/minha-agenda');
  revalidatePath('/ocorrencias');
  revalidatePath('/agendamentos');
  return { ok: true };
}

/** Gestao decide sobre o pedido de "sem acesso" (aprovar gera a cobranca da taxa). */
export async function decideLockoutAction(formData: FormData) {
  const { supabase, userId, role } = await getAuth();
  if (!isManager(role)) throw new Error('Apenas a gestão pode decidir sobre a taxa');

  const bookingId = String(formData.get('booking_id'));
  const decision = String(formData.get('decision'));
  const aprovar = decision === 'aprovar';

  const { error } = await supabase
    .from('bookings')
    .update({
      lockout_status: aprovar ? 'aprovado' : 'recusado',
      lockout_decided_by: userId,
      lockout_decided_at: new Date().toISOString(),
      status: aprovar ? 'sem_acesso' : 'em_andamento',
    })
    .eq('id', bookingId);
  if (error) throw new Error(error.message);

  revalidatePath('/ocorrencias');
  revalidatePath('/agendamentos');
  revalidatePath('/minha-agenda');
}

/** Encerra sozinho quando a equipe se afasta do local com o servico em andamento. */
export async function autoCloseBookingAction(input: {
  booking_id: string;
  client_id: string | null;
  lat: number;
  lng: number;
  distance_m: number;
}): Promise<{ ok: boolean }> {
  const { supabase, companyId, userId, fullName } = await getAuth();

  const { error } = await supabase.rpc('auto_close_my_booking', {
    p_booking: input.booking_id,
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error) return { ok: false };

  await supabase.from('incidents').insert({
    company_id: companyId,
    booking_id: input.booking_id,
    client_id: input.client_id,
    reported_by: userId,
    reporter_name: fullName || 'Equipe',
    kind: 'saida_automatica',
    moment: 'saida',
    severity: 'media',
    description:
      `Serviço encerrado automaticamente: a equipe se afastou ${input.distance_m} m da casa ` +
      `sem registrar o check-out. Verifique com a equipe se o serviço foi concluído.`,
    photos: [],
    lat: input.lat,
    lng: input.lng,
    distance_m: input.distance_m,
  });

  revalidatePath('/minha-agenda');
  revalidatePath('/ocorrencias');
  return { ok: true };
}
