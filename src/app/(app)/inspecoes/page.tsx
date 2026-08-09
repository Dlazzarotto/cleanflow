import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { startInspectionAction } from '@/lib/actions/inspections';
import BackLink from '@/components/BackLink';
import { getModo, ROTULOS } from '@/lib/mode';

export const dynamic = 'force-dynamic';

function nota(p: number | null) {
  if (p === null) return { texto: '—', cls: 'bg-brand-100 text-brand-900' };
  if (p >= 90) return { texto: `${p}%`, cls: 'bg-aqua-500 text-white' };
  if (p >= 75) return { texto: `${p}%`, cls: 'bg-aqua-400 text-white' };
  if (p >= 60) return { texto: `${p}%`, cls: 'bg-sun text-brand-900' };
  return { texto: `${p}%`, cls: 'bg-red-700 text-white' };
}

const SITUACAO: Record<string, string> = {
  rascunho: 'Em andamento',
  concluida: 'Concluída',
  enviada: 'Enviada ao cliente',
};

export default async function InspecoesPage() {
  await requireManager();
  const modo = await getModo();
  const supabase = createClient();

  // Só os clientes deste modo (residencial ou comercial)
  const { data: idsModo } = await supabase
    .from('clients')
    .select('id')
    .eq('client_type', modo);
  const clientesDoModo = (idsModo ?? []).map((c: any) => c.id);


  const [{ data: inspecoes }, { data: modelos }, { data: clientes }] = await Promise.all([
    supabase
      .from('inspections')
      .select('*, clients(full_name)')
      .in('client_id', clientesDoModo)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('inspection_templates').select('id, name, segment').eq('active', true).order('name'),
    supabase.from('clients').select('id, full_name').eq('status', 'ativo').eq('client_type', modo).order('full_name'),
  ]);

  const lista = (inspecoes ?? []) as any[];
  const concluidas = lista.filter((i) => i.status !== 'rascunho' && i.percent !== null);
  const media =
    concluidas.length > 0
      ? Math.round(concluidas.reduce((s, i) => s + Number(i.percent), 0) / concluidas.length)
      : null;

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">🔍 Inspeções de qualidade</h1>
      <p className="mb-6 text-brand-800">
        Avalie o serviço ponto a ponto, com nota e foto. O cliente recebe um relatório — é a prova
        documentada que protege o contrato.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-brand-800">Nota média</p>
          <p className="text-3xl font-bold text-brand-900">{media !== null ? `${media}%` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Inspeções feitas</p>
          <p className="text-3xl font-bold">{concluidas.length}</p>
        </div>
        <div className="card">
          <p className="text-brand-800">Em andamento</p>
          <p className="text-3xl font-bold text-sun">
            {lista.filter((i) => i.status === 'rascunho').length}
          </p>
        </div>
        <div className="card">
          <p className="text-brand-800">Enviadas ao cliente</p>
          <p className="text-3xl font-bold text-brand-700">
            {lista.filter((i) => i.status === 'enviada').length}
          </p>
        </div>
      </div>

      {/* Nova inspeção */}
      <div className="card mb-6">
        <p className="mb-3 text-xl font-semibold text-brand-900">+ Nova inspeção</p>
        <form action={startInspectionAction} className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="template_id">Modelo *</label>
            <select className="input" id="template_id" name="template_id" required defaultValue="">
              <option value="" disabled>Selecionar</option>
              {(modelos ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="client_id">Cliente</label>
            <select className="input" id="client_id" name="client_id" defaultValue="">
              <option value="">Sem cliente vinculado</option>
              {(clientes ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Começar</button>
          </div>
        </form>
        <p className="mt-2 text-sm text-brand-800">
          Os modelos são editáveis em Configurações. Cada segmento tem os pontos que importam.
        </p>
      </div>

      {/* Histórico */}
      {lista.length === 0 ? (
        <div className="card text-brand-800">
          Nenhuma inspeção ainda. Comece pela primeira acima.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((i) => {
            const n = nota(i.percent !== null ? Number(i.percent) : null);
            return (
              <Link key={i.id} href={`/inspecoes/${i.id}`} className="card block hover:border-aqua-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-brand-900">
                      {i.clients?.full_name ?? 'Sem cliente'}
                    </p>
                    <p className="text-brand-800">
                      {i.inspector_name} ·{' '}
                      {new Date(i.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                      {' · '}
                      {SITUACAO[i.status] ?? i.status}
                    </p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-lg font-bold ${n.cls}`}>
                    {n.texto}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
