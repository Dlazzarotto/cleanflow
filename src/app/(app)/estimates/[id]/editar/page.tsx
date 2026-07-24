import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import EstimateForm, { type EstimateInitial } from '@/components/EstimateForm';
import { getPricingSettings } from '@/lib/actions/estimates';

export const dynamic = 'force-dynamic';

export default async function EditarEstimatePage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const [{ data: estimate }, { data: clients }, settings] = await Promise.all([
    supabase.from('estimates').select('*').eq('id', params.id).single(),
    supabase
      .from('clients')
      .select('id, full_name, address, lat, lng')
      .eq('status', 'ativo')
      .order('full_name'),
    getPricingSettings(),
  ]);
  if (!estimate) notFound();
  const e = estimate as any;

  const initial: EstimateInitial = {
    id: e.id,
    client_id: e.client_id,
    lead_name: e.lead_name,
    lead_phone: e.lead_phone,
    lead_email: e.lead_email,
    address: e.address,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    frequency: e.frequency,
    bedrooms: e.bedrooms,
    full_baths: e.full_baths,
    half_baths: e.half_baths,
    bedroom_tasks: e.bedroom_tasks ?? [],
    bathroom_tasks: e.bathroom_tasks ?? [],
    extras: e.extras ?? {},
    laundry: e.laundry,
    laundry_loads: e.laundry_loads,
    deep_clean: e.deep_clean,
  };

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Editar estimate</h1>
      <EstimateForm
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.full_name,
          address: c.address,
          lat: c.lat,
          lng: c.lng,
        }))}
        settings={settings}
        initial={initial}
      />
    </div>
  );
}
