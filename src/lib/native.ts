/**
 * Detecta se o sistema está rodando dentro do app nativo (Capacitor).
 * No app, recursos de segundo plano funcionam; no navegador, não.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}
