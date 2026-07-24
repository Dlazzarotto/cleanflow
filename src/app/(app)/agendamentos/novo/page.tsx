import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import BookingForm from '@/components/BookingForm';

export const dynamic = 'force-dynamic';

export default async function NovoAgendamentoPage() {
  await requireManager();
  const supabase = createClient();
  const [{ data: clients }, { data: teams }] = await Promise.all([
    supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name'),
    supabase.from('teams').select('id, name').eq('active', true).order('name'),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Nova limpeza</h1>
      <BookingForm
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
        teams={(teams ?? []).map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
