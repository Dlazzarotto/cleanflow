import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import {
  createTeamAction,
  updateTeamAction,
  addTeamMemberAction,
  removeTeamMemberAction,
  setMembershipActiveAction,
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
  setMemberPositionAction,
} from '@/lib/actions';
import { PERMISSION_KEYS } from '@/lib/permissions';
import InviteForm from '@/components/InviteForm';
import ResetAccessButton from '@/components/ResetAccessButton';
import type { Team } from '@/lib/types';
import { maxTeams, planName, PLANS } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono(a)',
  admin: 'Admin',
  supervisor: 'Supervisor(a)',
  cleaner: 'Equipe',
  marketing: 'Marketing',
};

export default async function EquipesPage() {
  await requireManager();
  const supabase = createClient();
  const { data: companyId } = await supabase.rpc('current_company_id');

  const [{ data: teams }, { data: members }, { data: teamMembers }, { data: positions }, { data: companyRow }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase
      .from('memberships')
      .select('id, user_id, full_name, role, active, position_id')
      .eq('company_id', companyId)
      .order('full_name'),
    supabase.from('team_members').select('team_id, profile_id'),
    supabase.from('positions').select('*').order('name'),
    supabase.from('companies').select('plan, extra_teams').eq('id', companyId).single(),
  ]);
  const plan = (companyRow as any)?.plan ?? 'standard';
  const extras = (companyRow as any)?.extra_teams ?? 0;
  const limite = maxTeams(plan, extras);
  const positionList = positions ?? [];

  const teamList = (teams ?? []) as Team[];
  const memberList = members ?? [];
  const tm = teamMembers ?? [];
  const nameByUser = new Map(memberList.map((m: any) => [m.user_id, m.full_name]));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-brand-900">Equipes e acessos</h1>

      {/* Pessoas com acesso */}
      <div className="card">
        <h2 className="mb-3 text-xl font-semibold text-brand-900">👥 Pessoas da empresa</h2>
        {memberList.length === 0 ? (
          <p className="text-brand-800">Nenhuma pessoa ainda.</p>
        ) : (
          <div className="space-y-2">
            {[
              { titulo: '🏢 Gestão', roles: ['owner', 'admin', 'supervisor'] },
              { titulo: '🧹 Equipe de limpeza (campo)', roles: ['cleaner'] },
              { titulo: '📣 Marketing (sem trabalho de campo)', roles: ['marketing'] },
            ].map((grupo) => {
              const pessoas = memberList.filter((m: any) => grupo.roles.includes(m.role));
              if (pessoas.length === 0) return null;
              return (
                <div key={grupo.titulo} className="pt-2">
                  <p className="mb-2 font-semibold text-brand-800">{grupo.titulo}</p>
                  <div className="space-y-2">
                    {pessoas.map((m: any) => (
              <div key={m.id} className="rounded-card border border-brand-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={`font-semibold ${!m.active ? 'line-through opacity-60' : ''}`}>{m.full_name}</p>
                  <p className="text-sm text-brand-800">{ROLE_LABEL[m.role] ?? m.role}{!m.active ? ' · acesso desativado' : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.role === 'cleaner' && (
                    <form action={setMemberPositionAction} className="flex items-center gap-2">
                      <input type="hidden" name="membership_id" value={m.id} />
                      <select className="input !w-48" name="position_id" defaultValue={m.position_id ?? ''}>
                        <option value="">Cargo padrão (tudo)</option>
                        {positionList.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button className="btn-ghost" type="submit">Aplicar</button>
                    </form>
                  )}
                  <form action={setMembershipActiveAction.bind(null, m.id, !m.active)}>
                    <button className={m.active ? 'btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50' : 'btn-ghost'} type="submit">
                      {m.active ? 'Desativar acesso' : 'Reativar acesso'}
                    </button>
                  </form>
                </div>
                </div>
                <div className="mt-2">
                  <ResetAccessButton membershipId={m.id} personName={m.full_name} />
                </div>
              </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cargos com permissoes por clique */}
      <div className="card">
        <h2 className="mb-3 text-xl font-semibold text-brand-900">🏷️ Cargos e permissões</h2>
        <p className="mb-4 text-brand-800">
          Crie cargos (ex: Equipe de Limpeza, Motorista, Líder de Equipe) e marque o que cada um pode ver
          no app. Valores e pagamentos permanecem sempre restritos à gestão, independentemente do cargo.
        </p>

        {positionList.length > 0 && (
          <div className="mb-4 space-y-2">
            {positionList.map((p: any) => (
              <details key={p.id} className="rounded-card border border-brand-100 px-4 py-3">
                <summary className="flex min-h-touch cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-2 text-sm text-brand-800">
                      {PERMISSION_KEYS.filter((k) => p.permissions?.[k.key]).map((k) => k.label).join(' · ') || 'Nenhuma permissão marcada'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-brand-700">✏️ Editar</span>
                </summary>
                <form action={updatePositionAction} className="mt-3 border-t border-brand-100 pt-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="mb-3">
                    <label className="label" htmlFor={`pos-name-${p.id}`}>Nome do cargo</label>
                    <input className="input" id={`pos-name-${p.id}`} name="name" required defaultValue={p.name} />
                  </div>
                  <p className="label">O que este cargo pode ver/fazer:</p>
                  <div className="mb-4 space-y-1">
                    {PERMISSION_KEYS.map((k) => (
                      <label key={k.key} className="flex min-h-touch cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          name={`perm_${k.key}`}
                          defaultChecked={Boolean(p.permissions?.[k.key])}
                          className="h-5 w-5 accent-brand-700"
                        />
                        {k.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" type="submit">Salvar alterações</button>
                  </div>
                </form>
                <form action={deletePositionAction.bind(null, p.id)} className="mt-2">
                  <button className="btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50" type="submit">Excluir cargo</button>
                </form>
              </details>
            ))}
          </div>
        )}

        <form action={createPositionAction} className="rounded-card bg-brand-50 p-4">
          <div className="mb-3">
            <label className="label" htmlFor="pos-name">Nome do cargo</label>
            <input className="input" id="pos-name" name="name" required placeholder="Ex: Motorista" />
          </div>
          <p className="label">O que este cargo pode ver/fazer:</p>
          <div className="mb-4 space-y-1">
            {PERMISSION_KEYS.map((k) => (
              <label key={k.key} className="flex min-h-touch cursor-pointer items-center gap-3">
                <input type="checkbox" name={`perm_${k.key}`} defaultChecked className="h-5 w-5 accent-brand-700" />
                {k.label}
              </label>
            ))}
          </div>
          <button className="btn-primary" type="submit">Criar cargo</button>
        </form>
      </div>

      <InviteForm teams={teamList.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))} />

      {/* Nova equipe */}
      <div className="card">
        <p className="font-semibold text-brand-900">
          Plano {planName(plan)} · {teamList.filter((t) => t.active).length} de {limite} equipe(s) em uso
        </p>
        {teamList.filter((t) => t.active).length >= limite && (
          <p className="mt-2 text-brand-800">
            Você atingiu o limite do seu plano.{' '}
            {plan === 'standard'
              ? `O plano Plus inclui ${PLANS.plus.baseTeams} equipes por US$ ${PLANS.plus.price}/mês.`
              : `Equipes adicionais custam US$ ${PLANS.plus.extraTeamPrice}/mês cada.`}{' '}
            Fale com o suporte do CleanFlow para fazer o upgrade.
          </p>
        )}
      </div>

      <form action={createTeamAction} className="card flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label" htmlFor="name">Nova equipe</label>
          <input className="input" id="name" name="name" required placeholder="Ex: Equipe A" />
        </div>
        <div>
          <label className="label" htmlFor="color">Cor</label>
          <input className="h-12 w-16 cursor-pointer rounded-card border border-brand-100" id="color" name="color" type="color" defaultValue="#13706B" />
        </div>
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>

      {/* Equipes com edicao e membros */}
      {teamList.map((t) => {
        const currentMembers = tm.filter((x: any) => x.team_id === t.id);
        const availableMembers = memberList.filter(
          (m: any) => m.active && !currentMembers.some((x: any) => x.profile_id === m.user_id)
        );
        return (
          <div key={t.id} className="card space-y-4">
            <form action={updateTeamAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={t.id} />
              <div className="grow">
                <label className="label" htmlFor={`team-name-${t.id}`}>Nome da equipe</label>
                <input className="input" id={`team-name-${t.id}`} name="name" defaultValue={t.name} />
              </div>
              <div>
                <label className="label" htmlFor={`team-color-${t.id}`}>Cor</label>
                <input className="h-12 w-16 cursor-pointer rounded-card border border-brand-100" id={`team-color-${t.id}`} name="color" type="color" defaultValue={t.color} />
              </div>
              <label className="flex min-h-touch items-center gap-2 font-medium text-brand-800">
                <input type="checkbox" name="active" className="h-5 w-5 accent-brand-700" defaultChecked={t.active} />
                Ativa
              </label>
              <button className="btn-ghost" type="submit">Salvar</button>
            </form>

            <div>
              <p className="mb-2 font-semibold text-brand-800">Membros:</p>
              {currentMembers.length === 0 ? (
                <p className="text-brand-800">Nenhum membro ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {currentMembers.map((x: any) => (
                    <form key={x.profile_id} action={removeTeamMemberAction.bind(null, t.id, x.profile_id)}>
                      <button
                        className="rounded-full px-3 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: t.color }}
                        type="submit"
                        title="Clique para remover da equipe"
                      >
                        {nameByUser.get(x.profile_id) ?? 'Pessoa'} ✕
                      </button>
                    </form>
                  ))}
                </div>
              )}
              {availableMembers.length > 0 && (
                <form action={addTeamMemberAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="team_id" value={t.id} />
                  <div className="grow">
                    <label className="label" htmlFor={`add-${t.id}`}>Adicionar pessoa</label>
                    <select className="input" id={`add-${t.id}`} name="user_id" defaultValue="">
                      <option value="" disabled>Selecionar</option>
                      {availableMembers.map((m: any) => (
                        <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-ghost" type="submit">Adicionar</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
