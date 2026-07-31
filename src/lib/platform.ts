import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface PlatformContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  fullName: string;
  email: string;
}

/** Retorna o contexto se o usuario for administrador da PLATAFORMA (CleanFlow). */
export async function getPlatformAdmin(): Promise<PlatformContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('platform_admins')
    .select('full_name')
    .eq('user_id', user.id)
    .single();
  if (!data) return null;

  return {
    supabase,
    userId: user.id,
    fullName: data.full_name,
    email: user.email ?? '',
  };
}

export async function requirePlatformAdmin(): Promise<PlatformContext> {
  const ctx = await getPlatformAdmin();
  if (!ctx) redirect('/');
  return ctx;
}
