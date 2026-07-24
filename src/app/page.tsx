import { redirect } from 'next/navigation';
import { getAuth, isManager } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const { role } = await getAuth();
    redirect(isManager(role) ? '/dashboard' : '/minha-agenda');
  } catch (e) {
    // redirect() lanca internamente; so cai aqui em erro real de vinculo
    if ((e as any)?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    redirect('/login');
  }
}
