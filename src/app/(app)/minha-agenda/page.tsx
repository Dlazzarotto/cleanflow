import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { STATUS_LABEL, type BookingStatus } from '@/lib/types';
import CheckinButton from '@/components/CheckinButton';
import ArrivalWatcher from '@/components/ArrivalWatcher';
import LocationReporter from '@/components/LocationReporter';
import IncidentForm from '@/components/IncidentForm';
import AutoCloseWatcher from '@/components/AutoCloseWatcher';
import DayControl from '@/components/DayControl';
import ExtraServiceForm from '@/components/ExtraServiceForm';
import KeepAwake from '@/components/KeepAwake';
import InstallPrompt from '@/components/InstallPrompt';

export const dynamic = 'force-dynamic';

interface AgendaItem {
  id: string;
  client_id?: string | null;
  lockout_status?: string | null;
  service_type?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: BookingStatus;
  notes: string | null;
  client_name: string;
  address: string | null;
  door_code: string | null;
  has_pets: boolean;
  pets_notes: string | null;
  alarm_notes: string | null;
  preferences: string | null;
  products_notes: string | null;
  team_name: string | null;
  team_color: string | null;
  lat: number | null;
  lng: number | null;
  unit: string | null;
}

const NEXT_STATUS: Partial<Record<BookingStatus, { to: string; label: string }>> = {
  agendado: { to: 'a_caminho', label: '🚗 A caminho' },
  a_caminho: { to: 'em_andamento', label: '▶️ Check-in' },
  em_andamento: { to: 'concluido', label: '✅ Check-out' },
};

const SEM_ACESSO_AVISO =
  'Registrado como sem acesso. O escritório foi notificado e vai falar com o cliente.';

