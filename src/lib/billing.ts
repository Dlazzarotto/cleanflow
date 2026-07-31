/** Formas de pagamento aceitas pelas empresas de limpeza. */
export const PAYMENT_METHODS = [
  { key: 'zelle', label: 'Zelle' },
  { key: 'venmo', label: 'Venmo' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao', label: 'Cartão (na hora)' },
  { key: 'stripe', label: 'Link de pagamento (Stripe)' },
  { key: 'transferencia', label: 'Transferência / ACH' },
  { key: 'outro', label: 'Outro' },
] as const;

export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.key, m.label])
);

export const CONTRACT_STATUS = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'enviado', label: 'Enviado, aguardando assinatura' },
  { key: 'assinado', label: 'Assinado' },
  { key: 'dispensado', label: 'Dispensado (cliente antigo)' },
] as const;

export const CONTRACT_LABEL: Record<string, string> = Object.fromEntries(
  CONTRACT_STATUS.map((c) => [c.key, c.label])
);
