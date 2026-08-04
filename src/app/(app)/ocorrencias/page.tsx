import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManager } from '@/lib/auth';
import { resolveIncidentAction, decideLockoutAction } from '@/lib/actions/incidents';
import { getPricingSettings } from '@/lib/actions/estimates';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  dano_pre_existente: '🔍 Dano pré-existente',
  incidente_limpeza: '⚠️ Incidente na limpeza',
  acesso: '🔑 Acesso',
  seguranca: '🚨 Segurança',
  equipamento: '🧰 Equipamento',
  outro: '📝 Outro',
};

const MOMENT_LABEL: Record<string, string> = {
  chegada: 'na chegada',
  durante: 'durante o serviço',
  saida: 'na saída',
};

const SEVERITY: Record<string, { label: string; cls: string }> = {
  baixa: { label: 'Baixa', cls: 'bg-brand-100 text-brand-900' },
  media: { label: 'Média', cls: 'bg-sun/30 text-brand-900' },
  alta: { label: 'Alta', cls: 'bg-red-700 text-white' },
};

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  resolvida: 'Resolvida ✓',
};

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireManager();
  const filtro = ['aberta', 'em_analise', 'resolvida', 'todas'].includes(searchParams.status ?? '')
    ? searchParams.status!
    : 'aberta';

  const supabase = createClient();
  let query = supabase
    .from('incidents')
    .select('*, clients(full_name, address), bookings(scheduled_at, lockout_status, status)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (filtro !== 'todas') query = query.eq('status', filtro);

  const [{ data }, { data: allRows }, settings] = await Promise.all([
    query,
    supabase.from('incidents').select('status'),
    getPricingSettings(),
  ]);
  const incidents = data ?? [];
  const countBy = (s: string) =>
    s === 'todas' ? (allRows ?? []).length : (allRows ?? []).filter((i: any) => i.status === s).length;

  // Links temporarios das fotos (bucket privado)
  const signed = new Map<string, string>();
  for (const inc of incidents as any[]) {
    for (const path of inc.photos ?? []) {
      const { data: url } = await supabase.storage.from('ocorrencias').createSignedUrl(path, 3600);
      if (url?.signedUrl) signed.set(path, url.signedUrl);
    }
  }

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="mb-2 text-3xl font-bold text-brand-900">⚠️ Ocorrências</h1>
      <p className="mb-6 text-brand-800">
        Registros feitos pela equipe em campo, com data, hora e autor. O relato original não pode ser
        alterado — serve como prova em caso de disputa com o cliente.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {['aberta', 'em_analise', 'resolvida', 'todas'].map((s) => (
          <Link
            key={s}
            href={`/ocorrencias?status=${s}`}
            className={`flex min-h-touch items-center rounded-card border px-4 py-2 font-medium ${
              filtro === s
                ? 'border-brand-700 bg-brand-900 text-white'
                : 'border-brand-100 bg-white text-brand-800'
            }`}
          >
            {s === 'todas' ? 'Todas' : STATUS_LABEL[s]} ({countBy(s)})
          </Link>
        ))}
      </div>

      {incidents.length === 0 ? (
        <div className="card text-brand-800">Nenhuma ocorrência neste filtro.</div>
      ) : (
        <div className="space-y-4">
          {(incidents as any[]).map((inc) => {
            const sev = SEVERITY[inc.severity] ?? SEVERITY.media;
            return (
              <div key={inc.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-brand-900">
                      {KIND_LABEL[inc.kind] ?? inc.kind}
                    </p>
                    <p className="text-brand-800">
                      {inc.clients?.full_name ?? 'Sem cliente vinculado'}
                      {inc.clients?.address ? ` · ${inc.clients.address}` : ''}
                    </p>
                    <p className="text-sm text-brand-800">
                      Reportado por <strong>{inc.reporter_name}</strong> {MOMENT_LABEL[inc.moment]} ·{' '}
                      {new Date(inc.created_at).toLocaleString('pt-BR')}
                      {inc.distance_m != null && (
                        <> · 📍 registrado a {inc.distance_m} m do endereço</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${sev.cls}`}>
                      {sev.label}
                    </span>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                      {STATUS_LABEL[inc.status]}
                    </span>
                  </div>
                </div>

                <p className="mt-3 rounded-card bg-brand-50 p-3">{inc.description}</p>

                {inc.bookings?.lockout_status === 'solicitado' && (
                  <div className="mt-3 rounded-card border-2 border-sun p-4">
                    <p className="font-semibold text-brand-900">
                      ⏳ A equipe está na porta e pede orientação
                    </p>
                    <p className="mt-1 text-brand-800">
                      Aprovar registra a visita como <strong>sem acesso</strong> e habilita a cobrança da
                      taxa de comparecimento de{' '}
                      {settings.lockout_fee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}{' '}
                      prevista em contrato. Recusar mantém o serviço em andamento (ex: cliente atendeu
                      e liberou a entrada).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={decideLockoutAction}>
                        <input type="hidden" name="booking_id" value={inc.booking_id} />
                        <input type="hidden" name="decision" value="aprovar" />
                        <button className="btn-primary" type="submit">
                          ✓ Aprovar sem acesso e taxa
                        </button>
                      </form>
                      <form action={decideLockoutAction}>
                        <input type="hidden" name="booking_id" value={inc.booking_id} />
                        <input type="hidden" name="decision" value="recusar" />
                        <button className="btn-ghost" type="submit">
                          Recusar — seguir com o serviço
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {inc.bookings?.lockout_status === 'aprovado' && (
                  <p className="mt-2 rounded-card bg-sun/20 p-3 text-brand-900">
                    ✓ Sem acesso aprovado — taxa de{' '}
                    {settings.lockout_fee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}{' '}
                    liberada para cobrança.
                  </p>
                )}

                {inc.kind === 'saida_automatica' && (
                  <p className="mt-2 rounded-card bg-brand-50 p-3 text-brand-900">
                    ⏱️ Encerramento automático — confirme com a equipe se o serviço foi realmente concluído.
                  </p>
                )}

                {(inc.photos ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inc.photos.map((p: string) => {
                      const url = signed.get(p);
                      if (!url) return null;
                      return (
                        <a key={p} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Foto da ocorrência"
                            className="h-28 w-28 rounded-card border border-brand-100 object-cover"
                          />
                        </a>
                      );
                    })}
                  </div>
                )}

                {inc.resolution_notes && (
                  <p className="mt-3 text-brand-800">
                    <strong>Tratativa:</strong> {inc.resolution_notes}
                    {inc.resolved_at &&
                      ` · ${new Date(inc.resolved_at).toLocaleDateString('pt-BR')}`}
                  </p>
                )}

                {inc.status !== 'resolvida' && (
                  <form action={resolveIncidentAction} className="mt-3 border-t border-brand-100 pt-3">
                    <input type="hidden" name="id" value={inc.id} />
                    <label className="label" htmlFor={`res-${inc.id}`}>Tratativa</label>
                    <textarea
                      className="input"
                      id={`res-${inc.id}`}
                      name="resolution_notes"
                      rows={2}
                      defaultValue={inc.resolution_notes ?? ''}
                      placeholder="Ex: cliente avisado por telefone e confirmou que o dano já existia"
                    />
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div>
                        <label className="label" htmlFor={`st-${inc.id}`}>Situação</label>
                        <select className="input !w-48" id={`st-${inc.id}`} name="status" defaultValue={inc.status}>
                          <option value="aberta">Aberta</option>
                          <option value="em_analise">Em análise</option>
                          <option value="resolvida">Resolvida</option>
                        </select>
                      </div>
                      <button className="btn-primary" type="submit">Salvar</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
