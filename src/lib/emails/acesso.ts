/** Email de boas-vindas com os dados de acesso ao CleanFlow. */
export function accessEmailHtml(params: {
  fullName: string;
  companyName: string;
  loginUrl: string;
  email: string;
  password: string | null;
  isReset: boolean;
}) {
  const { fullName, companyName, loginUrl, email, password, isReset } = params;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#122221;font-size:16px;line-height:1.5;">
    <div style="background:#083A38;color:#ffffff;padding:24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:24px;font-weight:bold;">CleanFlow</p>
      <p style="margin:4px 0 0;color:#D9F2F0;">${companyName}</p>
    </div>
    <div style="border:1px solid #D9F2F0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
      <p>Olá, <strong>${fullName}</strong>!</p>
      <p>${
        isReset
          ? 'Sua senha de acesso ao CleanFlow foi redefinida.'
          : `Você recebeu acesso ao CleanFlow, o sistema usado pela ${companyName}.`
      }</p>
      <div style="background:#EFFAF9;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0;"><strong>Endereço:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="margin:8px 0 0;"><strong>Login:</strong> ${email}</p>
        ${password ? `<p style="margin:8px 0 0;"><strong>Senha:</strong> ${password}</p>` : ''}
      </div>
      <p style="font-size:14px;color:#0C4B48;">
        Por segurança, troque sua senha assim que entrar: menu <strong>Configurações → Trocar senha</strong>.
        Não compartilhe estes dados com ninguém.
      </p>
      <p style="margin-top:20px;">Equipe ${companyName}</p>
    </div>
  </div>`;
}

/** Envia via Resend. Retorna null se enviou, ou a mensagem de erro. */
export async function sendAccessEmail(params: {
  to: string;
  subject: string;
  html: string;
  companyName: string;
  replyTo?: string | null;
}): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return 'Envio de email não configurado (RESEND_API_KEY ausente nas variáveis da Vercel).';
  }
  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: `${params.companyName} <${from}>`,
        to: [params.to],
        reply_to: params.replyTo ?? undefined,
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      if (detail.includes('domain') || detail.includes('verify') || detail.includes('testing')) {
        return 'O Resend só entrega para o email da sua própria conta enquanto não houver um domínio verificado. Verifique um domínio em resend.com → Domains e defina EMAIL_FROM na Vercel.';
      }
      return `Falha no envio: ${detail.slice(0, 200)}`;
    }
    return null;
  } catch {
    return 'Falha de rede ao enviar o email.';
  }
}
