'use client';
import { useEffect } from 'react';

/** Registra o service worker que permite instalar o app. */
export default function ServiceWorkerSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sem service worker o sistema continua funcionando normalmente
    });
  }, []);
  return null;
}
