import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import DashboardTabs, { type Visao } from '@/components/DashboardTabs';
import DashboardResidencial from './residencial';
import DashboardComercial from './comercial';
import DashboardAdministrativo from './administrativo';

export const dynamic = 'force-dynamic';

const TITULOS: Record<Visao, { titulo: string; subtitulo: string }> = {
  residencial: {
    titulo: '🏠 Residencial',
    subtitulo: 'A operação de hoje: quem limpa o quê, e o que entra',
  },
  comercial: {
    titulo: '🏢 Comercial',
    subtitulo: 'Contratos, receita recorrente e qualidade do serviço',
  },
  geral: {
    titulo: '📊 Administrativo',
    subtitulo: 'O negócio inteiro: dinheiro, produtividade e crescimento',
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { visao?: string };
}) {
  await requireManager();
  const supabase = createClient();
  const { data: temComercial } = await supabase.rpc('has_commercial');

  const pedida = (searchParams.visao ?? 'residencial') as Visao;
  const visao: Visao =
    pedida === 'comercial' && !temComercial
      ? 'residencial'
      : ['residencial', 'comercial', 'geral'].includes(pedida)
        ? pedida
        : 'residencial';

  const t = TITULOS[visao];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-brand-900">{t.titulo}</h1>
        <p className="text-brand-800">{t.subtitulo}</p>
      </div>

      <DashboardTabs atual={visao} temComercial={Boolean(temComercial)} />

      {visao === 'residencial' && <DashboardResidencial />}
      {visao === 'comercial' && <DashboardComercial />}
      {visao === 'geral' && <DashboardAdministrativo />}
    </div>
  );
}
