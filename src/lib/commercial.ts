/** Segmentos de limpeza comercial. */
export const SEGMENTS = [
  { key: 'escritorio', label: '🏢 Escritório', icon: '🏢' },
  { key: 'restaurante', label: '🍽️ Restaurante / lanchonete', icon: '🍽️' },
  { key: 'loja', label: '🏪 Loja / comércio', icon: '🏪' },
  { key: 'galeria', label: '🖼️ Galeria / showroom', icon: '🖼️' },
  { key: 'supermercado', label: '🛒 Supermercado / mercado', icon: '🛒' },
  { key: 'academia', label: '🏋️ Academia', icon: '🏋️' },
  { key: 'clinica', label: '🏥 Clínica / consultório', icon: '🏥' },
  { key: 'condominio', label: '🏘️ Condomínio / prédio', icon: '🏘️' },
  { key: 'escola', label: '🎓 Escola / creche', icon: '🎓' },
  { key: 'fabrica', label: '🏭 Fábrica / galpão', icon: '🏭' },
  { key: 'hotel', label: '🏨 Hotel / pousada', icon: '🏨' },
  { key: 'igreja', label: '⛪ Igreja / templo', icon: '⛪' },
  { key: 'outro', label: '📦 Outro', icon: '📦' },
] as const;

export const SEGMENT_LABEL: Record<string, string> = Object.fromEntries(
  SEGMENTS.map((s) => [s.key, s.label])
);

export const SEGMENT_ICON: Record<string, string> = Object.fromEntries(
  SEGMENTS.map((s) => [s.key, s.icon])
);

export const CLIENT_TYPES = [
  { key: 'residencial', label: '🏠 Residencial' },
  { key: 'comercial', label: '🏢 Comercial' },
] as const;

export const BILLING_TYPES = [
  { key: 'por_limpeza', label: 'Por limpeza realizada' },
  { key: 'mensal_fixo', label: 'Contrato mensal fixo' },
] as const;

export const PAYMENT_TERMS = [
  { key: '', label: 'À vista / na entrega' },
  { key: 'net15', label: 'Net 15 — 15 dias' },
  { key: 'net30', label: 'Net 30 — 30 dias' },
  { key: 'net45', label: 'Net 45 — 45 dias' },
] as const;

export const PAYMENT_TERMS_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_TERMS.map((p) => [p.key, p.label])
);

/** Dias até o vencimento conforme o prazo contratado. */
export function termDays(term: string | null): number | null {
  if (!term) return null;
  const n = Number(term.replace('net', ''));
  return Number.isFinite(n) ? n : null;
}
