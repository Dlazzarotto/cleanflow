'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SEGMENTS } from '@/lib/commercial';
import { saveCommercialEstimateAction } from '@/lib/actions/commercial';
import AreaCalculator, { type Comodo } from '@/components/AreaCalculator';
import PhotoAnalyzer, { type Analise } from '@/components/PhotoAnalyzer';

export interface CatalogoItem {
  id: string;
  segment: string;
  area: string;
  item: string;
  unit: string;
  minutes_per_unit: number;
  default_qty: number;
  sort_order: number;
}

export interface ClienteOpcao {
  id: string;
  full_name: string;
  business_segment: string | null;
  area_sqft: number | null;
}

/** Quanto o grau de sujeira multiplica o tempo. */
const SUJEIRA = [
  { chave: 'leve', rotulo: 'Leve', desc: 'Manutenção em dia', mult: 0.85 },
  { chave: 'medio', rotulo: 'Médio', desc: 'Uso normal', mult: 1 },
  { chave: 'pesado', rotulo: 'Pesado', desc: 'Acúmulo, gordura, obra', mult: 1.45 },
] as const;

const FREQUENCIAS = [
  { chave: 'diaria', rotulo: 'Diária (5x por semana)', visitas: 21.5 },
  { chave: 'tres_semana', rotulo: '3x por semana', visitas: 13 },
  { chave: 'duas_semana', rotulo: '2x por semana', visitas: 8.6 },
  { chave: 'semanal', rotulo: 'Semanal', visitas: 4.3 },
  { chave: 'quinzenal', rotulo: 'Quinzenal', visitas: 2.15 },
  { chave: 'mensal', rotulo: 'Mensal', visitas: 1 },
  { chave: 'unica', rotulo: 'Serviço único', visitas: 1 },
];

const UNIDADE_LABEL: Record<string, string> = {
  unidade: 'un',
  sqft: 'sq ft',
  metro: 'm',
  carga: 'carga',
  conjunto: 'conj',
};

interface Escolhido {
  qty: number;
  sujeira: string;
}

