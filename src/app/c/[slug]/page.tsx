import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CampaignLandingForm from '@/components/CampaignLandingForm';

export const dynamic = 'force-dynamic';

/** Página pública do link de campanha — sem login. */
export default async function CampaignLandingPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('slug, name, companies(name, phone, email)')
    .eq('slug', params.slug)
    .eq('active', true)
    .single();

  if (!data) notFound();
  const empresa = (data as any).companies;

  return (
    <main className="min-h-screen bg-brand-900 p-5 md:p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center text-white">
          <p className="text-3xl font-bold">{empresa?.name ?? 'Limpeza profissional'}</p>
          <p className="mt-2 text-brand-100">
            Peça seu orçamento sem compromisso. Respondemos rapidinho.
          </p>
        </div>

        <CampaignLandingForm
          slug={params.slug}
          companyName={empresa?.name ?? ''}
          companyPhone={empresa?.phone ?? null}
        />

        <p className="mt-6 text-center text-sm text-brand-100">
          Seus dados são usados apenas para preparar seu orçamento.
        </p>
      </div>
    </main>
  );
}
