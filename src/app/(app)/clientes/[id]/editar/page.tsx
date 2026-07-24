import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateClientAction } from '@/lib/actions';
import type { Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  await requireManager();
  const supabase = createClient();
  const { data } = await supabase.from('clients').select('*').eq('id', params.id).single();
  if (!data) notFound();
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
          <input className="input" id="address" name="address" defaultValue={c.address ?? ''} />
          <p className="mt-1 text-sm text-brand-800">
            Para atualizar as coordenadas de rota, cadastre o endereço novo pela busca (em breve aqui também).
          </p>
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
        <div>
          <label className="label" htmlFor="preferences">Preferências de limpeza</label>
          <textarea className="input" id="preferences" name="preferences" rows={3} defaultValue={c.preferences ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="products_notes">Produtos</label>
          <input className="input" id="products_notes" name="products_notes" defaultValue={c.products_notes ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={c.status}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <button className="btn-primary w-full" type="submit">Salvar alterações</button>
      </form>
    </div>
  );
}
