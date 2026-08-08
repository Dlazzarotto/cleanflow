'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { PERMISSION_KEYS } from '@/lib/permissions';
import { etToUtcIso, addDaysYmd } from '@/lib/tz';
import { createClient as createServerClient } from '@/lib/supabase/server';

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
    status: String(formData.get('status') ?? 'ativo'),
    source: String(formData.get('source') ?? '') || null,
    entry_source: formData.get('from_marketing') === 'on' ? 'marketing' : 'organico',
    payment_method: String(formData.get('payment_method') ?? '') || null,
    default_price: String(formData.get('default_price') ?? '') === ''
      ? null
      : Number(formData.get('default_price')),
    ...(formData.has('preferred_team_id')
      ? { preferred_team_id: String(formData.get('preferred_team_id') ?? '') || null }
      : {}),
    client_type: String(formData.get('client_type') ?? 'residencial'),
    business_segment: String(formData.get('business_segment') ?? '') || null,
    area_sqft: String(formData.get('area_sqft') ?? '') === '' ? null : Number(formData.get('area_sqft')),
    contact_role: String(formData.get('contact_role') ?? '') || null,
    access_notes: String(formData.get('access_notes') ?? '') || null,
    billing_type: String(formData.get('billing_type') ?? 'por_limpeza'),
    monthly_contract_value: String(formData.get('monthly_contract_value') ?? '') === ''
      ? null
      : Number(formData.get('monthly_contract_value')),
    payment_terms: String(formData.get('payment_terms') ?? '') || null,
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
  if (error) {
    if (error.message.includes('plano permite')) {
      throw new Error(
        'Limite de equipes do seu plano atingido. Fale com o suporte do CleanFlow para fazer upgrade.'
      );
    }
    throw new Error(error.message);
  }
  revalidatePath('/equipes');
}

// ---------- AGENDAMENTOS ----------

