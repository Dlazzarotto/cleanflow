import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { requireMarketingAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateClientAction } from '@/lib/actions';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { PAYMENT_METHODS, CONTRACT_STATUS } from '@/lib/billing';
import type { Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const { role: myRole, userId: myId } = await requireMarketingAccess();
  const supabase = createClient();
  const { data } = await supabase.from('clients').select('*').eq('id', params.id).single();
  if (!data) notFound();
  if (myRole === 'marketing' && (data as any).created_by !== myId) redirect('/marketing');
  const c = data as Client;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Editar cliente</h1>
      <form action={updateClientAction.bind(null, c.id)} className="card space-y-4">
        <div>
          <label className="label" htmlFor="full_name">Nome completo *</label>
          <input className="input" id="full_name" name="full_name" required defaultValue={c.full_name} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefone</label>
            <input className="input" id="phone" name="phone" type="tel" defaultValue={c.phone ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" defaultValue={c.email ?? ''} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="address">Endereço</label>
          <AddressAutocomplete id="address" initialValue={c.address ?? ''} />
          <p className="mt-1 text-sm text-brand-800">
            {c.lat
              ? '✓ Coordenadas salvas — usadas em rotas, sugestões e mapa.'
              : '⚠️ Sem coordenadas. Escolha o endereço pela lista da busca para salvá-las.'}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="source">Origem</label>
          <input className="input" id="source" name="source" defaultValue={(c as any).source ?? ''} placeholder="Ex: indicação, Google, Instagram" />
        </div>
        <div>
          <label className="label" htmlFor="unit">Unidade / apartamento (se prédio)</label>
          <input className="input" id="unit" name="unit" defaultValue={c.unit ?? ''} placeholder="Ex: Apt 3B" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="door_code">Código da porta</label>
            <input className="input" id="door_code" name="door_code" defaultValue={c.door_code ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="frequency">Frequência</label>
            <select className="input" id="frequency" name="frequency" defaultValue={c.frequency ?? ''}>
              <option value="">Selecionar</option>
              <option value="unica">Única</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="language">Idioma do cliente (documentos e email)</label>
          <select className="input" id="language" name="language" defaultValue={(c as any).language ?? 'pt'}>
            <option value="pt">🇧🇷 Português</option>
            <option value="en">🇺🇸 English</option>
            <option value="es">🇪🇸 Español</option>
            <option value="fr">🇫🇷 Français</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="has_pets" name="has_pets" className="h-6 w-6 accent-brand-700" defaultChecked={c.has_pets} />
          <label htmlFor="has_pets" className="font-medium text-brand-800">Tem pets</label>
        </div>
        <div>
          <label className="label" htmlFor="pets_notes">Observações sobre pets</label>
          <input className="input" id="pets_notes" name="pets_notes" defaultValue={c.pets_notes ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="alarm_notes">Alarme</label>
          <input className="input" id="alarm_notes" name="alarm_notes" defaultValue={c.alarm_notes ?? ''} />
        </div>
        {myRole !== 'marketing' && (
          <div className="rounded-card bg-brand-50 p-4">
            <p className="mb-3 font-semibold text-brand-900">💵 Cobrança e contrato</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="payment_method">Forma de pagamento</label>
                <select className="input" id="payment_method" name="payment_method" defaultValue={(c as any).payment_method ?? ''}>
                  <option value="">Definir</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="default_price">Valor por limpeza (USD)</label>
                <input className="input" id="default_price" name="default_price" type="number" min={0} step={5} defaultValue={(c as any).default_price ?? ''} />
              </div>
              <div>
                <label className="label" htmlFor="contract_status">Contrato</label>
                <select className="input" id="contract_status" name="contract_status" defaultValue={(c as any).contract_status ?? 'pendente'}>
                  {CONTRACT_STATUS.map((x) => (
                    <option key={x.key} value={x.key}>{x.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mt-3 flex min-h-touch cursor-pointer items-center gap-3 font-medium text-brand-800">
              <input
                type="checkbox"
                name="sms_opt_in"
                className="h-5 w-5 accent-brand-700"
                defaultChecked={(c as any).sms_opt_in ?? true}
              />
              📱 Aceita receber lembretes e faturas por SMS
            </label>
            <div className="mt-3">
              <label className="label" htmlFor="payment_notes">Observações de pagamento</label>
              <input className="input" id="payment_notes" name="payment_notes" defaultValue={(c as any).payment_notes ?? ''} placeholder="Ex: Venmo @maria-silva · paga sempre no dia" />
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="preferences">Preferências de limpeza</label>
          <textarea className="input" id="preferences" name="preferences" rows={3} defaultValue={c.preferences ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="products_notes">Produtos</label>
          <input className="input" id="products_notes" name="products_notes" defaultValue={c.products_notes ?? ''} />
        </div>
        {myRole === 'marketing' ? (
          <input type="hidden" name="status" value={c.status} />
        ) : (
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={c.status}>
            <option value="lead">Lead</option>
            <option value="ativo">Ativo</option>
            <option value="em_espera">Em espera (estimate enviado, aguardando resposta)</option>
            <option value="inativo">Ex-cliente (já foi atendido e parou)</option>
            <option value="perdido">Não fechou (recebeu orçamento e não virou cliente)</option>
          </select>
          <p className="mt-1 text-sm text-brand-800">
            Para banir um cliente (deletado), use o botão 🚫 na ficha do cliente — exige motivo e
            confirmação de senha, e é restrito ao dono da empresa.
          </p>
        </div>
        )}
        <button className="btn-primary w-full" type="submit">Salvar alterações</button>
      </form>
    </div>
  );
}