export default function CommercialEstimateForm({
  catalogo,
  clientes,
  hourlyRate,
}: {
  catalogo: CatalogoItem[];
  clientes: ClienteOpcao[];
  hourlyRate: number;
}) {
  const router = useRouter();

  const [segmento, setSegmento] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [leadNome, setLeadNome] = useState('');
  const [leadTelefone, setLeadTelefone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [frequencia, setFrequencia] = useState('semanal');
  const [sujeiraGeral, setSujeiraGeral] = useState('medio');
  const [equipe, setEquipe] = useState(2);
  const [noturno, setNoturno] = useState(false);
  const [suprimentos, setSuprimentos] = useState(true);
  const [taxaHora, setTaxaHora] = useState(hourlyRate);
  const [escolhidos, setEscolhidos] = useState<Record<string, Escolhido>>({});
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [comodos, setComodos] = useState<Comodo[]>([]);
  const [avisoIA, setAvisoIA] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Itens do segmento escolhido, agrupados por área
  const doSegmento = useMemo(
    () => catalogo.filter((c) => c.segment === segmento),
    [catalogo, segmento]
  );

  const areas = useMemo(
    () => Array.from(new Set(doSegmento.map((c) => c.area))),
    [doSegmento]
  );

  const multGeral = SUJEIRA.find((s) => s.chave === sujeiraGeral)?.mult ?? 1;
  const visitasMes = FREQUENCIAS.find((f) => f.chave === frequencia)?.visitas ?? 4.3;

  // Tempo total do serviço
  const calculo = useMemo(() => {
    let minutos = 0;
    const detalhe: Array<{ item: CatalogoItem; qty: number; mult: number; minutos: number }> = [];

    for (const c of doSegmento) {
      const esc = escolhidos[c.id];
      if (!esc) continue;
      const mult = SUJEIRA.find((s) => s.chave === esc.sujeira)?.mult ?? multGeral;
      const m = esc.qty * Number(c.minutes_per_unit) * mult;
      minutos += m;
      detalhe.push({ item: c, qty: esc.qty, mult, minutos: m });
    }

    // Turno noturno encarece a hora
    const taxaFinal = noturno ? taxaHora * 1.2 : taxaHora;
    // Equipe maior reduz o tempo de porta, mas o custo/hora é por pessoa
    const horasServico = minutos / 60;
    const precoVisita = horasServico * taxaFinal + (suprimentos ? horasServico * 3 : 0);
    const precoMes = precoVisita * visitasMes;

    return {
      minutos,
      horas: horasServico,
      horasPorPessoa: equipe > 0 ? horasServico / equipe : horasServico,
      precoVisita,
      precoMes,
      detalhe,
      taxaFinal,
    };
  }, [doSegmento, escolhidos, multGeral, noturno, taxaHora, suprimentos, visitasMes, equipe]);

  function aplicarAnalise(a: Analise) {
    const novo: Record<string, Escolhido> = {};
    for (const i of a.itens) {
      const existe = doSegmento.find((c) => c.id === i.id);
      if (!existe) continue;
      novo[i.id] = {
        qty: Number(i.qty) > 0 ? Number(i.qty) : Number(existe.default_qty),
        sujeira: ['leve', 'medio', 'pesado'].includes(i.sujeira) ? i.sujeira : sujeiraGeral,
      };
    }
    if (Object.keys(novo).length > 0) setEscolhidos(novo);
    if (a.area_estimada_sqft) setAreaSqft(String(a.area_estimada_sqft));
    setAvisoIA(
      `Análise aplicada: ${Object.keys(novo).length} item(ns) marcado(s)` +
        (a.alerta ? ` · ${a.alerta}` : '')
    );
  }

  function marcar(c: CatalogoItem) {
    setEscolhidos((prev) => {
      const novo = { ...prev };
      if (novo[c.id]) delete novo[c.id];
      else novo[c.id] = { qty: Number(c.default_qty), sujeira: sujeiraGeral };
      return novo;
    });
  }

  function marcarArea(area: string, marcar: boolean) {
    setEscolhidos((prev) => {
      const novo = { ...prev };
      for (const c of doSegmento.filter((x) => x.area === area)) {
        if (marcar) novo[c.id] = novo[c.id] ?? { qty: Number(c.default_qty), sujeira: sujeiraGeral };
        else delete novo[c.id];
      }
      return novo;
    });
  }

  /** Distribui a área medida entre os itens cobrados por metragem. */
  function aplicarArea(total: number, lista: Comodo[]) {
    setAreaSqft(String(total));
    setComodos(lista);
    setEscolhidos((prev) => {
      const novo = { ...prev };
      const emSqft = doSegmento.filter((c) => c.unit === 'sqft' && novo[c.id]);
      if (emSqft.length === 0) return novo;
      // Mantém a proporção original entre os itens de área
      const somaPadrao = emSqft.reduce((s, c) => s + Number(c.default_qty), 0);
      for (const c of emSqft) {
        const fatia = somaPadrao > 0 ? Number(c.default_qty) / somaPadrao : 1 / emSqft.length;
        novo[c.id] = { ...novo[c.id], qty: Math.round(total * fatia) };
      }
      return novo;
    });
  }

  function mudarQtd(id: string, qty: number) {
    setEscolhidos((prev) => ({ ...prev, [id]: { ...prev[id], qty: Math.max(qty, 0) } }));
  }

  function mudarSujeira(id: string, sujeira: string) {
    setEscolhidos((prev) => ({ ...prev, [id]: { ...prev[id], sujeira } }));
  }

  function usd(n: number) {
    return Number(n).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }

  function tempo(min: number) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  }

  async function salvar() {
    if (!segmento) {
      setErro('Escolha o tipo de comércio.');
      return;
    }
    if (calculo.detalhe.length === 0) {
      setErro('Marque ao menos um item para limpar.');
      return;
    }
    if (!clienteId && leadNome.trim().length < 3) {
      setErro('Escolha um contrato existente ou informe o nome do interessado.');
      return;
    }

    setSalvando(true);
    setErro('');
    const res = await saveCommercialEstimateAction({
      client_id: clienteId || null,
      lead_name: leadNome || null,
      lead_phone: leadTelefone || null,
      lead_email: leadEmail || null,
      address: endereco || null,
      segment: segmento,
      area_sqft: areaSqft ? Number(areaSqft) : null,
      frequency: frequencia,
      visits_per_month: visitasMes,
      soil_level: sujeiraGeral,
      crew_size: equipe,
      night_shift: noturno,
      supplies_included: suprimentos,
      total_minutes: Math.round(calculo.minutos),
      hourly_rate: taxaHora,
      price_per_visit: Math.round(calculo.precoVisita),
      price_monthly: Math.round(calculo.precoMes),
      notes: observacoes || null,
      items: calculo.detalhe.map((d, i) => ({
        area: d.item.area,
        item: d.item.item,
        unit: d.item.unit,
        qty: d.qty,
        minutes_per_unit: Number(d.item.minutes_per_unit),
        soil_multiplier: d.mult,
        minutes: Math.round(d.minutos),
        sort_order: i,
      })),
    });

    if (res.ok) router.push(`/comercial/propostas/${res.id}`);
    else {
      setErro(res.error ?? 'Não foi possível salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <AreaCalculator
        aberto={calculadoraAberta}
        aoFechar={() => setCalculadoraAberta(false)}
        aoAplicar={aplicarArea}
        areaInicial={comodos}
      />

      {/* 1. Tipo de comércio */}
      <div className="card">
        <p className="mb-3 text-xl font-semibold text-brand-900">1. Que tipo de lugar é?</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SEGMENTS.filter((s) => s.key !== 'outro').map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSegmento(s.key);
                // Já traz marcado tudo o que costuma existir neste tipo de lugar
                const itensDoTipo = catalogo.filter((c) => c.segment === s.key);
                const inicial: Record<string, Escolhido> = {};
                for (const c of itensDoTipo) {
                  inicial[c.id] = { qty: Number(c.default_qty), sujeira: sujeiraGeral };
                }
                setEscolhidos(inicial);
                setAvisoIA('');
              }}
              className={`min-h-touch rounded-card border-2 px-3 py-3 text-left text-sm font-medium transition ${
                segmento === s.key
                  ? 'border-brand-700 bg-brand-50 text-brand-900'
                  : 'border-brand-100 bg-white text-brand-800 hover:border-aqua-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {segmento && (
          <p className="mt-3 rounded-card bg-brand-50 p-3 text-sm text-brand-900">
            ✅ <strong>{doSegmento.length} itens</strong> já foram marcados — é o que costuma
            existir num lugar desse tipo. Desmarque o que não se aplica e ajuste as quantidades.
          </p>
        )}
      </div>

      {segmento && (
        <>
          {/* Ferramentas de apoio */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <p className="text-xl font-semibold text-brand-900">📐 Medir a área</p>
              <p className="mb-3 text-brand-800">
                Meça cada ambiente e o sistema soma. Os itens cobrados por metragem usam esse
                número — orçamento mais justo.
              </p>
              <button
                className="btn-primary w-full"
                type="button"
                onClick={() => setCalculadoraAberta(true)}
              >
                {areaSqft
                  ? `📐 ${Number(areaSqft).toLocaleString('pt-BR')} sq ft — refazer medição`
                  : '📐 Abrir a calculadora de área'}
              </button>
              {comodos.filter((c) => c.comprimento && c.largura).length > 0 && (
                <div className="mt-3 space-y-1">
                  {comodos
                    .filter((c) => c.comprimento && c.largura)
                    .map((c) => (
                      <p key={c.id} className="text-sm text-brand-800">
                        {c.nome || 'Ambiente'} — {Math.round(c.comprimento * c.largura)} sq ft
                      </p>
                    ))}
                </div>
              )}
            </div>

            <PhotoAnalyzer
              segment={segmento}
              catalogo={doSegmento.map((c) => ({
                id: c.id,
                area: c.area,
                item: c.item,
                unit: c.unit,
              }))}
              aoAplicar={aplicarAnalise}
            />
          </div>

          {avisoIA && (
            <div className="card border-2 border-aqua-500">
              <p className="font-medium text-brand-900">🤖 {avisoIA}</p>
              <p className="mt-1 text-sm text-brand-800">
                Confira os itens abaixo antes de fechar o preço.
              </p>
            </div>
          )}

          {/* 2. Condições gerais */}
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">2. Como é o serviço</p>

            <div className="mb-4">
              <p className="label">Grau de sujeira do local</p>
              <div className="flex flex-wrap gap-2">
                {SUJEIRA.map((s) => (
                  <button
                    key={s.chave}
                    type="button"
                    onClick={() => setSujeiraGeral(s.chave)}
                    className={`min-h-touch rounded-card border-2 px-4 py-2 text-left ${
                      sujeiraGeral === s.chave
                        ? 'border-brand-700 bg-brand-50'
                        : 'border-brand-100 bg-white'
                    }`}
                  >
                    <span className="block font-semibold text-brand-900">{s.rotulo}</span>
                    <span className="block text-xs text-brand-800">{s.desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-sm text-brand-800">
                Vale para todos os itens. Você pode ajustar item a item depois.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="freq">Frequência</label>
                <select
                  className="input"
                  id="freq"
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value)}
                >
                  {FREQUENCIAS.map((f) => (
                    <option key={f.chave} value={f.chave}>{f.rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="equipe">Pessoas na equipe</label>
                <input
                  className="input"
                  id="equipe"
                  type="number"
                  min={1}
                  max={20}
                  value={equipe}
                  onChange={(e) => setEquipe(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="label" htmlFor="taxa">Valor da hora (USD)</label>
                <input
                  className="input"
                  id="taxa"
                  type="number"
                  min={0}
                  step={5}
                  value={taxaHora}
                  onChange={(e) => setTaxaHora(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex min-h-touch cursor-pointer items-center gap-2 font-medium text-brand-800">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-700"
                  checked={noturno}
                  onChange={() => setNoturno(!noturno)}
                />
                🌙 Turno noturno (+20%)
              </label>
              <label className="flex min-h-touch cursor-pointer items-center gap-2 font-medium text-brand-800">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-700"
                  checked={suprimentos}
                  onChange={() => setSuprimentos(!suprimentos)}
                />
                🧴 Fornecemos os produtos
              </label>
            </div>
          </div>

          {/* 3. O que limpar */}
          <div className="card">
            <p className="mb-1 text-xl font-semibold text-brand-900">3. O que será limpo</p>
            <p className="mb-4 text-brand-800">
              Marque os itens, ajuste a quantidade e, se for o caso, o grau de sujeira de cada um.
            </p>

            <div className="space-y-4">
              {areas.map((area) => {
                const itens = doSegmento.filter((c) => c.area === area);
                const marcados = itens.filter((c) => escolhidos[c.id]).length;
                return (
                  <div key={area} className="rounded-card border border-brand-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-50 px-3 py-2">
                      <p className="font-semibold text-brand-900">
                        {area}
                        {marcados > 0 && (
                          <span className="ml-2 text-sm font-medium text-brand-700">
                            {marcados} de {itens.length}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-700"
                        onClick={() => marcarArea(area, marcados < itens.length)}
                      >
                        {marcados < itens.length ? 'marcar tudo' : 'desmarcar'}
                      </button>
                    </div>

                    <div className="divide-y divide-brand-100">
                      {itens.map((c) => {
                        const esc = escolhidos[c.id];
                        return (
                          <div key={c.id} className="p-3">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-5 w-5 shrink-0 accent-brand-700"
                                checked={Boolean(esc)}
                                onChange={() => marcar(c)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium text-brand-900">{c.item}</span>
                                <span className="block text-xs text-brand-800">
                                  {Number(c.minutes_per_unit) < 1
                                    ? `${(Number(c.minutes_per_unit) * 100).toFixed(1)} min por 100 ${UNIDADE_LABEL[c.unit]}`
                                    : `${c.minutes_per_unit} min por ${UNIDADE_LABEL[c.unit]}`}
                                </span>
                              </span>
                            </label>

                            {esc && (
                              <div className="mt-2 flex flex-wrap items-end gap-3 pl-8">
                                <div>
                                  <label className="label" htmlFor={`q-${c.id}`}>
                                    Quantidade ({UNIDADE_LABEL[c.unit]})
                                  </label>
                                  <input
                                    className="input !w-28"
                                    id={`q-${c.id}`}
                                    type="number"
                                    min={0}
                                    step={c.unit === 'sqft' ? 50 : 1}
                                    value={esc.qty}
                                    onChange={(e) => mudarQtd(c.id, Number(e.target.value))}
                                  />
                                </div>
                                <div className="flex gap-1">
                                  {SUJEIRA.map((s) => (
                                    <button
                                      key={s.chave}
                                      type="button"
                                      onClick={() => mudarSujeira(c.id, s.chave)}
                                      className={`min-h-touch rounded-card px-3 py-2 text-xs font-medium ${
                                        esc.sujeira === s.chave
                                          ? 'bg-brand-900 text-white'
                                          : 'bg-brand-50 text-brand-800'
                                      }`}
                                    >
                                      {s.rotulo}
                                    </button>
                                  ))}
                                </div>
                                <span className="self-center text-sm font-medium text-brand-700">
                                  {tempo(
                                    esc.qty *
                                      Number(c.minutes_per_unit) *
                                      (SUJEIRA.find((s) => s.chave === esc.sujeira)?.mult ?? 1)
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Resultado */}
          <div className="card bg-brand-900 !border-brand-900 text-white">
            <p className="mb-3 text-xl font-semibold">4. O cálculo</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-brand-100">Tempo por visita</p>
                <p className="text-3xl font-bold">{tempo(calculo.minutos)}</p>
                <p className="text-sm text-brand-100">
                  {equipe > 1 && `${tempo(calculo.minutos / equipe)} com ${equipe} pessoas`}
                </p>
              </div>
              <div>
                <p className="text-brand-100">Por visita</p>
                <p className="text-3xl font-bold text-aqua-400">{usd(calculo.precoVisita)}</p>
                <p className="text-sm text-brand-100">
                  {usd(calculo.taxaFinal)}/h {noturno && '(noturno)'}
                </p>
              </div>
              <div>
                <p className="text-brand-100">Por mês</p>
                <p className="text-3xl font-bold text-aqua-400">{usd(calculo.precoMes)}</p>
                <p className="text-sm text-brand-100">
                  {visitasMes.toFixed(1).replace('.0', '')} visitas/mês
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-brand-100">
              {calculo.detalhe.length} item(ns) marcado(s)
              {suprimentos && ' · produtos inclusos'}
            </p>
          </div>

          {/* 5. Para quem */}
          <div className="card">
            <p className="mb-3 text-xl font-semibold text-brand-900">5. Para quem é a proposta</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="cliente">Contrato existente</label>
                <select
                  className="input"
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    const c = clientes.find((x) => x.id === e.target.value);
                    if (c?.business_segment) setSegmento(c.business_segment);
                    if (c?.area_sqft) setAreaSqft(String(c.area_sqft));
                  }}
                >
                  <option value="">Novo interessado</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="area">Área total (sq ft)</label>
                <input
                  className="input"
                  id="area"
                  type="number"
                  min={0}
                  step={100}
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                />
              </div>
            </div>

            {!clienteId && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="ln">Nome da empresa *</label>
                  <input
                    className="input"
                    id="ln"
                    value={leadNome}
                    onChange={(e) => setLeadNome(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lt">Telefone</label>
                  <input
                    className="input"
                    id="lt"
                    type="tel"
                    value={leadTelefone}
                    onChange={(e) => setLeadTelefone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="le">Email</label>
                  <input
                    className="input"
                    id="le"
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="label" htmlFor="end">Endereço do local</label>
              <input
                className="input"
                id="end"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="obs">Observações da proposta</label>
              <textarea
                className="input"
                id="obs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: serviço realizado após as 22h, com equipe fixa. Produtos e equipamentos por nossa conta."
              />
            </div>

            {erro && <p className="mt-3 rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}

            <button
              className="btn-primary mt-4 w-full"
              type="button"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Gerar proposta'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
