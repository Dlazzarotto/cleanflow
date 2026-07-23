import { createClient } from '@/lib/supabase/server';
import { createBookingAction } from '@/lib/actions';
import type { Client, Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NovoAgendamentoPage() {
  const supabase = createClient();
  const [{ data: clients }, { data: teams }] = await Promise.all([
    supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name'),
    supabase.from('teams').select('id, name').eq('active', true).order('name'),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Nova limpeza</h1>
      <form action={createBookingAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="client_id">Cliente *</label>
          <select className="input" id="client_id" name="client_id" required defaultValue="">
            <option value="" disabled>Selecionar cliente</option>
            {(clients as Pick<Client, 'id' | 'full_name'>[] | null)?.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="date">Data *</label>
            <input className="input" id="date" name="date" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="time">Horário *</label>
            <input className="input" id="time" name="time" type="time" required />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="duration_minutes">Duração (min)</label>
            <input className="input" id="duration_minutes" name="duration_minutes" type="number" defaultValue={120} min={30} step={15} />
          </div>
          <div>
            <label className="label" htmlFor="price">Preço (USD)</label>
            <input className="input" id="price" name="price" type="number" defaultValue={0} min={0} step={5} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="team_id">Equipe</label>
          <select className="input" id="team_id" name="team_id" defaultValue="">
            <option value="">Definir depois</option>
            {(teams as Pick<Team, 'id' | 'name'>[] | null)?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="notes">Observações</label>
          <textarea className="input" id="notes" name="notes" rows={3} />
        </div>
        <button className="btn-primary w-full" type="submit">Agendar limpeza</button>
      </form>
    </div>
  );
}
