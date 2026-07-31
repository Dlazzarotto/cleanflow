import { redirect } from 'next/navigation';
import { getAuth, isManager } from '@/lib/auth';
import { getPlatformAdmin } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const platform = await getPlatformAdmin();

  try {
    const { role } = await getAuth();
    redirect(isManager(role) ? '/dashboard' : role === 'marketing' ? '/marketing' : '/minha-agenda');
  } catch (e) {
    if ((e as any)?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    // Sem vinculo com empresa: se for admin da plataforma, vai para o painel
    if (platform) redirect('/admin');
    redirect('/login');
  }
}
