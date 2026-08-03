'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CampaignLandingForm({
  slug,
  companyName,
  companyPhone,
}: {
  slug: string;
  companyName: string;
  companyPhone: string | null;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [erro, setErro] = useState('');

  // Registra a visita uma vez por navegador/dia
  useEffect(() => {
    const chave = 'cf_visit_' + slug;
    const hoje = new Date().toDateString();
    if (localStorage.getItem(chave) === hoje) return;

    let visitor = localStorage.getItem('cf_visitor');
    if (!visitor) {
      visitor = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('cf_visitor', visitor);
    }

    const supabase = createClient();
    supabase
      .rpc('register_campaign_visit', {
        p_slug: slug,
        p_visitor: visitor,
        p_referrer: document.referrer || null,
        p_agent: navigator.userAgent.slice(0, 200),
      })
      .then(() => localStorage.setItem(chave, hoje));
  }, [slug]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar() {
    if (form.name.trim().length < 3 || form.phone.trim().length < 8) {
      setErro('Preencha seu nome e telefone para entrarmos em contato.');
      return;
    }
    setBusy(true);
    setErro('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_campaign_lead', {
        p_slug: slug,
        p_name: form.name,
        p_phone: form.phone,
        p_email: form.email || null,
        p_address: form.address || null,
        p_notes: form.notes || null,
      });
      if (error || data === false) {
        setErro('Não foi possível enviar agora. Tente novamente em instantes.');
      } else {
        setDone(true);
      }
    } catch {
      setErro('Não foi possível enviar agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <p className="text-2xl font-bold text-brand-900">Recebemos seu pedido! 🎉</p>
        <p className="mt-3 text-brand-800">
          A {companyName} vai entrar em contato em breve para combinar os detalhes e enviar seu
          orçamento.
        </p>
        {companyPhone && (
          <p className="mt-3 text-brand-800">
            Prefere falar agora? <strong>{companyPhone}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label" htmlFor="c-name">Seu nome *</label>
        <input className="input" id="c-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="c-phone">Telefone (WhatsApp) *</label>
        <input className="input" id="c-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(617) 555-0100" />
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email</label>
        <input className="input" id="c-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="c-address">Endereço do imóvel</label>
        <input className="input" id="c-address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, cidade" />
      </div>
      <div>
        <label className="label" htmlFor="c-notes">Conte o que você precisa</label>
        <textarea className="input" id="c-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex: casa de 3 quartos, quero limpeza a cada 15 dias" />
      </div>

      {erro && <p className="rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}

      <button className="btn-primary w-full" type="button" onClick={enviar} disabled={busy}>
        {busy ? 'Enviando…' : 'Quero meu orçamento'}
      </button>
    </div>
  );
}
