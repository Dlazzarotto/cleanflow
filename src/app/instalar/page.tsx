import InstallGuide from '@/components/InstallGuide';

export const metadata = {
  title: 'Instalar o CleanFlow no celular',
  description: 'Coloque o CleanFlow na tela inicial e use como aplicativo.',
};

/** Página pública: instruções para instalar o app. */
export default function InstalarPage() {
  return (
    <main className="min-h-screen bg-brand-900 px-5 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center text-white">
          <p className="text-3xl font-bold">
            Clean<span className="text-aqua-400">Flow</span>
          </p>
          <p className="mt-3 text-2xl font-semibold">Tenha o sistema na tela do seu celular</p>
          <p className="mt-2 text-brand-100">
            Instalado, o CleanFlow abre como qualquer aplicativo — sem procurar link, sem digitar
            endereço.
          </p>
        </div>

        <InstallGuide />

        <div className="mt-8 text-center">
          <a href="/minha-agenda" className="text-brand-100 underline">
            Prefiro usar pelo navegador mesmo
          </a>
        </div>
      </div>
    </main>
  );
}
