/**
 * Papeis de acesso do CleanFlow (migration-55).
 *
 * Lista unica — nao repetir estes nomes em tela nenhuma, importe daqui.
 * O banco tem a mesma lista no check constraint de memberships.role e nas
 * funcoes is_admin() / is_manager() / is_field(). Mudou aqui -> mudar la.
 *
 * Quem manda de verdade e o banco: a tela so mostra.
 */

export type Role =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'motorista'
  | 'helper'
  | 'outros'
  | 'marketing';

export interface RoleInfo {
  key: Role;
  label: string;
  /** Uma linha, no tom da gestora — aparece embaixo da opcao. */
  hint: string;
  /** admin = tudo · gestao = telas de gestao · equipe = campo · externo = fora da empresa */
  kind: 'admin' | 'gestao' | 'equipe' | 'externo';
}

export const ROLES: RoleInfo[] = [
  {
    key: 'admin',
    label: 'Admin',
    hint: 'Quem abriu a empresa. Vê e faz tudo, e é o único que libera acesso aos outros.',
    kind: 'admin',
  },
  {
    key: 'manager',
    label: 'Manager',
    hint: 'Escritório: organiza a agenda e as equipes.',
    kind: 'gestao',
  },
  {
    key: 'supervisor',
    label: 'Supervisor(a)',
    hint: 'Campo: cuida das equipes no dia a dia.',
    kind: 'gestao',
  },
  {
    key: 'motorista',
    label: 'Motorista',
    hint: 'Equipe. Leva a turma e faz check-in.',
    kind: 'equipe',
  },
  {
    key: 'helper',
    label: 'Helper',
    hint: 'Equipe. Trabalha na limpeza.',
    kind: 'equipe',
  },
  {
    key: 'outros',
    label: 'Outros',
    hint: 'Equipe. Para quem não se encaixa nos anteriores.',
    kind: 'equipe',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    hint: 'Não é da equipe. Pessoa ou empresa de fora que cadastra leads e acompanha só o que ela mesma cadastrou.',
    kind: 'externo',
  },
];

const BY_KEY: Record<string, RoleInfo> = Object.fromEntries(ROLES.map((r) => [r.key, r]));

/** Aceita o que vier do banco, inclusive os nomes antigos (ver migration-55). */
export function roleKey(role: string | null | undefined): Role {
  if (role && BY_KEY[role]) return role as Role;
  // De -> para dos papeis antigos, caso a migration-55 ainda nao tenha rodado.
  if (role === 'owner') return 'admin';
  if (role === 'cleaner') return 'helper';
  return 'helper';
}

export function roleLabel(role: string | null | undefined): string {
  return BY_KEY[roleKey(role)].label;
}

export function roleHint(role: string | null | undefined): string {
  return BY_KEY[roleKey(role)].hint;
}

/** Acesso total. Único que concede permissão. */
export function isAdmin(role: string | null | undefined): boolean {
  return roleKey(role) === 'admin';
}

/** Tem telas de gestão (não quer dizer que vê valores — isso é a chave do admin). */
export function isManager(role: string | null | undefined): boolean {
  return BY_KEY[roleKey(role)].kind === 'admin' || BY_KEY[roleKey(role)].kind === 'gestao';
}

/** Equipe de campo. */
export function isField(role: string | null | undefined): boolean {
  return BY_KEY[roleKey(role)].kind === 'equipe';
}

export function isMarketing(role: string | null | undefined): boolean {
  return roleKey(role) === 'marketing';
}

/**
 * Papeis que o admin pode escolher ao convidar.
 * Só o admin pode criar outro admin — ver guard_membership_admin() no banco.
 */
export function assignableRoles(byRole: string | null | undefined): RoleInfo[] {
  return isAdmin(byRole) ? ROLES : ROLES.filter((r) => r.key !== 'admin');
}

/** A chave de valores só se aplica a manager e supervisor. */
export function valuesKeyApplies(role: string | null | undefined): boolean {
  const k = roleKey(role);
  return k === 'manager' || k === 'supervisor';
}
