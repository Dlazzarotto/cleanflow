import { redirect } from 'next/navigation';
import { isAdmin, isManager, isMarketing, isField, roleKey, roleLabel, type Role } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

export interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  companyId: string;
  role: Role;
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
    role: roleKey(membership?.role),
    fullName: membership?.full_name ?? '',
  };
}

// Papeis vivem em um lugar so: src/lib/roles.ts. Reexportado aqui porque
// meia tela do app ja importa isManager/isMarketing de '@/lib/auth'.
export { isAdmin, isManager, isMarketing, isField, roleKey, roleLabel };

/** Telas do funil comercial: gestão + time de marketing. */
export async function requireMarketingAccess(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!isManager(ctx.role) && !isMarketing(ctx.role)) redirect('/minha-agenda');
  return ctx;
}


/** Garante papel de gestao; equipe e redirecionada para a Minha agenda. */
export async function requireManager(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!isManager(ctx.role)) redirect('/minha-agenda');
  return ctx;
}
