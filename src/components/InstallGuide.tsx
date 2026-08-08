'use client';
import { useEffect, useState } from 'react';

type Aparelho = 'ios' | 'android' | 'desktop';

export default function InstallGuide({ companyName }: { companyName?: string }) {
  const [aparelho, setAparelho] = useState<Aparelho>('desktop');
  const [escolhido, setEscolhido] = useState<Aparelho | null>(null);
  const [evento, setEvento] = useState<any>(null);
  const [instalado, setInstalado] = useState(false);
  const [navegadorErrado, setNavegadorErrado] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ehIOS = /iphone|ipad|ipod/i.test(ua);
    const ehAndroid = /android/i.test(ua);
    setAparelho(ehIOS ? 'ios' : ehAndroid ? 'android' : 'desktop');

    setInstalado(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );

    // No iPhone, só o Safari permite instalar
    if (ehIOS) {
      const naoSafari = /crios|fxios|edgios|instagram|fban|fbav/i.test(ua);
      setNavegadorErrado(naoSafari);
    }

    function capturar(e: any) {
      e.preventDefault();
      setEvento(e);
    }
    window.addEventListener('beforeinstallprompt', capturar);
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  async function instalarAgora() {
    if (!evento) return;
    evento.prompt();
    const escolha = await evento.userChoice;
    if (escolha?.outcome === 'accepted') setInstalado(true);
    setEvento(null);
  }

  const mostrar = escolhido ?? aparelho;

  if (instalado) {
    return (
      <div className="rounded-card bg-white p-8 text-center">
        <p className="text-5xl">✅</p>
        <p className="mt-3 text-2xl font-bold text-brand-900">Já está instalado!</p>
        <p className="mt-2 text-brand-800">
          Você está usando o CleanFlow como aplicativo. Feche esta página e use o ícone na sua
          tela inicial.
        </p>
        <a href="/minha-agenda" className="btn-primary mt-5 inline-block">
          Ir para minha agenda
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Android: instalação de verdade em um clique */}
      {mostrar === 'android' && evento && (
        <div className="rounded-card bg-white p-6 text-center">
          <p className="text-2xl font-bold text-brand-900">Instalação rápida</p>
          <p className="mt-2 text-brand-800">
            Seu celular permite instalar com um toque. É só confirmar na janelinha que vai
            aparecer.
          </p>
          <button className="btn-primary mt-4 w-full" type="button" onClick={instalarAgora}>
            📲 Instalar CleanFlow
          </button>
        </div>
      )}

      {/* iPhone */}
      {mostrar === 'ios' && (
        <div className="rounded-card bg-white p-6">
          <p className="text-xl font-bold text-brand-900">📱 No iPhone ou iPad</p>

          {navegadorErrado && (
            <div className="mt-3 rounded-card bg-sun/20 p-3 text-brand-900">
              ⚠️ Você abriu por outro aplicativo. Para instalar, copie o endereço e abra no{' '}
              <strong>Safari</strong>.
            </div>
          )}

          <ol className="mt-4 space-y-4">
            {[
              {
                n: 1,
                t: 'Toque no botão de compartilhar',
                d: 'É o quadradinho com a seta para cima ⬆️, na barra de baixo do Safari.',
              },
              {
                n: 2,
                t: 'Deslize a lista para baixo',
                d: 'Procure a opção "Adicionar à Tela de Início".',
              },
              { n: 3, t: 'Toque em "Adicionar"', d: 'No canto superior direito da tela.' },
              {
                n: 4,
                t: 'Pronto!',
                d: 'O ícone do CleanFlow aparece junto com seus outros aplicativos.',
              },
            ].map((p) => (
              <li key={p.n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 font-bold text-white">
                  {p.n}
                </span>
                <span>
                  <span className="block font-semibold text-brand-900">{p.t}</span>
                  <span className="block text-sm text-brand-800">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Android manual */}
      {mostrar === 'android' && (
        <div className="rounded-card bg-white p-6">
          <p className="text-xl font-bold text-brand-900">🤖 No Android</p>
          <ol className="mt-4 space-y-4">
            {[
              {
                n: 1,
                t: 'Toque nos três pontinhos',
                d: 'No canto superior direito do Chrome (⋮).',
              },
              {
                n: 2,
                t: 'Escolha "Instalar aplicativo"',
                d: 'Em alguns aparelhos aparece como "Adicionar à tela inicial".',
              },
              { n: 3, t: 'Confirme', d: 'Toque em "Instalar" ou "Adicionar".' },
              {
                n: 4,
                t: 'Pronto!',
                d: 'O ícone do CleanFlow aparece junto com seus outros aplicativos.',
              },
            ].map((p) => (
              <li key={p.n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 font-bold text-white">
                  {p.n}
                </span>
                <span>
                  <span className="block font-semibold text-brand-900">{p.t}</span>
                  <span className="block text-sm text-brand-800">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Computador */}
      {mostrar === 'desktop' && (
        <div className="rounded-card bg-white p-6">
          <p className="text-xl font-bold text-brand-900">💻 Você está no computador</p>
          <p className="mt-2 text-brand-800">
            Para instalar no celular, abra este mesmo endereço no navegador do seu telefone:
          </p>
          <p className="mt-3 select-all rounded-card bg-brand-50 p-3 text-center font-mono text-brand-900">
            cleanflows.app/instalar
          </p>
          <p className="mt-3 text-sm text-brand-800">
            No computador você também pode instalar: procure o ícone de instalação na barra de
            endereço do Chrome ou Edge.
          </p>
        </div>
      )}

      {/* Trocar de aparelho */}
      <div className="rounded-card bg-white/10 p-4 text-center">
        <p className="mb-2 text-sm text-brand-100">Instruções para outro aparelho:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {(
            [
              ['ios', '📱 iPhone'],
              ['android', '🤖 Android'],
              ['desktop', '💻 Computador'],
            ] as Array<[Aparelho, string]>
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setEscolhido(chave)}
              className={`min-h-touch rounded-card border px-4 py-2 font-medium ${
                mostrar === chave
                  ? 'border-aqua-400 bg-aqua-400 text-brand-900'
                  : 'border-brand-100/40 text-brand-100'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
