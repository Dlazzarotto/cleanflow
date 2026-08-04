import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativo do CleanFlow — somente a parte da equipe de campo.
 * A gestão continua usando o sistema pelo navegador.
 *
 * O app carrega o site publicado; assim, correções na Vercel chegam
 * ao celular sem precisar publicar versão nova na loja.
 */
const config: CapacitorConfig = {
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
    Geolocation: {
      // Permissões de localização em segundo plano
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
