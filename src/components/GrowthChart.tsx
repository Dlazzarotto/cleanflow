'use client';

export interface GrowthPoint {
  mes: string;
  novas_empresas: number;
  limpezas: number;
  empresas_ativas: number;
}

/** Gráfico simples de barras, sem dependências externas. */
export default function GrowthChart({ data }: { data: GrowthPoint[] }) {
  if (data.length === 0) return null;
  const maxLimpezas = Math.max(...data.map((d) => d.limpezas), 1);
  const maxEmpresas = Math.max(...data.map((d) => d.empresas_ativas), 1);

  return (
    <div>
      <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ height: 180 }}>
        {data.map((d) => {
          const alturaLimpezas = Math.round((d.limpezas / maxLimpezas) * 130);
          const alturaEmpresas = Math.round((d.empresas_ativas / maxEmpresas) * 130);
          const mes = new Date(d.mes + 'T12:00:00').toLocaleDateString('pt-BR', {
            month: 'short',
          });
          return (
            <div key={d.mes} className="flex min-w-14 flex-1 flex-col items-center gap-1">
              <div className="flex h-[130px] items-end gap-1">
                <div
                  className="w-4 rounded-t bg-brand-700"
                  style={{ height: Math.max(alturaLimpezas, 2) }}
                  title={`${d.limpezas} limpezas`}
                />
                <div
                  className="w-4 rounded-t bg-aqua-400"
                  style={{ height: Math.max(alturaEmpresas, 2) }}
                  title={`${d.empresas_ativas} empresas ativas`}
                />
              </div>
              <span className="text-xs text-brand-800">{mes}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-brand-800">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-brand-700" aria-hidden /> limpezas no mês
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-aqua-400" aria-hidden /> empresas ativas
        </span>
      </div>
    </div>
  );
}
