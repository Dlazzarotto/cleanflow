import LiveMap from '@/components/LiveMap';
import { requireManager } from '@/lib/auth';
import BackLink from '@/components/BackLink';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  await requireManager();
  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Mapa em tempo real</h1>
      <LiveMap />
    </div>
  );
}
