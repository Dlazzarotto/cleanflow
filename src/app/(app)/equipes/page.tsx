import { createClient } from '@/lib/supabase/server';
import {
  createTeamAction,
  updateTeamAction,
  addTeamMemberAction,
  removeTeamMemberAction,
  setMembershipActiveAction,
} from '@/lib/actions';
import InviteForm from '@/components/InviteForm';
import type { Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono(a)',
  admin: 'Admin',
  supervisor: 'Supervisor(a)',
  cleaner: 'Equipe',
};

export default async function EquipesPage() {
  const supabase = createClient();
  const { data: companyId } = await supabase.rpc('current_company_id');

  const [{ data: teams }, { data: members }, { data: teamMembers }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase
      .from('memberships')
      .select('id, user_id, full_name, role, active')
      .eq('company_id', companyId)
      .order('full_name'),
    supabase.from('team_members').select('team_id, profile_id'),
  ]);

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
            {memberList.map((m: any) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-brand-100 px-4 py-3">
                <div>
                  <p className={`font-semibold ${!m.active ? 'line-through opacity-60' : ''}`}>{m.full_name}</p>
                  <p className="text-sm text-brand-800">{ROLE_LABEL[m.role] ?? m.role}{!m.active ? ' · acesso desativado' : ''}</p>
                </div>
                <form action={setMembershipActiveAction.bind(null, m.id, !m.active)}>
                  <button className={m.active ? 'btn-ghost !border-red-700 !text-red-700 hover:!bg-red-50' : 'btn-ghost'} type="submit">
                    {m.active ? 'Desativar acesso' : 'Reativar acesso'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteForm teams={teamList.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))} />

      {/* Nova equipe */}
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
