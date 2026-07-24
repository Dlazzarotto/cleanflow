import { BEDROOM_TASKS, BATHROOM_TASKS, EXTRA_ROOMS } from '@/lib/pricing';

/** Monta a lista legivel de servicos de um estimate salvo. */
export function buildServiceList(e: {
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  bedroom_tasks: string[];
  bathroom_tasks: string[];
  extras: Record<string, string[]>;
  laundry: boolean;
  laundry_loads: number;
  deep_clean: boolean;
}): { title: string; items: string[] }[] {
  const sections: { title: string; items: string[] }[] = [];

  if (e.bedrooms > 0) {
    sections.push({
      title: `Quartos (${e.bedrooms})`,
      items: BEDROOM_TASKS.filter((t) => e.bedroom_tasks?.includes(t.id)).map((t) => t.label),
    });
  }
  if (e.full_baths > 0) {
    sections.push({
      title: `Banheiros completos (${e.full_baths})`,
      items: BATHROOM_TASKS.filter((t) => e.bathroom_tasks?.includes(t.id)).map((t) => t.label),
    });
  }
  if (e.half_baths > 0) {
    sections.push({ title: `Lavabos (${e.half_baths})`, items: ['Limpeza completa'] });
  }
  for (const room of EXTRA_ROOMS) {
    const selected = e.extras?.[room.id];
    if (selected && selected.length > 0) {
      sections.push({
        title: room.label,
        items: room.tasks.filter((t) => selected.includes(t.id)).map((t) => t.label),
      });
    }
  }
  if (e.laundry) {
    sections.push({
      title: '🧺 Laundry',
      items: [`Lavar e dobrar roupa — até ${Math.max(e.laundry_loads, 1)} carga(s) por visita`],
    });
  }
  if (e.deep_clean) {
    sections.push({ title: '✨ Deep cleaning', items: ['Primeira limpeza em profundidade'] });
  }
  return sections;
}
