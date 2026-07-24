import { createClient } from '@/lib/supabase/server';
import Calendar from '@/components/Calendar';

export const dynamic = 'force-dynamic';

export default async function CalendarioPage() {
  const supabase = createClient();
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('active', true)
    .order('name');

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Calendário</h1>
      <Calendar teams={(teams ?? []).map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
