'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function getCompanyId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Perfil não encontrado');
  return { supabase, companyId: profile.company_id as string };
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
    door_code: String(formData.get('door_code') ?? '') || null,
    has_pets: formData.get('has_pets') === 'on',
    pets_notes: String(formData.get('pets_notes') ?? '') || null,
    alarm_notes: String(formData.get('alarm_notes') ?? '') || null,
    preferences: String(formData.get('preferences') ?? '') || null,
    products_notes: String(formData.get('products_notes') ?? '') || null,
    frequency: String(formData.get('frequency') ?? '') || null,
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
export async function createBookingAction(formData: FormData) {
  const { supabase, companyId } = await getCompanyId();
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const { error } = await supabase.from('bookings').insert({
    company_id: companyId,
    client_id: String(formData.get('client_id')),
    team_id: String(formData.get('team_id') ?? '') || null,
    scheduled_at: new Date(`${date}T${time}`).toISOString(),
    duration_minutes: Number(formData.get('duration_minutes') ?? 120),
    price: Number(formData.get('price') ?? 0),
    notes: String(formData.get('notes') ?? '') || null,
    status: 'agendado',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/agendamentos');
  redirect('/agendamentos');
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
