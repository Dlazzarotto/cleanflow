import { createClient } from '@/lib/supabase/server';
import { createTeamAction } from '@/lib/actions';
import type { Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EquipesPage() {
  const supabase = createClient();
  const { data } = await supabase.from('teams').select('*').order('name');
  const teams = (data ?? []) as Team[];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Equipes</h1>

      <form action={createTeamAction} className="card mb-6 flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label" htmlFor="name">Nome da equipe</label>
          <input className="input" id="name" name="name" required placeholder="Ex: Equipe A" />
        </div>
        <div>
          <label className="label" htmlFor="color">Cor</label>
          <input className="h-12 w-16 cursor-pointer rounded-card border border-brand-100" id="color" name="color" type="color" defaultValue="#13706B" />
        </div>
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>

      {teams.length === 0 ? (
        <div className="card text-brand-800">Nenhuma equipe cadastrada. Adicione a primeira acima.</div>
      ) : (
        <div className="space-y-3">
          {teams.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                <p className="text-xl font-semibold">{t.name}</p>
              </div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                {t.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
