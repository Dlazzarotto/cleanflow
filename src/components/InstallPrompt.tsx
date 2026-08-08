'use client';
import { useEffect, useState } from 'react';
import { isNativeApp } from '@/lib/native';

/**
 * Convida a instalar o CleanFlow na tela inicial do celular.
 * Instalado, o app abre em tela cheia e fica mais estável em campo.
 */
export default function InstallPrompt() {
  const [evento, setEvento] = useState<any>(null);
  const [iOS, setIOS] = useState(false);
  const [instalado, setInstalado] = useState(true);
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    const jaInstalado =
      isNativeApp() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setInstalado(jaInstalado);
    setDispensado(localStorage.getItem('cf_install_dispensado') === '1');

    const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIOS(ehIOS);

    function capturar(e: any) {
      e.preventDefault();
      setEvento(e);
    }
    window.addEventListener('beforeinstallprompt', capturar);
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  if (instalado || dispensado) return null;
  if (!evento && !iOS) return null;

  function dispensar() {
    localStorage.setItem('cf_install_dispensado', '1');
    setDispensado(true);
  }

  async function instalar() {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    setEvento(null);
    dispensar();
  }

  return (
    <div className="mb-4 rounded-card border-2 border-aqua-500 bg-white p-4">
      <p className="font-semibold text-brand-900">📲 Instale o CleanFlow no seu celular</p>
      <p className="mt-1 text-sm text-brand-800">
        {iOS
          ? 'Toque no botão de compartilhar do Safari e escolha "Adicionar à Tela de Início". O app abre em tela cheia e funciona melhor durante o trabalho.'
          : 'Fica com ícone próprio, abre em tela cheia e funciona melhor durante o trabalho.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {evento && (
          <button className="btn-primary" type="button" onClick={instalar}>
            Instalar agora
          </button>
        )}
        <a className="btn-ghost" href="/instalar">
          Como instalar
        </a>
        <button className="btn-ghost" type="button" onClick={dispensar}>
          Agora não
        </button>
      </div>
    </div>
  );
}
