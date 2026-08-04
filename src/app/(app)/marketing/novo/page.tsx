import { requireMarketingAccess } from '@/lib/auth';
import { createLeadAction } from '@/lib/actions';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

const CANAIS = [
  'Instagram',
  'Facebook',
  'Google',
  'WhatsApp',
  'Site',
  'Indicação de cliente',
  'Panfleto / flyer',
  'Placa / carro adesivado',
  'Evento / feira',
  'Outro',
];

export default async function NovoLeadPage() {
  await requireMarketingAccess();

  return (
    <div className="max-w-2xl">
      <BackLink href="/marketing" label="Meus leads" />
      <h1 className="mb-1 mt-3 text-3xl font-bold text-brand-900">🌱 Cadastrar lead</h1>
      <p className="mb-6 text-brand-800">
        Registre o contato de quem demonstrou interesse. A gestão cuida do orçamento e do
        agendamento a partir daqui.
      </p>

      <form action={createLeadAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="full_name">Nome do cliente *</label>
          <input className="input" id="full_name" name="full_name" required autoComplete="off" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefone *</label>
            <input className="input" id="phone" name="phone" type="tel" required placeholder="(617) 555-0100" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">Endereço do imóvel</label>
          <AddressAutocomplete id="address" />
          <p className="mt-1 text-sm text-brand-800">
            Ajuda a gestão a montar a rota. Se ainda não souber, pode deixar em branco.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="source">De qual canal veio? *</label>
            <select className="input" id="source" name="source" required defaultValue="">
              <option value="" disabled>Selecionar canal</option>
              {CANAIS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">Idioma do cliente</label>
            <select className="input" id="language" name="language" defaultValue="pt">
              <option value="pt">🇧🇷 Português</option>
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="fr">🇫🇷 Français</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="preferences">O que o cliente pediu / anotações</label>
          <textarea
            className="input"
            id="preferences"
            name="preferences"
            rows={3}
            placeholder="Ex: casa de 3 quartos, quer limpeza quinzenal, prefere às sextas de manhã"
          />
        </div>

        <button className="btn-primary w-full" type="submit">Cadastrar lead</button>
      </form>
    </div>
  );
}
