'use client';
import { useEffect, useRef, useState } from 'react';

export interface ParedeMedida {
  id: string;
  nome: string;
  metros: number;
  pes: number;
}

type Suporte = 'verificando' | 'disponivel' | 'ios' | 'sem_suporte' | 'sem_camera';

/**
 * Medição por câmera (realidade aumentada).
 * Funciona em celulares Android com Chrome. No iPhone e iPad o navegador
 * não dá acesso à AR — nesses aparelhos usamos o app Medida da Apple.
 */
export default function CameraMeasure({
  aberto,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: (paredes: ParedeMedida[]) => void;
}) {
  const [suporte, setSuporte] = useState<Suporte>('verificando');
  const [medindo, setMedindo] = useState(false);
  const [paredes, setParedes] = useState<ParedeMedida[]>([]);
  const [distanciaAtual, setDistanciaAtual] = useState<number | null>(null);
  const [pontos, setPontos] = useState(0);
  const [erro, setErro] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessaoRef = useRef<any>(null);
  const primeiroPontoRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!aberto) return;

    const ua = navigator.userAgent;
    const ehIOS = /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

    if (ehIOS) {
      setSuporte('ios');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSuporte('sem_camera');
      return;
    }

    const xr = (navigator as any).xr;
    if (!xr?.isSessionSupported) {
      setSuporte('sem_suporte');
      return;
    }

    xr.isSessionSupported('immersive-ar')
      .then((ok: boolean) => setSuporte(ok ? 'disponivel' : 'sem_suporte'))
      .catch(() => setSuporte('sem_suporte'));
  }, [aberto]);

  async function iniciarMedicao() {
    setErro('');
    try {
      const xr = (navigator as any).xr;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext('webgl', { xrCompatible: true });
      if (!gl) {
        setErro('Não foi possível iniciar a câmera 3D neste aparelho.');
        return;
      }

      const sessao = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'local-floor'],
      });
      sessaoRef.current = sessao;
      setMedindo(true);
      setPontos(0);
      primeiroPontoRef.current = null;

      await sessao.updateRenderState({
        baseLayer: new (window as any).XRWebGLLayer(sessao, gl),
      });

      const espacoLocal = await sessao.requestReferenceSpace('local-floor');
      const espacoVisor = await sessao.requestReferenceSpace('viewer');
      const fonteHit = await sessao.requestHitTestSource({ space: espacoVisor });

      let ultimoHit: Float32Array | null = null;

      const aoTocar = () => {
        if (!ultimoHit) return;
        if (!primeiroPontoRef.current) {
          primeiroPontoRef.current = ultimoHit.slice() as Float32Array;
          setPontos(1);
          return;
        }
        const a = primeiroPontoRef.current;
        const b = ultimoHit;
        const metros = Math.sqrt(
          (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
        );
        setParedes((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            nome: `Parede ${prev.length + 1}`,
            metros: Number(metros.toFixed(2)),
            pes: Number((metros * 3.28084).toFixed(2)),
          },
        ]);
        primeiroPontoRef.current = null;
        setPontos(0);
        setDistanciaAtual(null);
      };

      sessao.addEventListener('select', aoTocar);
      sessao.addEventListener('end', () => {
        setMedindo(false);
        sessaoRef.current = null;
      });

      const quadro = (_t: number, frame: any) => {
        if (!sessaoRef.current) return;
        sessao.requestAnimationFrame(quadro);

        const resultados = frame.getHitTestResults(fonteHit);
        if (resultados.length > 0) {
          const pose = resultados[0].getPose(espacoLocal);
          if (pose) {
            const p = pose.transform.position;
            ultimoHit = new Float32Array([p.x, p.y, p.z]);

            if (primeiroPontoRef.current) {
              const a = primeiroPontoRef.current;
              const d = Math.sqrt(
                (a[0] - p.x) ** 2 + (a[1] - p.y) ** 2 + (a[2] - p.z) ** 2
              );
              setDistanciaAtual(Number(d.toFixed(2)));
            }
          }
        }
      };

      sessao.requestAnimationFrame(quadro);
    } catch (e: any) {
      setErro(
        e?.name === 'NotAllowedError'
          ? 'Você precisa permitir o uso da câmera para medir.'
          : 'Não foi possível iniciar a medição neste aparelho.'
      );
      setMedindo(false);
    }
  }

  function encerrar() {
    try {
      sessaoRef.current?.end();
    } catch {
      // sessão já encerrada
    }
    setMedindo(false);
  }

  function remover(id: string) {
    setParedes((prev) => prev.filter((p) => p.id !== id));
  }

  if (!aberto) return null;

  // Área estimada: pares de paredes formam ambientes retangulares
  const areaEstimada =
    paredes.length >= 2 ? paredes[0].pes * paredes[1].pes : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-5">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-card bg-white p-5 md:rounded-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-brand-900">📷 Medir com a câmera</p>
            <p className="text-brand-800">
              Aponte para o chão e toque nas duas pontas de cada parede.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              encerrar();
              aoFechar();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-2xl text-brand-800 hover:bg-brand-50"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Requisito do aparelho */}
        {suporte === 'verificando' && (
          <p className="text-brand-800">Verificando a câmera do aparelho…</p>
        )}

        {suporte === 'ios' && (
          <div className="space-y-3">
            <div className="rounded-card border-2 border-sun p-4">
              <p className="font-semibold text-brand-900">
                📱 No iPhone e iPad, use o app Medida da Apple
              </p>
              <p className="mt-2 text-brand-900">
                O navegador do iPhone não dá acesso à medição por câmera — é uma limitação da
                Apple, não do CleanFlow. Mas o seu aparelho já vem com o app <strong>Medida</strong>,
                que faz exatamente isso e é muito preciso.
              </p>
            </div>

            <div className="rounded-card bg-brand-50 p-4">
              <p className="font-semibold text-brand-900">Como fazer</p>
              <ol className="mt-2 space-y-2">
                {[
                  'Abra o app Medida (ícone de régua amarela)',
                  'Aponte para o chão e mova o aparelho devagar até aparecer o círculo',
                  'Toque no + no início da parede, caminhe até o fim e toque no + de novo',
                  'Anote a medida e volte aqui para digitar',
                ].map((passo, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-brand-900">{passo}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-brand-800">
                💡 O app Medida tem um modo que reconhece cômodos inteiros sozinho em aparelhos com
                sensor LiDAR (iPhone Pro e iPad Pro).
              </p>
            </div>

            <button className="btn-primary w-full" type="button" onClick={aoFechar}>
              Digitar as medidas manualmente
            </button>
          </div>
        )}

        {(suporte === 'sem_suporte' || suporte === 'sem_camera') && (
          <div className="space-y-3">
            <div className="rounded-card border-2 border-sun p-4">
              <p className="font-semibold text-brand-900">
                📱 Este recurso precisa de celular ou tablet com câmera
              </p>
              <p className="mt-2 text-brand-900">
                A medição por câmera usa realidade aumentada e funciona em{' '}
                <strong>celulares e tablets Android com o Chrome</strong>. Em computadores e em
                aparelhos sem sensor compatível, use a medição manual.
              </p>
            </div>
            <button className="btn-primary w-full" type="button" onClick={aoFechar}>
              Digitar as medidas manualmente
            </button>
          </div>
        )}

        {suporte === 'disponivel' && !medindo && paredes.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-card bg-brand-50 p-4">
              <p className="font-semibold text-brand-900">Como funciona</p>
              <ol className="mt-2 space-y-2">
                {[
                  'A câmera abre em tela cheia',
                  'Mova o aparelho devagar apontando para o chão, até aparecer o marcador',
                  'Toque na tela no início da parede',
                  'Caminhe até o fim da parede e toque de novo',
                  'Repita para as outras paredes do ambiente',
                ].map((passo, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-brand-900">{passo}</span>
                  </li>
                ))}
              </ol>
            </div>
            <button className="btn-primary w-full" type="button" onClick={iniciarMedicao}>
              📷 Abrir a câmera e medir
            </button>
          </div>
        )}

        {medindo && (
          <div className="rounded-card bg-brand-900 p-5 text-center text-white">
            <p className="text-brand-100">
              {pontos === 0
                ? 'Toque no início da parede'
                : 'Caminhe até o fim e toque de novo'}
            </p>
            {distanciaAtual !== null && (
              <p className="text-4xl font-bold text-aqua-400">
                {(distanciaAtual * 3.28084).toFixed(1)} pés
              </p>
            )}
            <button className="btn-ghost mt-3 !border-white !text-white" type="button" onClick={encerrar}>
              Encerrar medição
            </button>
          </div>
        )}

        {/* Paredes medidas */}
        {paredes.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-semibold text-brand-900">
              {paredes.length} parede(s) medida(s)
            </p>
            <div className="space-y-2">
              {paredes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-card border border-brand-100 px-3 py-2"
                >
                  <span className="text-brand-900">{p.nome}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold text-brand-900">{p.pes.toFixed(1)} pés</span>
                    <span className="text-sm text-brand-800">{p.metros.toFixed(2)} m</span>
                    <button
                      type="button"
                      onClick={() => remover(p.id)}
                      className="text-red-700"
                      aria-label="Remover"
                    >
                      🗑️
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {areaEstimada > 0 && (
              <div className="mt-3 rounded-card bg-brand-50 p-3 text-center">
                <p className="text-sm text-brand-800">
                  Ambiente retangular com as duas primeiras paredes
                </p>
                <p className="text-2xl font-bold text-brand-900">
                  {Math.round(areaEstimada).toLocaleString('pt-BR')} sq ft
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!medindo && (
                <button className="btn-ghost grow" type="button" onClick={iniciarMedicao}>
                  + Medir outra parede
                </button>
              )}
              <button
                className="btn-primary grow"
                type="button"
                onClick={() => {
                  encerrar();
                  aoConcluir(paredes);
                  aoFechar();
                }}
              >
                Usar estas medidas
              </button>
            </div>
          </div>
        )}

        {erro && <p className="mt-3 rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}
      </div>
    </div>
  );
}
