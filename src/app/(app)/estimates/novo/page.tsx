import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import EstimateForm from '@/components/EstimateForm';
import { getPricingSettings } from '@/lib/actions/estimates';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

export default async function NovoEstimatePage({
  searchParams,
}: {
  searchParams: { cliente?: string };
}) {
  await requireManager();
  const supabase = createClient();
  const [{ data: clients }, settings] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, address, lat, lng, language')
      .neq('status', 'deletado')
      .order('full_name'),
    getPricingSettings(),
  ]);

  return (
    <div>
      <BackLink href="/estimates" label="Estimates" />
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Novo estimate</h1>
      <EstimateForm
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.full_name,
          address: c.address,
          lat: c.lat,
          lng: c.lng,
          language: (c as any).language,
        }))}
        settings={settings}
        preselectClientId={searchParams.cliente}
      />
    </div>
  );
}
