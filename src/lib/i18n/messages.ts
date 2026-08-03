import type { DocLang } from '@/lib/i18n/documents';

export const REMINDER_I18N: Record<
  DocLang,
  {
    subject: (company: string) => string;
    title: string;
    hello: (name: string) => string;
    intro: (date: string) => string;
    prepare: string;
    tips: string[];
    cancelPolicy: (hours: number) => string;
    questions: string;
    regards: string;
  }
> = {
  pt: {
    subject: (c) => `Lembrete: sua limpeza é amanhã — ${c}`,
    title: 'Sua limpeza é amanhã',
    hello: (n) => `Olá, ${n}!`,
    intro: (d) => `Passando para lembrar da sua limpeza <strong>amanhã, ${d}</strong>.`,
    prepare: 'Para a equipe render melhor:',
    tips: [
      'Deixe o acesso liberado (chave, código ou alguém em casa)',
      'Se tiver pets, nos avise onde eles ficarão',
      'Recolher objetos pessoais das superfícies ajuda muito',
    ],
    cancelPolicy: (h) =>
      `Precisa remarcar? É só responder este email ou falar conosco com pelo menos ${h} horas de antecedência, conforme o contrato.`,
    questions: 'Qualquer dúvida, é só responder aqui ou falar conosco:',
    regards: 'Até amanhã!',
  },
  en: {
    subject: (c) => `Reminder: your cleaning is tomorrow — ${c}`,
    title: 'Your cleaning is tomorrow',
    hello: (n) => `Hi ${n},`,
    intro: (d) => `Just a reminder about your cleaning <strong>tomorrow, ${d}</strong>.`,
    prepare: 'To help the team work efficiently:',
    tips: [
      'Please make sure we can get in (key, code, or someone home)',
      'If you have pets, let us know where they will be',
      'Clearing personal items from surfaces helps a lot',
    ],
    cancelPolicy: (h) =>
      `Need to reschedule? Just reply to this email or contact us at least ${h} hours in advance, as stated in your agreement.`,
    questions: 'Any questions, just reply here or contact us:',
    regards: 'See you tomorrow!',
  },
  es: {
    subject: (c) => `Recordatorio: su limpieza es mañana — ${c}`,
    title: 'Su limpieza es mañana',
    hello: (n) => `¡Hola, ${n}!`,
    intro: (d) => `Le recordamos su limpieza <strong>mañana, ${d}</strong>.`,
    prepare: 'Para que el equipo trabaje mejor:',
    tips: [
      'Deje el acceso disponible (llave, código o alguien en casa)',
      'Si tiene mascotas, avísenos dónde estarán',
      'Retirar objetos personales de las superficies ayuda mucho',
    ],
    cancelPolicy: (h) =>
      `¿Necesita reprogramar? Responda este correo o contáctenos con al menos ${h} horas de antelación, según su contrato.`,
    questions: 'Cualquier duda, responda aquí o contáctenos:',
    regards: '¡Hasta mañana!',
  },
  fr: {
    subject: (c) => `Rappel : votre nettoyage est demain — ${c}`,
    title: 'Votre nettoyage est demain',
    hello: (n) => `Bonjour ${n},`,
    intro: (d) => `Petit rappel de votre nettoyage <strong>demain, ${d}</strong>.`,
    prepare: "Pour aider l'équipe à bien travailler :",
    tips: [
      "Assurez-vous que nous puissions entrer (clé, code ou quelqu'un sur place)",
      'Si vous avez des animaux, dites-nous où ils seront',
      'Dégager les objets personnels des surfaces aide beaucoup',
    ],
    cancelPolicy: (h) =>
      `Besoin de reporter ? Répondez à cet email ou contactez-nous au moins ${h} heures à l'avance, comme prévu au contrat.`,
    questions: 'Pour toute question, répondez ici ou contactez-nous :',
    regards: 'À demain !',
  },
};

export function reminderHtml(params: {
  lang: DocLang;
  companyName: string;
  clientName: string;
  dateLabel: string;
  cancelHours: number;
  contact: string;
  extraNote?: string | null;
}) {
  const t = REMINDER_I18N[params.lang];
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#122221;font-size:16px;line-height:1.5;">
    <div style="background:#083A38;color:#ffffff;padding:24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:24px;font-weight:bold;">${params.companyName}</p>
      <p style="margin:4px 0 0;color:#D9F2F0;">${t.title}</p>
    </div>
    <div style="border:1px solid #D9F2F0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
      <p><strong>${t.hello(params.clientName)}</strong></p>
      <p>${t.intro(params.dateLabel)}</p>

      <div style="background:#EFFAF9;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-weight:bold;color:#0C4B48;">${t.prepare}</p>
        <ul style="margin:8px 0 0 20px;padding:0;">
          ${t.tips.map((x) => `<li style="margin:4px 0;">${x}</li>`).join('')}
        </ul>
      </div>

      ${params.extraNote ? `<p>${params.extraNote}</p>` : ''}

      <p style="font-size:14px;color:#0C4B48;">${t.cancelPolicy(params.cancelHours)}</p>
      <p style="font-size:14px;color:#0C4B48;">${t.questions} ${params.contact}</p>
      <p style="margin-top:20px;">${t.regards}<br/><strong>${params.companyName}</strong></p>
    </div>
  </div>`;
}
