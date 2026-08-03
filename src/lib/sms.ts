/**
 * Envio de SMS pela Twilio.
 * Requer TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER.
 */

/** Normaliza telefone dos EUA para o formato internacional (+1XXXXXXXXXX). */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (String(phone).trim().startsWith('+')) return String(phone).trim().replace(/[^\d+]/g, '');
  return null;
}

/** Envia um SMS. Retorna null se enviou, ou a mensagem de erro. */
export async function sendSms(to: string, body: string): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return 'SMS não configurado. Adicione TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER nas variáveis da Vercel.';
  }

  const destino = toE164(to);
  if (!destino) return `Telefone inválido para SMS: ${to}`;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      },
      body: new URLSearchParams({ To: destino, From: from, Body: body }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      try {
        const j = JSON.parse(detalhe);
        if (j.code === 21608) {
          return 'Número não verificado. Em contas Twilio de teste, só é possível enviar para números verificados no painel da Twilio.';
        }
        if (j.code === 21610) return 'Este número pediu para não receber mensagens (respondeu STOP).';
        if (j.code === 30034 || j.code === 30032) {
          return 'Envio bloqueado: o número da empresa precisa estar registrado no A2P 10DLC da Twilio para mensagens comerciais nos EUA.';
        }
        return `Falha no envio: ${j.message ?? detalhe.slice(0, 160)}`;
      } catch {
        return `Falha no envio: ${detalhe.slice(0, 160)}`;
      }
    }
    return null;
  } catch {
    return 'Falha de rede ao enviar o SMS.';
  }
}
