import { createClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/plans';
import PlatformLeadForm from '@/components/PlatformLeadForm';

export const dynamic = 'force-dynamic';

/** Página pública de vendas do CleanFlow — captação de empresas de limpeza. */
export default async function AssinePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: campanha } = await supabase
    .from('platform_campaigns')
    .select('slug, name')
    .eq('slug', params.slug)
    .eq('active', true)
    .single();

  return (
    <main className="min-h-screen bg-brand-900">
      <div className="mx-auto max-w-4xl px-5 py-10 md:py-16">
        {/* Chamada */}
        <div className="mb-10 text-center text-white">
          <p className="text-4xl font-bold md:text-5xl">
            Clean<span className="text-aqua-400">Flow</span>
          </p>
          <p className="mt-4 text-2xl font-semibold md:text-3xl">
            Sua empresa de limpeza no piloto automático
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-brand-100">
            Agenda, rotas, orçamentos, contratos, faturas e equipe em campo — tudo em um sistema só,
            feito para empresas de limpeza nos Estados Unidos.
          </p>
        </div>

        {/* O que resolve */}
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {[
            {
              t: '📅 Agenda que se organiza',
              d: 'Limpezas recorrentes criadas de uma vez, com sugestão de encaixe pela rota mais curta.',
            },
            {
              t: '🧮 Orçamento em minutos',
              d: 'Checklist por cômodo calcula tempo e preço, gera o documento e o contrato para assinar.',
            },
            {
              t: '📱 Equipe no celular',
              d: 'Check-in por GPS, ficha da casa, fotos de ocorrências e relatório de produtividade.',
            },
            {
              t: '🧾 Fatura automática',
              d: 'Ao terminar a limpeza, o cliente recebe a fatura com link para pagar. Sem dinheiro na mão.',
            },
            {
              t: '📊 Números de verdade',
              d: 'Quanto cada equipe rende, tempo em casa, tempo em trajeto e receita por hora.',
            },
            {
              t: '🌎 Fala a língua do cliente',
              d: 'Orçamentos e contratos em português, inglês, espanhol e francês.',
            },
          ].map((f) => (
            <div key={f.t} className="rounded-card bg-white/10 p-5 text-white backdrop-blur">
              <p className="font-semibold">{f.t}</p>
              <p className="mt-2 text-sm text-brand-100">{f.d}</p>
            </div>
          ))}
        </div>

        {/* Planos */}
        <div className="mb-10 grid gap-4 md:grid-cols-2">
          {Object.values(PLANS).map((p) => (
            <div key={p.key} className="rounded-card bg-white p-6">
              <p className="text-2xl font-bold text-brand-900">{p.name}</p>
              <p className="mt-1 text-4xl font-bold text-brand-700">
                ${p.price}
                <span className="text-base font-medium text-brand-800">/mês</span>
              </p>
              <ul className="mt-4 space-y-2 text-brand-800">
                {p.highlights.map((h) => (
                  <li key={h}>✓ {h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Formulário */}
        <div id="form">
          <PlatformLeadForm slug={params.slug} campaignExists={Boolean(campanha)} />
        </div>

        <p className="mt-8 text-center text-sm text-brand-100">
          Sem fidelidade. Cancele quando quiser. ·{' '}
          <a href="/termos" className="underline">
            Contrato de assinatura
          </a>
        </p>
      </div>
    </main>
  );
}
