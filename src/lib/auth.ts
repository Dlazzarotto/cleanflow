import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  companyId: string;
  role: 'owner' | 'admin' | 'supervisor' | 'cleaner';
  fullName: string;
}

/** Contexto autenticado: usuario, empresa ativa e papel na empresa. */
export async function getAuth(): Promise<AuthContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: companyId } = await supabase.rpc('current_company_id');
  if (!companyId) {
    throw new Error('Usuário sem vínculo ativo com nenhuma empresa.');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, full_name')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  return {
    supabase,
    userId: user.id,
    companyId: companyId as string,
    role: (membership?.role ?? 'cleaner') as AuthContext['role'],
    fullName: membership?.full_name ?? '',
  };
}

export function isManager(role: string) {
  return role === 'owner' || role === 'admin' || role === 'supervisor';
}


/** Garante papel de gestao; equipe e redirecionada para a Minha agenda. */
export async function requireManager(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!isManager(ctx.role)) redirect('/minha-agenda');
  return ctx;
}
