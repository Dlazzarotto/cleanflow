import AddressAutocomplete from '@/components/AddressAutocomplete';
import { createClientAction } from '@/lib/actions';

export default function NovoClientePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Novo cliente</h1>
      <form action={createClientAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="full_name">Nome completo *</label>
          <input className="input" id="full_name" name="full_name" required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefone</label>
            <input className="input" id="phone" name="phone" type="tel" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="address">Endereço</label>
          <AddressAutocomplete />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="door_code">Código da porta</label>
            <input className="input" id="door_code" name="door_code" />
          </div>
          <div>
            <label className="label" htmlFor="frequency">Frequência</label>
            <select className="input" id="frequency" name="frequency" defaultValue="">
              <option value="">Selecionar</option>
              <option value="unica">Única</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="has_pets" name="has_pets" className="h-6 w-6 accent-brand-700" />
          <label htmlFor="has_pets" className="font-medium text-brand-800">Tem pets</label>
        </div>
        <div>
          <label className="label" htmlFor="pets_notes">Observações sobre pets</label>
          <input className="input" id="pets_notes" name="pets_notes" placeholder="Ex: cachorro fica solto" />
        </div>
        <div>
          <label className="label" htmlFor="alarm_notes">Alarme</label>
          <input className="input" id="alarm_notes" name="alarm_notes" placeholder="Ex: código 1234, desativar na entrada" />
        </div>
        <div>
          <label className="label" htmlFor="preferences">Preferências de limpeza</label>
          <textarea className="input" id="preferences" name="preferences" rows={3}
            placeholder="Ex: aspirar primeiro; não limpar o escritório" />
        </div>
        <div>
          <label className="label" htmlFor="products_notes">Produtos</label>
          <input className="input" id="products_notes" name="products_notes" placeholder="Ex: produto sem perfume" />
        </div>
        <button className="btn-primary w-full" type="submit">Salvar cliente</button>
      </form>
    </div>
  );
}
