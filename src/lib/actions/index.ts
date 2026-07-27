'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { PERMISSION_KEYS } from '@/lib/permissions';
import { etToUtcIso, addDaysYmd } from '@/lib/tz';

async function getCompanyId() {
  const { supabase, companyId } = await getAuth();
  return { supabase, companyId };
}

// ---------- CLIENTES ----------
export async function createClientAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const { error } = await supabase.from('clients').insert({
    company_id: companyId,
    full_name: String(formData.get('full_name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '') || null,
    email: String(formData.get('email') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
    unit: String(formData.get('unit') ?? '') || null,
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
    door_code: String(formData.get('door_code') ?? '') || null,
    has_pets: formData.get('has_pets') === 'on',
    pets_notes: String(formData.get('pets_notes') ?? '') || null,
    alarm_notes: String(formData.get('alarm_notes') ?? '') || null,
    preferences: String(formData.get('preferences') ?? '') || null,
    products_notes: String(formData.get('products_notes') ?? '') || null,
    frequency: String(formData.get('frequency') ?? '') || null,
    language: String(formData.get('language') ?? 'pt'),
    status: String(formData.get('status') ?? 'lead'),
    source: String(formData.get('source') ?? '') || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/clientes');
  redirect('/clientes');
}

// ---------- EQUIPES ----------
export async function createTeamAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const { error } = await supabase.from('teams').insert({
    company_id: companyId,
    name: String(formData.get('name') ?? '').trim(),
    color: String(formData.get('color') ?? '#13706B'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

// ---------- AGENDAMENTOS ----------

/**
 * Cria uma limpeza. Se "repeat" for semanal/quinzenal/mensal,
 * cria a série completa com o mesmo series_id.
 */
export async function createBookingAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const repeat = String(formData.get('repeat') ?? 'nao');
  const occurrences = Math.min(Math.max(Number(formData.get('occurrences') ?? 1), 1), 52);

  const base = {
    company_id: companyId,
    type: String(formData.get('type') ?? 'limpeza'),
    client_id: String(formData.get('client_id')),
    team_id: String(formData.get('team_id') ?? '') || null,
    duration_minutes: Number(formData.get('duration_minutes') ?? 120),
    price: Number(formData.get('price') ?? 0),
    notes: String(formData.get('notes') ?? '') || null,
    status: 'agendado',
  };

  const stepDays = repeat === 'semanal' ? 7 : repeat === 'quinzenal' ? 14 : repeat === 'mensal' ? 28 : 0;
  const total = stepDays > 0 ? occurrences : 1;
  const seriesId = stepDays > 0 ? crypto.randomUUID() : null;

  const rows = Array.from({ length: total }, (_, i) => ({
    ...base,
    scheduled_at: etToUtcIso(addDaysYmd(date, i * stepDays), time),
    series_id: seriesId,
  }));

  const { error } = await supabase.from('bookings').insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath('/agendamentos');
  revalidatePath('/calendario');
  redirect('/calendario');
}

export async function updateBookingStatusAction(id: string, status: string) {
  const { supabase } = await getCompanyId();
  const patch: Record<string, unknown> = { status };
  if (status === 'em_andamento') patch.checkin_at = new Date().toISOString();
  if (status === 'concluido') patch.checkout_at = new Date().toISOString();
  const { error } = await supabase.from('bookings').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/agendamentos');
  revalidatePath('/dashboard');
}

/**
 * Edita uma limpeza a partir do calendário.
 * scope = 'one': só esta ocorrência.
 * scope = 'series': esta e as próximas da mesma série
 * (a mudança de data/hora desloca as futuras pelo mesmo intervalo).
 */
export async function updateBookingAction(input: {
  id: string;
  scope: 'one' | 'series';
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  duration_minutes: number;
  price: number;
  team_id: string | null;
  status: string;
}) {
  const { supabase } = await getCompanyId();

  const { data: current, error: fetchError } = await supabase
    .from('bookings')
    .select('id, series_id, scheduled_at')
    .eq('id', input.id)
    .single();
  if (fetchError || !current) throw new Error('Limpeza não encontrada');

  const newStart = new Date(etToUtcIso(input.date, input.time));
  const patchCommon = {
    duration_minutes: input.duration_minutes,
    price: input.price,
    team_id: input.team_id,
    status: input.status,
  };

  if (input.scope === 'series' && current.series_id) {
    const deltaMs = newStart.getTime() - new Date(current.scheduled_at).getTime();
    const { data: futureOnes, error: listError } = await supabase
      .from('bookings')
      .select('id, scheduled_at')
      .eq('series_id', current.series_id)
      .gte('scheduled_at', current.scheduled_at);
    if (listError) throw new Error(listError.message);

    for (const b of futureOnes ?? []) {
      const shifted = new Date(new Date(b.scheduled_at).getTime() + deltaMs);
      const { error } = await supabase
        .from('bookings')
        .update({ ...patchCommon, scheduled_at: shifted.toISOString() })
        .eq('id', b.id);
      if (error) throw new Error(error.message);
    }
  } else {
    const { error } = await supabase
      .from('bookings')
      .update({ ...patchCommon, scheduled_at: newStart.toISOString() })
      .eq('id', input.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/agendamentos');
  revalidatePath('/calendario');
  revalidatePath('/dashboard');
}

/**
 * Cancela uma limpeza (ou esta e as próximas da série).
 */
export async function cancelBookingAction(input: { id: string; scope: 'one' | 'series' }) {
  const { supabase } = await getCompanyId();

  const { data: current, error: fetchError } = await supabase
    .from('bookings')
    .select('id, series_id, scheduled_at')
    .eq('id', input.id)
    .single();
  if (fetchError || !current) throw new Error('Limpeza não encontrada');

  if (input.scope === 'series' && current.series_id) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelado' })
      .eq('series_id', current.series_id)
      .gte('scheduled_at', current.scheduled_at);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelado' })
      .eq('id', input.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/agendamentos');
  revalidatePath('/calendario');
  revalidatePath('/dashboard');
}


// ---------- EDICAO DE CLIENTE ----------
export async function updateClientAction(id: string, formData: FormData) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('clients')
    .update({
      full_name: String(formData.get('full_name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      address: String(formData.get('address') ?? '') || null,
      unit: String(formData.get('unit') ?? '') || null,
      ...(formData.get('lat') ? { lat: Number(formData.get('lat')) } : {}),
      ...(formData.get('lng') ? { lng: Number(formData.get('lng')) } : {}),
      door_code: String(formData.get('door_code') ?? '') || null,
      has_pets: formData.get('has_pets') === 'on',
      pets_notes: String(formData.get('pets_notes') ?? '') || null,
      alarm_notes: String(formData.get('alarm_notes') ?? '') || null,
      preferences: String(formData.get('preferences') ?? '') || null,
      products_notes: String(formData.get('products_notes') ?? '') || null,
      frequency: String(formData.get('frequency') ?? '') || null,
      language: String(formData.get('language') ?? 'pt'),
      status: String(formData.get('status') ?? 'ativo'),
      source: String(formData.get('source') ?? '') || null,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/clientes');
  redirect(`/clientes/${id}`);
}

// ---------- EDICAO DE EQUIPE ----------
export async function updateTeamAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const id = String(formData.get('id'));
  const { error } = await supabase
    .from('teams')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      color: String(formData.get('color') ?? '#13706B'),
      active: formData.get('active') === 'on',
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

// ---------- MEMBROS DA EQUIPE ----------
export async function addTeamMemberAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from('team_members').insert({
    team_id: String(formData.get('team_id')),
    profile_id: String(formData.get('user_id')),
  });
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  revalidatePath('/equipes');
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('profile_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

// ---------- VINCULO (ativar/desativar acesso) ----------
export async function setMembershipActiveAction(membershipId: string, active: boolean) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('memberships')
    .update({ active })
    .eq('id', membershipId);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}


// ---------- STATUS PELA EQUIPE (via funcao segura, sem acesso a valores) ----------
export async function updateMyBookingStatusAction(
  id: string,
  status: string,
  lat?: number | null,
  lng?: number | null
) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.rpc('set_my_booking_status', {
    p_booking: id,
    p_status: status,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/minha-agenda');
}


// ---------- CARGOS ----------
export async function createPositionAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const permissions: Record<string, boolean> = {};
  for (const { key } of PERMISSION_KEYS) {
    permissions[key] = formData.get(`perm_${key}`) === 'on';
  }
  const { error } = await supabase.from('positions').insert({
    company_id: companyId,
    name: String(formData.get('name') ?? '').trim(),
    permissions,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

export async function updatePositionAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const id = String(formData.get('id'));
  const permissions: Record<string, boolean> = {};
  for (const { key } of PERMISSION_KEYS) {
    permissions[key] = formData.get(`perm_${key}`) === 'on';
  }
  const { error } = await supabase
    .from('positions')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      permissions,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

export async function deletePositionAction(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from('positions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}

export async function setMemberPositionAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const membershipId = String(formData.get('membership_id'));
  const positionId = String(formData.get('position_id') ?? '');
  const { error } = await supabase
    .from('memberships')
    .update({ position_id: positionId || null })
    .eq('id', membershipId);
  if (error) throw new Error(error.message);
  revalidatePath('/equipes');
}


// ---------- CONFIGURACOES ----------
export async function updateMyNameAction(formData: FormData) {
  const { supabase, userId, companyId } = await getAuth();
  const { error } = await supabase
    .from('memberships')
    .update({ full_name: String(formData.get('full_name') ?? '').trim() })
    .eq('user_id', userId)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  revalidatePath('/configuracoes');
}

export async function saveLocaleAction(formData: FormData) {
  const { supabase, userId, companyId } = await getAuth();
  const locale = String(formData.get('locale') ?? 'pt');
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    active_company_id: companyId,
    locale,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/configuracoes');
}

export async function updateCompanyAction(formData: FormData) {
  const { supabase, companyId, role } = await getAuth();
  if (!['owner', 'admin', 'supervisor'].includes(role)) {
    throw new Error('Apenas a gestão pode editar os dados da empresa');
  }
  const { error } = await supabase
    .from('companies')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      address: String(formData.get('address') ?? '') || null,
      ...(formData.get('lat') ? { lat: Number(formData.get('lat')) } : {}),
      ...(formData.get('lng') ? { lng: Number(formData.get('lng')) } : {}),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
  revalidatePath('/configuracoes');
}


// ---------- GEOCODIFICACAO EM LOTE ----------
export async function saveClientCoordsAction(id: string, lat: number, lng: number, address?: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('clients')
    .update({ lat, lng, ...(address ? { address } : {}) })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/clientes');
}


// ---------- BANIMENTO DE CLIENTE (somente owner, com senha e motivo) ----------
export async function banClientAction(input: {
  id: string;
  reason: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, userId, role } = await getAuth();

  if (role !== 'owner') {
    return { ok: false, error: 'Apenas o dono da empresa pode banir um cliente.' };
  }
  const reason = input.reason.trim();
  if (reason.length < 10) {
    return { ok: false, error: 'Descreva o motivo do banimento (mínimo 10 caracteres).' };
  }

  // Confirma a identidade validando a senha, sem afetar a sessão atual
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return { ok: false, error: 'Não foi possível confirmar sua identidade.' };

  const { createClient: createPlainClient } = await import('@supabase/supabase-js');
  const check = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: authError } = await check.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (authError) {
    return { ok: false, error: 'Senha incorreta. O cliente não foi banido.' };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      status: 'deletado',
      ban_reason: reason,
      banned_at: new Date().toISOString(),
      banned_by: userId,
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${input.id}`);
  return { ok: true };
}

export async function unbanClientAction(id: string) {
  const { supabase, role } = await getAuth();
  if (role !== 'owner') {
    throw new Error('Apenas o dono da empresa pode reverter um banimento.');
  }
  const { error } = await supabase
    .from('clients')
    .update({ status: 'inativo' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
}


// ---------- MARKETING ----------
export async function setMarketingOptInAction(id: string, value: boolean) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from('clients').update({ marketing_opt_in: value }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/marketing');
}

export async function saveLostReasonAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('clients')
    .update({ lost_reason: String(formData.get('lost_reason') ?? '') || null })
    .eq('id', String(formData.get('id')));
  if (error) throw new Error(error.message);
  revalidatePath('/marketing');
}

export async function markContactedAction(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase
    .from('clients')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/marketing');
}
