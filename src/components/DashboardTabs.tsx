'use client';
import Link from 'next/link';

export type Visao = 'residencial' | 'comercial' | 'geral';

const ABAS: Array<{ chave: Visao; rotulo: string; icone: string; descricao: string }> = [
  {
    chave: 'residencial',
    rotulo: 'Residencial',
    icone: '🏠',
    descricao: 'A operação do dia',
  },
  {
    chave: 'comercial',
    rotulo: 'Comercial',
    icone: '🏢',
    descricao: 'Contratos e qualidade',
  },
  {
    chave: 'geral',
    rotulo: 'Administrativo',
    icone: '📊',
    descricao: 'O negócio inteiro',
  },
];

export default function DashboardTabs({
  atual,
  temComercial,
}: {
  atual: Visao;
  temComercial: boolean;
}) {
  const abas = temComercial ? ABAS : ABAS.filter((a) => a.chave !== 'comercial');

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {abas.map((a) => {
        const ativo = atual === a.chave;
        return (
          <Link
            key={a.chave}
            href={`/dashboard?visao=${a.chave}`}
            className={`flex min-h-touch flex-col justify-center rounded-card border-2 px-5 py-2 transition ${
              ativo
                ? 'border-brand-900 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800 hover:border-aqua-500'
            }`}
          >
            <span className="font-semibold">
              {a.icone} {a.rotulo}
            </span>
            <span className={`text-xs ${ativo ? 'text-brand-100' : 'text-brand-800'}`}>
              {a.descricao}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
