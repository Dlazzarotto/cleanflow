/**
 * Planos comerciais do CleanFlow: Base, Pro e Plus.
 * Alterar aqui reflete no painel da plataforma e nas telas da empresa.
 *
 * ATENCAO — estes numeros existem em DOIS lugares:
 *   1) este arquivo, que manda no que aparece na tela;
 *   2) supabase/migration-53-planos-base-pro-plus.sql, que manda de verdade
 *      (as travas rodam no banco, nao aqui).
 * Mudou preco, equipe, cliente ou acesso aqui -> mudar la tambem, senao a
 * tela promete uma coisa e o banco recusa outra.
 */

export type PlanKey = 'base' | 'pro' | 'plus';

export interface Plan {
  key: PlanKey;
  name: string;
  price: number;            // mensalidade base em USD
  baseTeams: number;        // equipes incluidas
  extraTeamPrice: number;   // preco por equipe adicional
  maxClients: number | null; // clientes ativos; null = sem limite
  reports: boolean;          // libera a tela de Relatorios
  commercial: boolean;       // libera o modo comercial
  highlights: string[];
}

export const EXTRA_TEAM_PRICE = 19.99;

export const PLANS: Record<PlanKey, Plan> = {
  base: {
    key: 'base',
    name: 'Base',
    price: 30,
    baseTeams: 1,
    extraTeamPrice: EXTRA_TEAM_PRICE,
    maxClients: 50,
    reports: false,
    commercial: false,
    highlights: [
      'Limpeza residencial',
      'Até 50 clientes ativos',
      '1 equipe · 2 acessos (a dona + a equipe)',
      'Clientes, agenda e calendário',
      'Estimates com checklist e contrato',
      'App da equipe com check-in por GPS',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 60,
    baseTeams: 2,
    extraTeamPrice: EXTRA_TEAM_PRICE,
    maxClients: 200,
    reports: true,
    commercial: false,
    highlights: [
      'Tudo do Base',
      'Até 200 clientes ativos',
      '2 equipes · 3 acessos (a dona + uma por equipe)',
      'Relatórios gerenciais',
      'Mapa em tempo real das equipes',
      'Sugestão de rota e encaixe por distância',
      'Time de marketing com acesso próprio',
    ],
  },
  plus: {
    key: 'plus',
    name: 'Plus',
    price: 90,
    baseTeams: 3,
    extraTeamPrice: EXTRA_TEAM_PRICE,
    maxClients: null,
    reports: true,
    commercial: true,
    highlights: [
      'Tudo do Pro',
      'Limpeza comercial: escritórios, restaurantes, lojas, clínicas',
      'Clientes ilimitados · 3 equipes · 4 acessos',
      'Catálogo de áreas por segmento',
      'Contrato mensal fixo e prazos net 15/30/45',
      'Propostas comerciais por item, área e grau de sujeira',
    ],
  },
};

/**
 * Aceita o que vier do banco e devolve um plano valido.
 * Os nomes antigos ('standard'/'plus' da migration-22) sao traduzidos para a
 * nomenclatura nova — ver migration-53. Cuidado: o 'plus' antigo virou 'pro',
 * entao a migration precisa rodar junto com o deploy; enquanto nao rodar, uma
 * empresa no 'plus' antigo aparece como Plus novo na tela. As travas de verdade
 * estao no banco, entao isso e so cosmetico, mas nao demore entre um e outro.
 */
export function planKey(plan: string | null | undefined): PlanKey {
  if (plan === 'base' || plan === 'pro' || plan === 'plus') return plan;
  if (plan === 'standard') return 'base';
  return 'base';
}

export function plan(p: string | null | undefined): Plan {
  return PLANS[planKey(p)];
}

export function maxTeams(p: string, extraTeams = 0): number {
  return plan(p).baseTeams + Math.max(0, extraTeams);
}

export function monthlyFee(p: string, extraTeams = 0): number {
  const t = plan(p);
  return t.price + Math.max(0, extraTeams) * t.extraTeamPrice;
}

export function planName(p: string): string {
  return plan(p).name;
}

/** Limite de clientes ativos; null = sem limite. */
export function maxClients(p: string): number | null {
  return plan(p).maxClients;
}

/**
 * Limite de acessos: 1 da dona + 1 por equipe.
 * Cada equipe tem um login so, compartilhado pela turma — nao e um login
 * por faxineira. Quem entra e sai da equipe e trocado no cadastro, e o
 * acesso segue sendo da equipe. Equipe adicional soma um acesso.
 */
export function maxUsers(p: string, extraTeams = 0): number {
  return 1 + maxTeams(p, extraTeams);
}

/** O plano libera a tela de Relatorios? */
export function hasReports(p: string): boolean {
  return plan(p).reports;
}

/** O plano inclui limpeza comercial? So o Plus. */
export function hasCommercial(p: string): boolean {
  return plan(p).commercial;
}

/** Texto curto do limite, para mostrar na tela. */
export function limitLabel(n: number | null, singular: string, plural: string): string {
  return n === null ? `${plural} ilimitados` : `até ${n} ${n === 1 ? singular : plural}`;
}
