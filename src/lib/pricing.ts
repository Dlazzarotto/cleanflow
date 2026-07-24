/**
 * Motor de precificacao do CleanFlow.
 * Cada tarefa tem um tempo medio em minutos; o total de minutos
 * vira uma faixa de preco a partir da tarifa/hora da empresa.
 * Os tempos sao ajustaveis aqui num so lugar.
 */

export interface Task {
  id: string;
  label: string;
  min: number; // minutos por comodo
  default: boolean;
}

export const BEDROOM_TASKS: Task[] = [
  { id: 'aspirar', label: 'Aspirar / varrer', min: 8, default: true },
  { id: 'po', label: 'Tirar pó (móveis e superfícies)', min: 6, default: true },
  { id: 'cama', label: 'Trocar roupa de cama', min: 6, default: true },
  { id: 'espelhos', label: 'Limpar espelhos e vidros internos', min: 3, default: true },
  { id: 'organizar', label: 'Organizar o ambiente', min: 5, default: false },
  { id: 'janelas', label: 'Janelas por dentro', min: 6, default: false },
];

export const BATHROOM_TASKS: Task[] = [
  { id: 'vaso', label: 'Vaso sanitário', min: 8, default: true },
  { id: 'box', label: 'Box / banheira', min: 12, default: true },
  { id: 'pia', label: 'Pia e bancada', min: 6, default: true },
  { id: 'espelho', label: 'Espelho', min: 3, default: true },
  { id: 'chao', label: 'Chão', min: 6, default: true },
  { id: 'rejunte', label: 'Rejunte / detalhes (deep)', min: 15, default: false },
];

export const HALF_BATH_MINUTES = 12;

export interface ExtraRoom {
  id: string;
  label: string;
  tasks: Task[];
}

export const EXTRA_ROOMS: ExtraRoom[] = [
  {
    id: 'cozinha',
    label: 'Cozinha',
    tasks: [
      { id: 'fogao', label: 'Fogão / cooktop', min: 15, default: true },
      { id: 'pia', label: 'Pia', min: 8, default: true },
      { id: 'bancadas', label: 'Bancadas', min: 8, default: true },
      { id: 'micro', label: 'Micro-ondas (dentro e fora)', min: 5, default: true },
      { id: 'geladeira_fora', label: 'Geladeira por fora', min: 5, default: true },
      { id: 'geladeira_dentro', label: 'Geladeira por dentro', min: 20, default: false },
      { id: 'armarios', label: 'Armários por fora', min: 8, default: true },
      { id: 'forno', label: 'Forno por dentro', min: 25, default: false },
      { id: 'chao', label: 'Chão', min: 10, default: true },
    ],
  },
  {
    id: 'sala',
    label: 'Sala / estar',
    tasks: [
      { id: 'aspirar', label: 'Aspirar / varrer', min: 10, default: true },
      { id: 'po', label: 'Tirar pó', min: 8, default: true },
      { id: 'sofas', label: 'Aspirar sofás', min: 8, default: false },
      { id: 'organizar', label: 'Organizar', min: 5, default: false },
    ],
  },
  {
    id: 'escritorio',
    label: 'Escritório',
    tasks: [
      { id: 'geral', label: 'Limpeza geral', min: 12, default: true },
    ],
  },
  {
    id: 'porao',
    label: 'Porão / basement',
    tasks: [
      { id: 'geral', label: 'Limpeza geral', min: 25, default: true },
    ],
  },
  {
    id: 'area_servico',
    label: 'Área de serviço / laundry room',
    tasks: [
      { id: 'geral', label: 'Limpeza geral', min: 10, default: true },
    ],
  },
  {
    id: 'escadas_corredores',
    label: 'Escadas e corredores',
    tasks: [
      { id: 'geral', label: 'Aspirar e tirar pó', min: 12, default: true },
    ],
  },
];

export const LAUNDRY_MINUTES_PER_LOAD = 20; // trabalho ativo por carga
export const BASE_MINUTES = 30;             // chegada, preparo, produtos

export interface PricingSettings {
  hourly_rate: number;
  min_price: number;
  deep_multiplier: number;
  cancel_notice_hours: number;
  lockout_fee: number;
  termination_notice_days: number;
  solicitation_fee: number;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  hourly_rate: 55,
  min_price: 130,
  deep_multiplier: 1.5,
  cancel_notice_hours: 48,
  lockout_fee: 70,
  termination_notice_days: 30,
  solicitation_fee: 2500,
};

export const FREQUENCY_LABEL: Record<string, string> = {
  unica: 'Limpeza única (sem recorrência)',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal (a cada 2 semanas)',
  mensal: 'Mensal (a cada 4 semanas)',
};

export interface EstimateInput {
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  bedroom_tasks: string[];              // ids selecionados (aplicados a cada quarto)
  bathroom_tasks: string[];             // ids selecionados (aplicados a cada banheiro)
  extras: Record<string, string[]>;     // { cozinha: [taskIds], ... }
  laundry: boolean;
  laundry_loads: number;
  deep_clean: boolean;
}

export interface EstimateResult {
  minutes: number;
  price_low: number;
  price_high: number;
}

function sumTasks(catalog: Task[], selected: string[]) {
  return catalog.filter((t) => selected.includes(t.id)).reduce((s, t) => s + t.min, 0);
}

function round5(n: number) {
  return Math.round(n / 5) * 5;
}

export function calcEstimate(input: EstimateInput, settings: PricingSettings): EstimateResult {
  let minutes = BASE_MINUTES;
  minutes += input.bedrooms * sumTasks(BEDROOM_TASKS, input.bedroom_tasks);
  minutes += input.full_baths * sumTasks(BATHROOM_TASKS, input.bathroom_tasks);
  minutes += input.half_baths * HALF_BATH_MINUTES;

  for (const room of EXTRA_ROOMS) {
    const selected = input.extras[room.id];
    if (selected && selected.length > 0) {
      minutes += sumTasks(room.tasks, selected);
    }
  }

  if (input.laundry) {
    minutes += Math.max(input.laundry_loads, 1) * LAUNDRY_MINUTES_PER_LOAD;
  }

  if (input.deep_clean) {
    minutes = Math.round(minutes * settings.deep_multiplier);
  }

  const raw = (minutes / 60) * settings.hourly_rate;
  const low = Math.max(round5(raw), settings.min_price);
  const high = Math.max(round5(raw * 1.3), low + 10);

  return { minutes, price_low: low, price_high: high };
}

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
