import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { mergeClientsAction } from '@/lib/actions/duplicates';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MOTIVO: Record<string, string> = {
  'mesmo telefone': '📞 mesmo telefone',
  'mesmo email': '✉️ mesmo email',
  'nome parecido': '👤 mesmo nome',
};

export default async function DuplicadosPage() {
  await requireManager();
  const supabase = createClient();
  const { data: pares } = await supabase.rpc('find_duplicate_clients');
  const lista = (pares ?? []) as any[];

  return (
    <div>
      <BackLink href="/clientes" label="Clientes" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">👥 Cadastros repetidos</h1>
      <p className="mb-6 text-brand-800">
        Acontece quando a mesma pessoa é cadastrada duas vezes — por exemplo, o marketing lança
        o lead e a gestão cadastra o cliente sem perceber. Ao juntar, todo o histórico dos dois
        (limpezas, faturas, orçamentos) fica em um cadastro só.
      </p>

      {lista.length === 0 ? (
        <div className="card text-brand-800">
          ✅ Nenhum cadastro repetido encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {lista.map((p, idx) => (
            <div key={`${p.id_a}-${p.id_b}`} className="card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-semibold text-brand-900">
                  {p.nome_a} <span className="text-brand-800">e</span> {p.nome_b}
                </p>
                <span className="rounded-full bg-sun/20 px-3 py-1 text-sm font-medium text-brand-900">
                  {MOTIVO[p.motivo] ?? p.motivo}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { id: p.id_a, nome: p.nome_a, status: p.status_a, criado: p.criado_a, limpezas: p.limpezas_a, faturas: p.faturas_a },
                  { id: p.id_b, nome: p.nome_b, status: p.status_b, criado: p.criado_b, limpezas: p.limpezas_b, faturas: p.faturas_b },
                ].map((c) => (
                  <div key={c.id} className="rounded-card border border-brand-100 p-3">
                    <Link href={`/clientes/${c.id}`} className="font-semibold text-brand-900 hover:underline">
                      {c.nome}
                    </Link>
                    <p className="text-sm text-brand-800">
                      {c.status} · cadastrado em {data(c.criado)}
                    </p>
                    <p className="mt-1 text-sm text-brand-800">
                      {c.limpezas} limpeza(s) · {c.faturas} fatura(s)
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-card bg-brand-50 p-3">
                <p className="mb-3 font-medium text-brand-900">
                  Qual cadastro deve ficar? O outro é absorvido por ele.
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={mergeClientsAction}>
                    <input type="hidden" name="principal" value={p.id_a} />
                    <input type="hidden" name="duplicado" value={p.id_b} />
                    <button className="btn-primary" type="submit">
                      Manter “{p.nome_a}”
                    </button>
                  </form>
                  <form action={mergeClientsAction}>
                    <input type="hidden" name="principal" value={p.id_b} />
                    <input type="hidden" name="duplicado" value={p.id_a} />
                    <button className="btn-primary" type="submit">
                      Manter “{p.nome_b}”
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-sm text-brand-800">
                  Nada se perde: limpezas, faturas, orçamentos e ocorrências dos dois vão para o
                  cadastro escolhido, e os campos em branco são preenchidos com o que existir no
                  outro.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
