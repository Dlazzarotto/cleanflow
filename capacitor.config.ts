/**
 * App nativo do CleanFlow — somente a parte da equipe de campo.
 * A gestão continua usando o sistema pelo navegador.
 *
 * O app carrega o site publicado; assim, correções na Vercel chegam
 * ao celular sem precisar publicar versão nova na loja.
 *
 * Sem tipagem do @capacitor/cli de propósito: esse pacote só existe
 * na máquina que gera o app (o Mac), e o build do site não deve
 * depender dele.
 */
const config = {
  appId: 'app.cleanflows.equipe',
  appName: 'CleanFlow',
  webDir: 'public',
  server: {
    url: 'https://cleanflows.app/minha-agenda',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#083A38',
  },
  android: {
    backgroundColor: '#083A38',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#083A38',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
