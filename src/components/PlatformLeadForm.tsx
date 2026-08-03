'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PlatformLeadForm({
  slug,
  campaignExists,
}: {
  slug: string;
  campaignExists: boolean;
}) {
  const [form, setForm] = useState({
    company: '',
    contact: '',
    phone: '',
    email: '',
    city: '',
    teams: '',
    system: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!campaignExists) return;
    const chave = 'cf_pvisit_' + slug;
    const hoje = new Date().toDateString();
    if (localStorage.getItem(chave) === hoje) return;

    let visitor = localStorage.getItem('cf_visitor');
    if (!visitor) {
      visitor = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('cf_visitor', visitor);
    }

    const supabase = createClient();
    supabase
      .rpc('register_platform_visit', {
        p_slug: slug,
        p_visitor: visitor,
        p_referrer: document.referrer || null,
      })
      .then(() => localStorage.setItem(chave, hoje));
  }, [slug, campaignExists]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar() {
    if (form.company.trim().length < 2 || form.contact.trim().length < 2) {
      setErro('Preencha o nome da empresa e o seu nome.');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setErro('Deixe um telefone ou email para entrarmos em contato.');
      return;
    }
    setBusy(true);
    setErro('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_platform_lead', {
        p_slug: slug,
        p_company: form.company,
        p_contact: form.contact,
        p_phone: form.phone || null,
        p_email: form.email || null,
        p_city: form.city || null,
        p_teams: form.teams || null,
        p_system: form.system || null,
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
      <div className="rounded-card bg-white p-8 text-center">
        <p className="text-2xl font-bold text-brand-900">Recebemos seu contato! 🎉</p>
        <p className="mt-3 text-brand-800">
          Vamos falar com você em breve para mostrar o sistema funcionando e configurar sua conta de
          teste — sem compromisso.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-6">
      <p className="text-2xl font-bold text-brand-900">Quero conhecer o CleanFlow</p>
      <p className="mt-1 text-brand-800">
        Preencha e entramos em contato para mostrar o sistema e liberar seu período de teste.
      </p>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-company">Nome da empresa *</label>
            <input className="input" id="p-company" value={form.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-contact">Seu nome *</label>
            <input className="input" id="p-contact" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-phone">Telefone (WhatsApp)</label>
            <input className="input" id="p-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-email">Email</label>
            <input className="input" id="p-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-city">Cidade onde atua</label>
            <input className="input" id="p-city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ex: Boston, MA" />
          </div>
          <div>
            <label className="label" htmlFor="p-teams">Quantas equipes você tem?</label>
            <select className="input" id="p-teams" value={form.teams} onChange={(e) => set('teams', e.target.value)}>
              <option value="">Selecionar</option>
              <option value="Sozinha">Trabalho sozinha</option>
              <option value="1 equipe">1 equipe</option>
              <option value="2 equipes">2 equipes</option>
              <option value="3 a 5 equipes">3 a 5 equipes</option>
              <option value="Mais de 5">Mais de 5 equipes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="p-system">Usa algum sistema hoje?</label>
          <input className="input" id="p-system" value={form.system} onChange={(e) => set('system', e.target.value)} placeholder="Ex: papel e WhatsApp, ou outro aplicativo" />
        </div>

        <div>
          <label className="label" htmlFor="p-notes">O que mais te incomoda hoje na operação?</label>
          <textarea className="input" id="p-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {erro && <p className="rounded-card bg-red-50 p-3 text-red-800">{erro}</p>}

        <button className="btn-primary w-full" type="button" onClick={enviar} disabled={busy}>
          {busy ? 'Enviando…' : 'Quero uma demonstração'}
        </button>
      </div>
    </div>
  );
}
