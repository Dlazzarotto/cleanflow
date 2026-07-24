import { BEDROOM_TASKS, BATHROOM_TASKS, EXTRA_ROOMS } from '@/lib/pricing';
import { SERVICE_I18N, normalizeLang, type DocLang } from '@/lib/i18n/documents';

/** Monta a lista legivel de servicos de um estimate salvo, no idioma pedido. */
export function buildServiceList(
  e: {
    bedrooms: number;
    full_baths: number;
    half_baths: number;
    bedroom_tasks: string[];
    bathroom_tasks: string[];
    extras: Record<string, string[]>;
    laundry: boolean;
    laundry_loads: number;
    deep_clean: boolean;
  },
  lang?: string
): { title: string; items: string[] }[] {
  const L: DocLang = normalizeLang(lang);
  const t = SERVICE_I18N[L];
  const sections: { title: string; items: string[] }[] = [];

  if (e.bedrooms > 0) {
    sections.push({
      title: t.bedrooms(e.bedrooms),
      items: BEDROOM_TASKS.filter((x) => e.bedroom_tasks?.includes(x.id)).map(
        (x) => t.tasks[`bed.${x.id}`] ?? x.label
      ),
    });
  }
  if (e.full_baths > 0) {
    sections.push({
      title: t.fullBaths(e.full_baths),
      items: BATHROOM_TASKS.filter((x) => e.bathroom_tasks?.includes(x.id)).map(
        (x) => t.tasks[`bath.${x.id}`] ?? x.label
      ),
    });
  }
  if (e.half_baths > 0) {
    sections.push({ title: t.halfBaths(e.half_baths), items: [t.halfBathItem] });
  }
  for (const room of EXTRA_ROOMS) {
    const selected = e.extras?.[room.id];
    if (selected && selected.length > 0) {
      sections.push({
        title: t.rooms[room.id] ?? room.label,
        items: room.tasks
          .filter((x) => selected.includes(x.id))
          .map((x) => t.tasks[`${room.id}.${x.id}`] ?? x.label),
      });
    }
  }
  if (e.laundry) {
    sections.push({ title: t.laundryTitle, items: [t.laundryItem(Math.max(e.laundry_loads, 1))] });
  }
  if (e.deep_clean) {
    sections.push({ title: t.deepTitle, items: [t.deepItem] });
  }
  return sections;
}
