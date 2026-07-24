export const PERMISSION_KEYS = [
  { key: 'door_code', label: '🔑 Ver código das portas' },
  { key: 'alarm', label: '🚨 Ver instruções de alarme' },
  { key: 'preferences', label: '📝 Ver preferências e produtos' },
  { key: 'notes', label: '💬 Ver observações da limpeza' },
  { key: 'checkin', label: '✅ Fazer check-in/check-out' },
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number]['key'];
