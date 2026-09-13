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
  feeCap: number | null;    // teto da mensalidade; null = sem teto
  maxClients: number | null; // clientes ativos; null = sem limite (hoje: todos)
  maxUsers: number | null;   // acessos ativos;  null = sem limite (hoje: todos)
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
    feeCap: 100,
    maxClients: null,
    maxUsers: null,
    reports: false,
    commercial: false,
    highlights: [
      'Clientes ilimitados',
      'Limpeza residencial',
      'Acessos ilimitados · 1 equipe',
      'Clientes, agenda e calendário',
      'Estimates com checklist e contrato',
      'Faturas e recibos',
      'App da equipe com check-in por GPS',
      'Equipe extra US$ 19,99 — sua conta nunca passa de US$ 100',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 60,
    baseTeams: 2,
    extraTeamPrice: EXTRA_TEAM_PRICE,
    feeCap: 150,
    maxClients: null,
    maxUsers: null,
    reports: true,
    commercial: false,
    highlights: [
      'Tudo do Base',
      'Clientes ilimitados',
      'Acessos ilimitados · 2 equipes',
      'Relatórios gerenciais',
      'Mapa em tempo real das equipes',
      'Sugestão de rota e encaixe por distância',
      'Time de marketing com acesso próprio',
      'Equipe extra US$ 19,99 — sua conta nunca passa de US$ 150',
    ],
  },
  plus: {
    key: 'plus',
    name: 'Plus',
    price: 90,
    baseTeams: 3,
    extraTeamPrice: EXTRA_TEAM_PRICE,
    feeCap: null,
    maxClients: null,
    maxUsers: null,
    reports: true,
    commercial: true,
    highlights: [
      'Tudo do Pro',
      'Limpeza comercial: escritórios, restaurantes, lojas, clínicas',
      'Clientes e acessos ilimitados · 3 equipes',
      'Rentabilidade por contrato',
      'Catálogo de áreas por segmento',
      'Contrato mensal fixo e prazos net 15/30/45',
      'Propostas comerciais por item, área e grau de sujeira',
      'Equipe extra US$ 19,99, sem teto — cresça à vontade',
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

/**
 * Mensalidade com o teto do plano aplicado.
 * Base para em US$ 100, Pro em US$ 150 e o Plus nao tem teto — quem cresce
 * muito esta no Plus, e ali o crescimento vira receita. Sem teto no Base o
 * plano de entrada passaria do teto do Pro, o que nao faz sentido nenhum.
 */
export function monthlyFee(p: string, extraTeams = 0): number {
  const t = plan(p);
  const bruto = t.price + Math.max(0, extraTeams) * t.extraTeamPrice;
  return t.feeCap === null ? bruto : Math.min(bruto, t.feeCap);
}

/** Teto da mensalidade; null = sem teto. */
export function feeCap(p: string): number | null {
  return plan(p).feeCap;
}

/** A empresa ja bateu no teto do plano? */
export function atFeeCap(p: string, extraTeams = 0): boolean {
  const t = plan(p);
  if (t.feeCap === null) return false;
  return t.price + Math.max(0, extraTeams) * t.extraTeamPrice >= t.feeCap;
}

export function planName(p: string): string {
  return plan(p).name;
}

/**
 * Limite de clientes ativos; null = sem limite.
 * Hoje TODOS os planos sao ilimitados — limitar cliente pune quem cresce e
 * o concorrente direto vende "Unlimited Clients" ate na entrada. Mantido
 * como funcao porque a tela ja sabe mostrar "ilimitado" e, se um dia
 * voltar a existir teto, muda so aqui e na migration-53.
 */
export function maxClients(p: string): number | null {
  return plan(p).maxClients;
}

/**
 * Limite de acessos ativos; null = sem limite.
 * Hoje TODOS os planos sao ilimitados. A empresa decide como usar: uma
 * conta compartilhada por equipe, ou um login por pessoa — e um login a
 * mais nao custa nada para a plataforma, diferente de SMS. Com login por
 * pessoa a jornada em work_shifts volta a ter nome, o que se perdia na
 * conta compartilhada.
 */
export function maxUsers(p: string): number | null {
  return plan(p).maxUsers;
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
