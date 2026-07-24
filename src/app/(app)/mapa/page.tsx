import LiveMap from '@/components/LiveMap';
import { requireManager } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  await requireManager();
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-brand-900">Mapa em tempo real</h1>
      <LiveMap />
    </div>
  );
}
