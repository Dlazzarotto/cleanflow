import { createClient } from '@/lib/supabase/server';

export type Modo = 'residencial' | 'comercial';

/** Modo ativo da pessoa: residencial ou comercial. */
export async function getModo(): Promise<Modo> {
  const supabase = createClient();
  const { data } = await supabase.rpc('current_mode');
  return data === 'comercial' ? 'comercial' : 'residencial';
}

/** A empresa contratou o módulo comercial? */
export async function temComercial(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.rpc('has_commercial');
  return Boolean(data);
}

/** Rótulos que mudam conforme o modo. */
export const ROTULOS: Record<Modo, Record<string, string>> = {
  residencial: {
    clientes: 'Clientes',
    cliente: 'cliente',
    novoCliente: 'Novo cliente',
    limpezas: 'Limpezas',
    limpeza: 'limpeza',
    estimates: 'Estimates',
    estimate: 'orçamento',
  },
  comercial: {
    clientes: 'Contratos',
    cliente: 'contrato',
    novoCliente: 'Novo contrato',
    limpezas: 'Serviços',
    limpeza: 'serviço',
    estimates: 'Propostas',
    estimate: 'proposta',
  },
};
