import type { DocLang } from '@/lib/i18n/documents';

export const INVOICE_I18N: Record<
  DocLang,
  {
    title: string;
    number: string;
    issued: string;
    due: string;
    billTo: string;
    service: string;
    serviceDate: string;
    address: string;
    total: string;
    howToPay: string;
    payOnline: string;
    payOnlineSoon: string;
    statusOpen: string;
    statusPaid: string;
    statusOverdue: string;
    statusCancelled: string;
    paidOn: string;
    thanks: string;
    questions: string;
    emailSubject: (n: number, company: string) => string;
    emailHello: (name: string) => string;
    emailIntro: (company: string) => string;
    emailCta: string;
    emailRegards: string;
  }
> = {
  pt: {
    title: 'FATURA',
    number: 'Nº',
    issued: 'Emitida em',
    due: 'Vencimento',
    billTo: 'Cobrar de:',
    service: 'Serviço de limpeza',
    serviceDate: 'Data do serviço',
    address: 'Endereço',
    total: 'Total a pagar',
    howToPay: 'Como pagar',
    payOnline: 'Pagar com cartão',
    payOnlineSoon: 'Pagamento com cartão em breve',
    statusOpen: 'Em aberto',
    statusPaid: 'Paga ✓',
    statusOverdue: 'Vencida',
    statusCancelled: 'Cancelada',
    paidOn: 'Pagamento recebido em',
    thanks: 'Obrigado pela preferência!',
    questions: 'Dúvidas? Responda o email ou fale conosco:',
    emailSubject: (n, c) => `Fatura #${n} — ${c}`,
    emailHello: (name) => `Olá, ${name}!`,
    emailIntro: (c) => `Sua limpeza foi concluída. Segue a fatura da ${c}:`,
    emailCta: 'Ver fatura e pagar',
    emailRegards: 'Obrigado pela preferência,',
  },
  en: {
    title: 'INVOICE',
    number: 'No.',
    issued: 'Issued on',
    due: 'Due date',
    billTo: 'Bill to:',
    service: 'Cleaning service',
    serviceDate: 'Service date',
    address: 'Address',
    total: 'Amount due',
    howToPay: 'How to pay',
    payOnline: 'Pay by card',
    payOnlineSoon: 'Card payment coming soon',
    statusOpen: 'Open',
    statusPaid: 'Paid ✓',
    statusOverdue: 'Past due',
    statusCancelled: 'Cancelled',
    paidOn: 'Payment received on',
    thanks: 'Thank you for your business!',
    questions: 'Questions? Reply to this email or contact us:',
    emailSubject: (n, c) => `Invoice #${n} — ${c}`,
    emailHello: (name) => `Hi ${name},`,
    emailIntro: (c) => `Your cleaning is complete. Here is your invoice from ${c}:`,
    emailCta: 'View invoice and pay',
    emailRegards: 'Thank you for your business,',
  },
  es: {
    title: 'FACTURA',
    number: 'N.º',
    issued: 'Emitida el',
    due: 'Vencimiento',
    billTo: 'Facturar a:',
    service: 'Servicio de limpieza',
    serviceDate: 'Fecha del servicio',
    address: 'Dirección',
    total: 'Total a pagar',
    howToPay: 'Cómo pagar',
    payOnline: 'Pagar con tarjeta',
    payOnlineSoon: 'Pago con tarjeta próximamente',
    statusOpen: 'Pendiente',
    statusPaid: 'Pagada ✓',
    statusOverdue: 'Vencida',
    statusCancelled: 'Cancelada',
    paidOn: 'Pago recibido el',
    thanks: '¡Gracias por su preferencia!',
    questions: '¿Dudas? Responda este correo o contáctenos:',
    emailSubject: (n, c) => `Factura #${n} — ${c}`,
    emailHello: (name) => `¡Hola, ${name}!`,
    emailIntro: (c) => `Su limpieza fue completada. Aquí está su factura de ${c}:`,
    emailCta: 'Ver factura y pagar',
    emailRegards: 'Gracias por su preferencia,',
  },
  fr: {
    title: 'FACTURE',
    number: 'N°',
    issued: 'Émise le',
    due: "Date d'échéance",
    billTo: 'Facturer à :',
    service: 'Service de nettoyage',
    serviceDate: 'Date du service',
    address: 'Adresse',
    total: 'Montant à payer',
    howToPay: 'Comment payer',
    payOnline: 'Payer par carte',
    payOnlineSoon: 'Paiement par carte bientôt disponible',
    statusOpen: 'En attente',
    statusPaid: 'Payée ✓',
    statusOverdue: 'En retard',
    statusCancelled: 'Annulée',
    paidOn: 'Paiement reçu le',
    thanks: 'Merci de votre confiance !',
    questions: 'Des questions ? Répondez à cet email ou contactez-nous :',
    emailSubject: (n, c) => `Facture #${n} — ${c}`,
    emailHello: (name) => `Bonjour ${name},`,
    emailIntro: (c) => `Votre nettoyage est terminé. Voici votre facture de ${c} :`,
    emailCta: 'Voir la facture et payer',
    emailRegards: 'Merci de votre confiance,',
  },
};