export default async function MinhaAgendaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Time de marketing nao trabalha em campo
  const { role } = await getAuth();
  if (role === 'marketing') redirect('/marketing');

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400000);

  // Visao segura: apenas limpezas das equipes do usuario, sem valores
  const { data: companyId } = await supabase.rpc('current_company_id');

  // Visão sem valores: a equipe escolhe o serviço, nunca vê preço
  const { data: catalogRows } = await supabase
    .from('team_service_extras')
    .select('id, name')
    .order('name');
  const catalog = (catalogRows ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  const { data: openShiftId } = await supabase.rpc('my_open_shift');
  const { data: openShift } = openShiftId
    ? await supabase.from('work_shifts').select('started_at').eq('id', openShiftId as string).single()
    : { data: null };

  const { data } = await supabase
    .from('team_agenda')
    .select('*')
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .order('scheduled_at');

  const items = (data ?? []) as AgendaItem[];

  const byDay = new Map<string, AgendaItem[]>();
  for (const b of items) {
    const key = new Date(b.scheduled_at).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });
    const arr = byDay.get(key) ?? [];
    arr.push(b);
    byDay.set(key, arr);
  }

  const arrivalTargets = items
    .filter((b) => b.lat && b.lng && (b.status === 'agendado' || b.status === 'a_caminho'))
    .map((b) => ({ id: b.id, name: b.client_name, lat: b.lat!, lng: b.lng!, status: b.status }));

  return (
    <div className="mx-auto max-w-2xl">
      <InstallPrompt />
      <KeepAwake ativo={items.some((b) => b.status === 'em_andamento')} />
      <LocationReporter />
      <AutoCloseWatcher
        active={items
          .filter((b) => b.status === 'em_andamento' && b.lat != null && b.lng != null)
          .map((b) => ({
            id: b.id,
            clientId: b.client_id ?? null,
            name: b.client_name,
            lat: b.lat as number,
            lng: b.lng as number,
          }))}
      />
      <ArrivalWatcher targets={arrivalTargets} />
      <h1 className="mb-4 text-3xl font-bold text-brand-900">Minha agenda</h1>

      {items
        .filter((b) => {
          if (b.status !== 'em_andamento') return false;
          const inicio = new Date(b.scheduled_at).getTime();
          return Date.now() - inicio > (b.duration_minutes + 60) * 60000;
        })
        .map((b) => (
          <div key={`aviso-${b.id}`} className="mb-4 rounded-card border-2 border-sun bg-white p-4">
            <p className="font-semibold text-brand-900">
              ⏰ A limpeza de {b.client_name} continua em andamento
            </p>
            <p className="mt-1 text-sm text-brand-800">
              Já passou do tempo previsto. Se você terminou, faça o check-out — a fatura só é gerada
              depois disso.
            </p>
          </div>
        ))}

      <DayControl
        openShift={openShift as { started_at: string } | null}
        pendingCount={
          items.filter((b) => {
            const hoje = new Date().toDateString();
            return (
              new Date(b.scheduled_at).toDateString() === hoje &&
              b.status !== 'concluido' &&
              b.status !== 'sem_acesso'
            );
          }).length
        }
      />

      {items.length === 0 && (
        <div className="card text-brand-800">
          Nenhuma limpeza nos próximos 7 dias. Se você acabou de receber o acesso,
          peça ao administrador para colocar você numa equipe.
        </div>
      )}

      {Array.from(byDay.entries()).map(([day, list]) => (
        <div key={day} className="mb-6">
          <h2 className="mb-2 text-xl font-semibold capitalize text-brand-900">{day}</h2>
          <div className="space-y-3">
            {list.map((b) => {
              const next = NEXT_STATUS[b.status];
              return (
                <div key={b.id} className="card" style={b.team_color ? { borderLeft: `6px solid ${b.team_color}` } : undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xl font-bold">
                      {new Date(b.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                      — {b.client_name}
                      {b.unit && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-base font-semibold text-brand-900">🚪 {b.unit}</span>}
                    </p>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900">
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  <p className="text-sm text-brand-800">
                    Duração prevista: {Math.floor(b.duration_minutes / 60)}h{b.duration_minutes % 60 > 0 ? ` ${b.duration_minutes % 60}min` : ''}
                    {b.team_name ? ` · ${b.team_name}` : ''}
                  </p>
                  {b.service_type && b.service_type !== 'manutencao' && (
                    <p className="mt-2 rounded-card bg-sun/20 p-2 font-medium text-brand-900">
                      ✨ {b.service_type === 'primeira'
                        ? 'Primeira limpeza — profunda, leva mais tempo'
                        : b.service_type === 'pos_obra'
                          ? 'Limpeza pós-obra'
                          : b.service_type === 'mudanca'
                            ? 'Limpeza de mudança'
                            : 'Limpeza profunda (deep cleaning)'}
                    </p>
                  )}
                  {b.address && (
                    <p className="mt-1">
                      📍{' '}
                      <a
                        className="font-medium text-brand-700 underline"
                        href={`https://maps.google.com/?q=${encodeURIComponent(b.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {b.address}
                      </a>
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-brand-800">
                    {b.door_code && <p>🔑 Código da porta: <strong>{b.door_code}</strong></p>}
                    {b.alarm_notes && <p>🚨 Alarme: {b.alarm_notes}</p>}
                    {b.has_pets && <p>🐾 Pets: {b.pets_notes ?? 'Sim'}</p>}
                    {b.preferences && <p>📝 Preferências: {b.preferences}</p>}
                    {b.products_notes && <p>🧴 Produtos: {b.products_notes}</p>}
                    {b.notes && <p>💬 Observações: {b.notes}</p>}
                  </div>
                  {b.lockout_status === 'solicitado' && b.status === 'em_andamento' && (
                    <p className="mt-3 rounded-card bg-sun/20 p-3 text-brand-900">
                      ⏳ Aviso enviado ao escritório. Aguarde a orientação antes de sair.
                    </p>
                  )}
                  {b.lockout_status === 'recusado' && (
                    <p className="mt-3 rounded-card bg-brand-50 p-3 text-brand-900">
                      O escritório pediu para seguir com o serviço. Fale com a supervisão em caso de dúvida.
                    </p>
                  )}
                  {b.status === 'sem_acesso' && (
                    <p className="mt-3 rounded-card bg-sun/20 p-3 text-brand-900">🚪 {SEM_ACESSO_AVISO}</p>
                  )}
                  {next && !openShift && (
                    <p className="mt-3 rounded-card bg-brand-50 p-3 text-brand-800">
                      ▶️ Inicie seu dia acima para registrar chegada e conclusão.
                    </p>
                  )}
                  {next && openShift && (
                    <div className="mt-3">
                      <CheckinButton
                        bookingId={b.id}
                        to={next.to}
                        label={next.label}
                        clientLat={b.lat}
                        clientLng={b.lng}
                      />
                    </div>
                  )}
                  {openShift && b.status === 'em_andamento' && (
                    <ExtraServiceForm bookingId={b.id} catalog={catalog} />
                  )}
                  {companyId && openShift && (
                    <IncidentForm
                      bookingId={b.id}
                      clientId={b.client_id ?? null}
                      companyId={companyId as string}
                      clientName={b.client_name}
                      clientLat={b.lat}
                      clientLng={b.lng}
                      canLockout={b.status === 'em_andamento'}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
