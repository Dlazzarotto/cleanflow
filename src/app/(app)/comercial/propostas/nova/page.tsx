import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { getPricingSettings } from '@/lib/actions/estimates';
import CommercialEstimateForm from '@/components/CommercialEstimateForm';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

export default async function NovaPropostaPage() {
  await requireManager();
  const supabase = createClient();

  const [{ data: catalogo }, { data: clientes }, settings] = await Promise.all([
    supabase
      .from('commercial_areas')
      .select('id, segment, name, item, unit, minutes_per_unit, default_qty, sort_order')
      .not('item', 'is', null)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('clients')
      .select('id, full_name, business_segment, area_sqft')
      .eq('client_type', 'comercial')
      .neq('status', 'deletado')
      .order('full_name'),
    getPricingSettings(),
  ]);

  const itens = ((catalogo ?? []) as any[]).map((c) => ({
    id: c.id,
    segment: c.segment,
    area: c.name,
    item: c.item,
    unit: c.unit,
    minutes_per_unit: Number(c.minutes_per_unit),
    default_qty: Number(c.default_qty),
    sort_order: c.sort_order,
  }));

  return (
    <div className="max-w-4xl">
      <BackLink href="/comercial/propostas" label="Propostas" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">🏢 Nova proposta comercial</h1>
      <p className="mb-6 text-brand-800">
        Escolha o tipo de lugar e o sistema traz tudo que costuma ser limpo nele. Marque o que
        entra, ajuste quantidade e sujeira — o tempo e o preço saem calculados.
      </p>

      <CommercialEstimateForm
        catalogo={itens}
        clientes={(clientes ?? []) as any[]}
        hourlyRate={Number(settings.hourly_rate ?? 45)}
      />
    </div>
  );
}
