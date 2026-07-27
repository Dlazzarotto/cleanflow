'use client';
import { useState } from 'react';
import { createRecurrenceFromEstimateAction } from '@/lib/actions/estimates';

interface TeamOption {
  id: string;
  name: string;
}

export default function RecurrenceFromEstimate({
  estimateId,
  frequency,
  teams,
  alreadyScheduled,
}: {
  estimateId: string;
  frequency: string | null;
  teams: TeamOption[];
  alreadyScheduled: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (alreadyScheduled) {
    return (
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
        🔁 recorrência já agendada
      </span>
    );
  }

  if (!open) {
    return (
      <button className="btn-primary" type="button" onClick={() => setOpen(true)}>
        📅 Agendar recorrência
      </button>
    );
  }

  return (
    <form action={createRecurrenceFromEstimateAction} className="w-full rounded-card bg-brand-50 p-4">
      <input type="hidden" name="estimate_id" value={estimateId} />
      <p className="mb-3 font-semibold text-brand-900">
        Criar a série de limpezas ({frequency ?? 'sem frequência definida'})
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="label" htmlFor={`rec-date-${estimateId}`}>Primeira limpeza</label>
          <input className="input" id={`rec-date-${estimateId}`} name="date" type="date" required />
        </div>
        <div>
          <label className="label" htmlFor={`rec-time-${estimateId}`}>Horário</label>
          <input className="input" id={`rec-time-${estimateId}`} name="time" type="time" defaultValue="09:00" required />
        </div>
        <div>
          <label className="label" htmlFor={`rec-team-${estimateId}`}>Equipe</label>
          <select className="input" id={`rec-team-${estimateId}`} name="team_id" defaultValue="">
            <option value="">Definir depois</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`rec-occ-${estimateId}`}>Quantas limpezas</label>
          <input className="input" id={`rec-occ-${estimateId}`} name="occurrences" type="number" min={1} max={52} defaultValue={12} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" type="submit">Criar agenda</button>
        <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