/**
 * Cria uma limpeza. Se "repeat" for semanal/quinzenal/3 semanas/mensal,
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
    service_type: String(formData.get('service_type') ?? 'manutencao'),
    client_id: String(formData.get('client_id')),
    team_id: String(formData.get('team_id') ?? '') || null,
    duration_minutes: Number(formData.get('duration_minutes') ?? 120),
    price: Number(formData.get('price') ?? 0),
    notes: String(formData.get('notes') ?? '') || null,
    status: 'agendado',
  };

  const stepDays =
    repeat === 'semanal' ? 7
      : repeat === 'quinzenal' ? 14
        : repeat === 'tres_semanas' ? 21
          : repeat === 'mensal' ? 28
            : 0;
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
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
    .select('id');
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
  frequency?: string | null;   // muda o intervalo da série
}) {
  const { supabase } = await getCompanyId();

  const { data: current, error: fetchError } = await supabase
    .from('bookings')
    .select('id, series_id, scheduled_at, client_id')
    .eq('id', input.id)
    .single();
  if (fetchError || !current) throw new Error('Limpeza não encontrada');

  const newStart = new Date(etToUtcIso(input.date, input.time));
  const patchCommon = {
    duration_minutes: input.duration_minutes,
    price: input.price,
    team_id: input.team_id,
    status: input.status,
    // Preço mexido aqui é decisão desta limpeza: não é sobrescrito pelo cadastro
    price_manual: true,
  };

  // Dias entre uma limpeza e a seguinte
  const PASSO: Record<string, number> = {
    semanal: 7,
    quinzenal: 14,
    tres_semanas: 21,
    mensal: 28,
  };

  if (input.scope === 'series' && current.series_id) {
    const { data: futureOnes, error: listError } = await supabase
      .from('bookings')
      .select('id, scheduled_at')
      .eq('series_id', current.series_id)
      .gte('scheduled_at', current.scheduled_at)
      .order('scheduled_at');
    if (listError) throw new Error(listError.message);

    const lista = futureOnes ?? [];
    const passo = input.frequency ? PASSO[input.frequency] : undefined;

    if (passo) {
      // Frequência mudou: recalcula as datas a partir desta limpeza
      for (let i = 0; i < lista.length; i++) {
        const dia = new Date(newStart.getTime() + i * passo * 86400000);
        const { data: linhasBookings7, error } = await supabase
          .from('bookings')
          .update({ ...patchCommon, scheduled_at: dia.toISOString() })
          .eq('id', lista[i].id)
    .select('id');
        if (error) throw new Error(error.message);
  if (!linhasBookings7 || linhasBookings7.length === 0) {
    throw new Error(
      'Não foi possível salvar a limpeza: seu acesso não permite a alteração.'
    );
  }
      }

      // O cliente passa a ter a nova frequência
      if (current.client_id) {
        await supabase
          .from('clients')
          .update({ frequency: input.frequency })
          .eq('id', current.client_id)
    .select('id');
      }
    } else {
      // Mantém o intervalo: desloca todas pelo mesmo tanto
      const deltaMs = newStart.getTime() - new Date(current.scheduled_at).getTime();
      for (const b of lista) {
        const shifted = new Date(new Date(b.scheduled_at).getTime() + deltaMs);
        const { data: linhasBookings8, error } = await supabase
          .from('bookings')
          .update({ ...patchCommon, scheduled_at: shifted.toISOString() })
          .eq('id', b.id)
    .select('id');
        if (error) throw new Error(error.message);
  if (!linhasBookings8 || linhasBookings8.length === 0) {
    throw new Error(
      'Não foi possível salvar a limpeza: seu acesso não permite a alteração.'
    );
  }
      }
    }
  } else {
    const { data: linhasBookings9, error } = await supabase
      .from('bookings')
      .update({ ...patchCommon, scheduled_at: newStart.toISOString() })
      .eq('id', input.id)
    .select('id');
    if (error) throw new Error(error.message);
  if (!linhasBookings9 || linhasBookings9.length === 0) {
    throw new Error(
      'Não foi possível salvar a limpeza: seu acesso não permite a alteração.'
    );
  }
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
    const { data: linhasBookings10, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelado' })
      .eq('series_id', current.series_id)
      .gte('scheduled_at', current.scheduled_at)
    .select('id');
    if (error) throw new Error(error.message);
  if (!linhasBookings10 || linhasBookings10.length === 0) {
    throw new Error(
      'Não foi possível salvar a limpeza: seu acesso não permite a alteração.'
    );
  }
  } else {
    const { data: linhasBookings11, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelado' })
      .eq('id', input.id)
    .select('id');
    if (error) throw new Error(error.message);
  if (!linhasBookings11 || linhasBookings11.length === 0) {
    throw new Error(
      'Não foi possível salvar a limpeza: seu acesso não permite a alteração.'
    );
  }
  }

  revalidatePath('/agendamentos');
  revalidatePath('/calendario');
  revalidatePath('/dashboard');
}


// ---------- EDICAO DE CLIENTE ----------
export async function updateClientAction(id: string, formData: FormData) {
  const { supabase } = await getCompanyId();
  const { data, error } = await supabase
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
      payment_method: String(formData.get('payment_method') ?? '') || null,
      default_price: String(formData.get('default_price') ?? '') === ''
        ? null
        : Number(formData.get('default_price')),
      contract_status: String(formData.get('contract_status') ?? 'pendente'),
      payment_notes: String(formData.get('payment_notes') ?? '') || null,
      sms_opt_in: formData.get('sms_opt_in') === 'on',
      marketing_opt_in: formData.get('marketing_opt_in') === 'on',
      client_type: String(formData.get('client_type') ?? 'residencial'),
      business_segment: String(formData.get('business_segment') ?? '') || null,
      area_sqft: String(formData.get('area_sqft') ?? '') === '' ? null : Number(formData.get('area_sqft')),
      contact_role: String(formData.get('contact_role') ?? '') || null,
      access_notes: String(formData.get('access_notes') ?? '') || null,
      billing_type: String(formData.get('billing_type') ?? 'por_limpeza'),
      monthly_contract_value: String(formData.get('monthly_contract_value') ?? '') === ''
        ? null
        : Number(formData.get('monthly_contract_value')),
      payment_terms: String(formData.get('payment_terms') ?? '') || null,

      ...(formData.has('preferred_team_id')
        ? { preferred_team_id: String(formData.get('preferred_team_id') ?? '') || null }
        : {}),
    })
    .eq('id', id)
    .select('id');

  if (error) throw new Error(error.message);

  // Sem erro mas nenhuma linha alterada: a gravação foi barrada pelo banco
  if (!data || data.length === 0) {
    throw new Error(
      'Não foi possível salvar: seu acesso não permite alterar este cliente. Fale com o escritório.'
    );
  }

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

// ---------- EDICAO DE EQUIPE ----------
export async function updateTeamAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const id = String(formData.get('id'));
  const { data: linhasTeams12, error } = await supabase
    .from('teams')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      color: String(formData.get('color') ?? '#13706B'),
      active: formData.get('active') === 'on',
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasTeams12 || linhasTeams12.length === 0) {
    throw new Error(
      'Não foi possível salvar a equipe: seu acesso não permite a alteração.'
    );
  }
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
  const { data: linhasMemberships13, error } = await supabase
    .from('memberships')
    .update({ active })
    .eq('id', membershipId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasMemberships13 || linhasMemberships13.length === 0) {
    throw new Error(
      'Não foi possível salvar o acesso: apenas a gestão pode alterar.'
    );
  }
  revalidatePath('/equipes');
}


// ---------- STATUS PELA EQUIPE (via funcao segura, sem acesso a valores) ----------
export async function updateMyBookingStatusAction(
  bookingId: string,
  status: string,
  lat: number | null,
  lng: number | null,
  accuracy: number | null = null
) {
  const { supabase } = await getAuth();
  const { error } = await supabase.rpc('set_my_booking_status', {
    p_booking: bookingId,
    p_status: status,
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/minha-agenda');
  revalidatePath('/agendamentos');
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
  const { data: linhasPositions14, error } = await supabase
    .from('positions')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      permissions,
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasPositions14 || linhasPositions14.length === 0) {
    throw new Error(
      'Não foi possível salvar o cargo: apenas a gestão pode alterar.'
    );
  }
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
  const { data: linhasMemberships15, error } = await supabase
    .from('memberships')
    .update({ position_id: positionId || null })
    .eq('id', membershipId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasMemberships15 || linhasMemberships15.length === 0) {
    throw new Error(
      'Não foi possível salvar o acesso: apenas a gestão pode alterar.'
    );
  }
  revalidatePath('/equipes');
}


// ---------- CONFIGURACOES ----------
export async function updateMyNameAction(formData: FormData) {
  const { supabase, userId, companyId } = await getAuth();
  const { data: linhasMemberships16, error } = await supabase
    .from('memberships')
    .update({ full_name: String(formData.get('full_name') ?? '').trim() })
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasMemberships16 || linhasMemberships16.length === 0) {
    throw new Error(
      'Não foi possível salvar o acesso: apenas a gestão pode alterar.'
    );
  }
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
  const { data: linhasCompanies17, error } = await supabase
    .from('companies')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      address: String(formData.get('address') ?? '') || null,
      payment_instructions: String(formData.get('payment_instructions') ?? '') || null,
      ...(formData.get('lat') ? { lat: Number(formData.get('lat')) } : {}),
      ...(formData.get('lng') ? { lng: Number(formData.get('lng')) } : {}),
    })
    .eq('id', companyId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasCompanies17 || linhasCompanies17.length === 0) {
    throw new Error(
      'Não foi possível salvar os dados da empresa: apenas a gestão pode alterar.'
    );
  }
  revalidatePath('/configuracoes');
}


// ---------- GEOCODIFICACAO EM LOTE ----------
export async function saveClientCoordsAction(id: string, lat: number, lng: number, address?: string) {
  const { supabase } = await getCompanyId();
  const { data: linhasClients18, error } = await supabase
    .from('clients')
    .update({ lat, lng, ...(address ? { address } : {}) })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasClients18 || linhasClients18.length === 0) {
    throw new Error(
      'Não foi possível salvar este cliente: seu acesso não permite a alteração.'
    );
  }
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

  const { data: linhasBanimento, error } = await supabase
    .from('clients')
    .update({
      status: 'deletado',
      ban_reason: reason,
      banned_at: new Date().toISOString(),
      banned_by: userId,
    })
    .eq('id', input.id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!linhasBanimento || linhasBanimento.length === 0) {
    return { ok: false, error: 'Apenas o dono da empresa pode banir um cliente.' };
  }

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${input.id}`);
  return { ok: true };
}

export async function unbanClientAction(id: string) {
  const { supabase, role } = await getAuth();
  if (role !== 'owner') {
    throw new Error('Apenas o dono da empresa pode reverter um banimento.');
  }
  const { data: linhasClients19, error } = await supabase
    .from('clients')
    .update({ status: 'inativo' })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasClients19 || linhasClients19.length === 0) {
    throw new Error(
      'Não foi possível salvar este cliente: seu acesso não permite a alteração.'
    );
  }
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
}


// ---------- MARKETING ----------
export async function setMarketingOptInAction(id: string, value: boolean) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from('clients').update({ marketing_opt_in: value }).eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  revalidatePath('/marketing');
}

export async function saveLostReasonAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const { data: linhasClients20, error } = await supabase
    .from('clients')
    .update({ lost_reason: String(formData.get('lost_reason') ?? '') || null })
    .eq('id', String(formData.get('id')))
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasClients20 || linhasClients20.length === 0) {
    throw new Error(
      'Não foi possível salvar este cliente: seu acesso não permite a alteração.'
    );
  }
  revalidatePath('/marketing');
}

export async function markContactedAction(id: string) {
  const { supabase } = await getCompanyId();
  const { data: linhasClients21, error } = await supabase
    .from('clients')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!linhasClients21 || linhasClients21.length === 0) {
    throw new Error(
      'Não foi possível salvar este cliente: seu acesso não permite a alteração.'
    );
  }
  revalidatePath('/marketing');
}


// ---------- CADASTRO DE LEAD (time de marketing) ----------
export async function createLeadAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();

  const { error } = await supabase.from('clients').insert({
    company_id: companyId,
    full_name: String(formData.get('full_name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '') || null,
    email: String(formData.get('email') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
    preferences: String(formData.get('preferences') ?? '') || null,
    language: String(formData.get('language') ?? 'pt'),
    source: String(formData.get('source') ?? '') || null,
    status: 'lead',
    entry_source: 'marketing',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/marketing');
  revalidatePath('/clientes');
  redirect('/marketing');
}


// ---------- REGULARIZACAO (pagamento, valor e contrato) ----------
export async function quickUpdateClientBillingAction(formData: FormData) {
  const { supabase } = await getCompanyId();
  const id = String(formData.get('id'));
  const preco = String(formData.get('default_price') ?? '');

  const { data, error } = await supabase
    .from('clients')
    .update({
      payment_method: String(formData.get('payment_method') ?? '') || null,
      default_price: preco === '' ? null : Number(preco),
      contract_status: String(formData.get('contract_status') ?? 'pendente'),
    })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Não foi possível salvar: seu acesso não permite alterar este cliente.');
  }

  revalidatePath('/regularizacao');
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
}


// ---------- MENSAGENS AUTOMATICAS ----------
export async function saveReminderSettingsAction(formData: FormData) {
  const { supabase, companyId, role } = await getAuth();
  if (!['owner', 'admin', 'supervisor'].includes(role)) {
    throw new Error('Apenas a gestão altera as mensagens automáticas');
  }

  const { error } = await supabase.from('pricing_settings').upsert({
    company_id: companyId,
    reminder_enabled: true,
    reminder_channel: String(formData.get('reminder_channel') ?? 'sms'),
    reminder_extra_note: String(formData.get('reminder_extra_note') ?? '') || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/configuracoes');
}

// ---------- TROCA DE EMPRESA (quem atende mais de uma) ----------
export async function switchCompanyAction(companyId: string) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Só troca para empresa onde a pessoa realmente tem vínculo ativo
  const { data: vinculo } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle();
  if (!vinculo) throw new Error('Você não tem acesso a esta empresa');

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, active_company_id: companyId }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);

  revalidatePath('/', 'layout');
  redirect('/');
}
