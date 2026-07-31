/**
 * Planos comerciais do CleanFlow.
 * Alterar aqui reflete no painel da plataforma e nas telas da empresa.
 */

export type PlanKey = 'standard' | 'plus';

export interface Plan {
  key: PlanKey;
  name: string;
  price: number;          // mensalidade base em USD
  baseTeams: number;      // equipes incluidas
  extraTeamPrice: number; // preco por equipe adicional (0 = nao permite)
  highlights: string[];
}

export const PLANS: Record<PlanKey, Plan> = {
  standard: {
    key: 'standard',
    name: 'Standard',
    price: 30,
    baseTeams: 1,
    extraTeamPrice: 0,
    highlights: [
      '1 equipe',
      'Clientes, agenda e calendário',
      'Estimates com checklist e contrato',
      'App da equipe com check-in por GPS',
      'Relatórios gerenciais',
    ],
  },
  plus: {
    key: 'plus',
    name: 'Plus',
    price: 50,
    baseTeams: 2,
    extraTeamPrice: 10,
    highlights: [
      '2 equipes (US$ 10/mês por equipe adicional)',
      'Tudo do Standard',
      'Mapa em tempo real das equipes',
      'Sugestão de rota e encaixe por distância',
      'Time de marketing com acesso próprio',
      'Documentos em 4 idiomas',
    ],
  },
};

export function maxTeams(plan: string, extraTeams = 0): number {
  const p = PLANS[(plan as PlanKey) in PLANS ? (plan as PlanKey) : 'standard'];
  return p.baseTeams + (p.extraTeamPrice > 0 ? extraTeams : 0);
}

export function monthlyFee(plan: string, extraTeams = 0): number {
  const p = PLANS[(plan as PlanKey) in PLANS ? (plan as PlanKey) : 'standard'];
  return p.price + (p.extraTeamPrice > 0 ? extraTeams * p.extraTeamPrice : 0);
}

export function planName(plan: string): string {
  return PLANS[(plan as PlanKey) in PLANS ? (plan as PlanKey) : 'standard'].name;
}
