import type { DocLang } from '@/lib/i18n/documents';

/** Textos curtos para SMS (limite prático de 320 caracteres). */
export const SMS_I18N: Record<
  DocLang,
  {
    reminder: (p: { company: string; name: string; date: string; hours: number; extra?: string | null }) => string;
    invoice: (p: { company: string; name: string; amount: string; link: string }) => string;
    testMessage: string;
  }
> = {
  pt: {
    reminder: (p) =>
      `${p.company}: Olá, ${p.name}! Lembrando da sua limpeza amanhã (${p.date}). ` +
      `Deixe o acesso liberado, por favor. Precisa remarcar? Avise com ${p.hours}h de antecedência.` +
      (p.extra ? ` ${p.extra}` : ''),
    invoice: (p) =>
      `${p.company}: Olá, ${p.name}! Sua limpeza foi concluída. Fatura de ${p.amount}: ${p.link}`,
    testMessage: 'CleanFlow: teste de configuração de SMS. Se você recebeu, está tudo certo.',
  },
  en: {
    reminder: (p) =>
      `${p.company}: Hi ${p.name}! Reminder: your cleaning is tomorrow (${p.date}). ` +
      `Please make sure we can get in. Need to reschedule? Let us know ${p.hours}h in advance.` +
      (p.extra ? ` ${p.extra}` : ''),
    invoice: (p) =>
      `${p.company}: Hi ${p.name}! Your cleaning is complete. Invoice for ${p.amount}: ${p.link}`,
    testMessage: 'CleanFlow: SMS configuration test. If you got this, everything works.',
  },
  es: {
    reminder: (p) =>
      `${p.company}: ¡Hola, ${p.name}! Su limpieza es mañana (${p.date}). ` +
      `Por favor deje el acceso disponible. ¿Reprogramar? Avísenos con ${p.hours}h de antelación.` +
      (p.extra ? ` ${p.extra}` : ''),
    invoice: (p) =>
      `${p.company}: ¡Hola, ${p.name}! Su limpieza fue completada. Factura de ${p.amount}: ${p.link}`,
    testMessage: 'CleanFlow: prueba de configuración de SMS. Si lo recibió, todo funciona.',
  },
  fr: {
    reminder: (p) =>
      `${p.company} : Bonjour ${p.name} ! Votre nettoyage est demain (${p.date}). ` +
      `Merci de prévoir l'accès. Besoin de reporter ? Prévenez-nous ${p.hours}h à l'avance.` +
      (p.extra ? ` ${p.extra}` : ''),
    invoice: (p) =>
      `${p.company} : Bonjour ${p.name} ! Nettoyage terminé. Facture de ${p.amount} : ${p.link}`,
    testMessage: 'CleanFlow : test de configuration SMS. Si vous recevez ceci, tout fonctionne.',
  },
};
