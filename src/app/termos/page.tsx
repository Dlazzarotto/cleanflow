'use client';
import { useState } from 'react';
import { TERMS_EN, TERMS_PT, TERMS_VERSION } from '@/lib/legal/terms';
import { PLANS } from '@/lib/plans';

export default function TermosPage() {
  const [lang, setLang] = useState<'pt' | 'en'>('pt');
  const t = lang === 'pt' ? TERMS_PT : TERMS_EN;

  return (
    <main className="mx-auto max-w-3xl p-5 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-3xl font-bold text-brand-900">
            Clean<span className="text-aqua-500">Flow</span>
          </p>
          <p className="text-brand-800">
            {lang === 'pt' ? 'Contrato de Assinatura da Plataforma' : 'Platform Subscription Agreement'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={lang === 'pt' ? 'btn-primary' : 'btn-ghost'} onClick={() => setLang('pt')}>
            🇧🇷 Português
          </button>
          <button className={lang === 'en' ? 'btn-primary' : 'btn-ghost'} onClick={() => setLang('en')}>
            🇺🇸 English
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>🖨️</button>
        </div>
      </div>

      <div className="card print:border-0 print:shadow-none">
        <p className="mb-4 text-sm text-brand-800">
          {lang === 'pt' ? 'Versão' : 'Version'}: {TERMS_VERSION}
        </p>

        <p className="mb-6">{t.intro}</p>

        <div className="mb-6 rounded-card bg-brand-50 p-4">
          <p className="mb-2 font-semibold text-brand-900">
            {lang === 'pt' ? 'Planos vigentes' : 'Current plans'}
          </p>
          {Object.values(PLANS).map((p) => (
            <p key={p.key}>
              <strong>{p.name}</strong> — US$ {p.price.toFixed(2)}/
              {lang === 'pt' ? 'mês' : 'month'} ·{' '}
              {p.baseTeams} {lang === 'pt' ? 'equipe(s)' : 'team(s)'}
              {p.extraTeamPrice > 0 &&
                ` · +US$ ${p.extraTeamPrice.toFixed(2)}/${lang === 'pt' ? 'mês por equipe adicional' : 'month per additional team'}`}
            </p>
          ))}
        </div>

        <div className="space-y-5">
          {t.clauses.map((c) => (
            <div key={c.title}>
              <p className="font-bold text-brand-900">{c.title}</p>
              {c.body.map((b, i) => (
                <p key={i} className="mt-1">{b}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
