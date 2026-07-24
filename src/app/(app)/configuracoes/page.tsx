import { createClient } from '@/lib/supabase/server';
import { getAuth, isManager } from '@/lib/auth';
import { updateMyNameAction, saveLocaleAction, updateCompanyAction } from '@/lib/actions';
import PasswordForm from '@/components/PasswordForm';

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

  const [{ data: settings }, { data: company }, { data: authUser }] = await Promise.all([
    supabase.from('user_settings').select('locale').eq('user_id', userId).single(),
    manager
      ? supabase.from('companies').select('name, phone, email, address').eq('id', companyId).single()
      : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
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
              <label className="label" htmlFor="company-address">Endereço</label>
              <input className="input" id="company-address" name="address" defaultValue={(company as any).address ?? ''} />
            </div>
            <button className="btn-primary" type="submit">Salvar dados da empresa</button>
          </form>
        </div>
      )}
    </div>
  );
}
