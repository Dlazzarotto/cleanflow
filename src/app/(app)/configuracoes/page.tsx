import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';
import { updateMyNameAction, saveLocaleAction, updateCompanyAction } from '@/lib/actions';
import PasswordForm from '@/components/PasswordForm';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import Link from 'next/link';
import { planName, maxTeams, monthlyFee } from '@/lib/plans';
import EmailDiagnostic from '@/components/EmailDiagnostic';
import ReminderPanel from '@/components/ReminderPanel';
import SmsDiagnostic from '@/components/SmsDiagnostic';
import { saveReminderSettingsAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const LOCALES = [
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
];

export default async function ConfiguracoesPage() {
  const { supabase, userId, companyId, role, fullName } = await getAuth();
  const manager = isManager(role);

  const [{ data: settings }, { data: company }, { data: authUser }, { data: msgSettings }] = await Promise.all([
    supabase.from('user_settings').select('locale').eq('user_id', userId).single(),
    manager
      ? supabase.from('companies').select('name, phone, email, address, lat, lng, plan, extra_teams, monthly_fee, account_status, next_due_date, payment_instructions').eq('id', companyId).single()
      : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
    manager
      ? supabase.from('pricing_settings').select('reminder_enabled, reminder_extra_note, reminder_channel').eq('company_id', companyId).single()
      : Promise.resolve({ data: null }),
  ]);

  const locale = (settings as any)?.locale ?? 'pt';
  const email = authUser?.user?.email ?? '';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-brand-900">⚙️ Configurações</h1>

      {/* Minha conta */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-900">Minha conta</h2>
        <p className="text-brand-800">Login: <strong>{email}</strong></p>
        <form action={updateMyNameAction} className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <label className="label" htmlFor="full_name">Meu nome</label>
            <input className="input" id="full_name" name="full_name" required defaultValue={fullName} />
          </div>
          <button className="btn-ghost" type="submit">Salvar nome</button>
        </form>
        <div className="border-t border-brand-100 pt-4">
          <p className="mb-3 font-semibold text-brand-800">Trocar senha</p>
          <PasswordForm />
        </div>
      </div>

      {/* Idioma */}
      <div className="card space-y-3">
        <h2 className="text-xl font-semibold text-brand-900">Idioma da interface</h2>
        <p className="text-brand-800">
          Preferência do seu usuário. A tradução completa das telas está sendo implantada
          progressivamente — os documentos enviados aos clientes já seguem o idioma de cada cliente.
        </p>
        <form action={saveLocaleAction} className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <label className="label" htmlFor="locale">Idioma</label>
            <select className="input" id="locale" name="locale" defaultValue={locale}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <button className="btn-ghost" type="submit">Salvar idioma</button>
        </form>
      </div>

      {manager && (
        <div className="card space-y-3">
          <h2 className="text-xl font-semibold text-brand-900">📨 Mensagens automáticas ao cliente</h2>
          <div className="rounded-card bg-brand-50 p-4 text-brand-800">
            <p><strong>Lembrete de véspera</strong> — enviado automaticamente todos os dias por mensagem de texto, sem precisar de nenhuma ação, para os clientes com limpeza no dia seguinte. Informa apenas a data, sem horário de chegada.</p>
            <p className="mt-2"><strong>Conclusão + fatura</strong> — enviada por SMS quando a equipe faz o check-out, com o link para o cliente ver e pagar.</p>
            <p className="mt-2 text-sm">Se o cliente não tiver telefone, ou o SMS falhar, o sistema envia por email automaticamente.</p>
          </div>

          <form action={saveReminderSettingsAction} className="space-y-3">
            <input type="hidden" name="reminder_enabled" value="on" />
            <div>
              <label className="label" htmlFor="reminder_channel">Como enviar</label>
              <select
                className="input"
                id="reminder_channel"
                name="reminder_channel"
                defaultValue={(msgSettings as any)?.reminder_channel ?? 'sms'}
              >
                <option value="sms">📱 Mensagem de texto (SMS)</option>
                <option value="ambos">📱 + ✉️ SMS e email</option>
                <option value="email">✉️ Somente email</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reminder_extra_note">
                Recado extra no lembrete (opcional)
              </label>
              <input
                className="input"
                id="reminder_extra_note"
                name="reminder_extra_note"
                defaultValue={(msgSettings as any)?.reminder_extra_note ?? ''}
                placeholder="Ex: nesta semana chegaremos 30 minutos mais tarde por causa do feriado"
              />
            </div>
            <button className="btn-ghost" type="submit">Salvar preferências</button>
          </form>

          <ReminderPanel />
        </div>
      )}

      {manager && <SmsDiagnostic />}

      {manager && <EmailDiagnostic />}

      {/* Assinatura */}
      {manager && company && (
        <div className="card space-y-2">
          <h2 className="text-xl font-semibold text-brand-900">Assinatura CleanFlow</h2>
          <p className="text-brand-800">
            Plano <strong>{planName((company as any).plan)}</strong> ·{' '}
            até {maxTeams((company as any).plan, (company as any).extra_teams ?? 0)} equipe(s) ·{' '}
            US$ {Number((company as any).monthly_fee ?? monthlyFee((company as any).plan, (company as any).extra_teams ?? 0)).toFixed(2)}/mês
          </p>
          {(company as any).next_due_date && (
            <p className="text-brand-800">
              Próximo vencimento: {new Date((company as any).next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
          <p className="text-sm text-brand-800">
            Para mudar de plano ou tirar dúvidas sobre a assinatura, fale com o suporte do CleanFlow.{' '}
            <Link href="/termos" className="font-semibold text-brand-700 underline">
              Ver contrato de assinatura
            </Link>
          </p>
        </div>
      )}

      {/* Empresa (gestao) */}
      {manager && company && (
        <div className="card space-y-3">
          <h2 className="text-xl font-semibold text-brand-900">Dados da empresa</h2>
          <p className="text-brand-800">
            Usados no documento do estimate, no contrato e nos emails enviados aos clientes.
          </p>
          <form action={updateCompanyAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="company-name">Nome da empresa</label>
              <input className="input" id="company-name" name="name" required defaultValue={(company as any).name ?? ''} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="company-phone">Telefone</label>
                <input className="input" id="company-phone" name="phone" type="tel" defaultValue={(company as any).phone ?? ''} />
              </div>
              <div>
                <label className="label" htmlFor="company-email">Email</label>
                <input className="input" id="company-email" name="email" type="email" defaultValue={(company as any).email ?? ''} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="payment_instructions">
                Instruções de pagamento (aparecem na fatura do cliente)
              </label>
              <textarea
                className="input"
                id="payment_instructions"
                name="payment_instructions"
                rows={4}
                defaultValue={(company as any).payment_instructions ?? ''}
                placeholder={'Ex:\nZelle: 617-555-0100 (Wait Happy Cleaning)\nVenmo: @waithappy\nCheque nominal a Wait Happy Cleaning Services Inc'}
              />
            </div>
            <div>
              <label className="label" htmlFor="company-address">Endereço da sede</label>
              <AddressAutocomplete id="company-address" initialValue={(company as any).address ?? ''} />
              <p className="mt-1 text-sm text-brand-800">
                Escolha pelo resultado da busca para salvar as coordenadas — usadas nas rotas e no mapa.
                {(company as any).lat ? ' ✓ Coordenadas da sede salvas.' : ' ⚠️ Sede ainda sem coordenadas.'}
              </p>
            </div>
            <button className="btn-primary" type="submit">Salvar dados da empresa</button>
          </form>
        </div>
      )}
    </div>
  );
}
