'use client';
import { useEffect, useRef, useState } from 'react';
import { isNativeApp } from '@/lib/native';

/**
 * Mantém a tela ligada enquanto houver serviço em andamento.
 * Sem isso o celular apaga sozinho e o app para de acompanhar a posição.
 */
export default function KeepAwake({ ativo }: { ativo: boolean }) {
  const sentinel = useRef<any>(null);
  const [ligado, setLigado] = useState(false);
  const [suportado, setSuportado] = useState(true);

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setSuportado(false);
      return;
    }

    let cancelado = false;

    async function segurar() {
      try {
        sentinel.current = await (navigator as any).wakeLock.request('screen');
        if (!cancelado) setLigado(true);
        sentinel.current.addEventListener('release', () => setLigado(false));
      } catch {
        setLigado(false);
      }
    }

    async function soltar() {
      try {
        await sentinel.current?.release();
      } catch {
        // ignora
      }
      sentinel.current = null;
      setLigado(false);
    }

    if (ativo) {
      segurar();
      // Ao voltar para o app, pede de novo
      const aoVoltar = () => {
        if (document.visibilityState === 'visible' && ativo) segurar();
      };
      document.addEventListener('visibilitychange', aoVoltar);
      return () => {
        cancelado = true;
        document.removeEventListener('visibilitychange', aoVoltar);
        soltar();
      };
    }

    soltar();
    return () => {
      cancelado = true;
    };
  }, [ativo]);

  if (!ativo) return null;

  // No app instalado, o acompanhamento continua com o celular no bolso
  if (isNativeApp()) {
    return (
      <div className="mb-4 rounded-card bg-brand-50 p-3 text-sm text-brand-800">
        ✅ Pode guardar o celular — o app continua acompanhando o serviço.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-card bg-brand-50 p-3 text-sm text-brand-800">
      {ligado
        ? '🔆 A tela ficará ligada enquanto o serviço estiver em andamento.'
        : suportado
          ? '📱 Mantenha o app aberto durante o serviço para o registro funcionar.'
          : '📱 Mantenha o app aberto e a tela ligada durante o serviço.'}
    </div>
  );
}
