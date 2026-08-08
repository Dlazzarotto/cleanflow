'use client';
import { useState } from 'react';
import { SEGMENTS, CLIENT_TYPES, BILLING_TYPES, PAYMENT_TERMS } from '@/lib/commercial';

/**
 * Residencial e comercial pedem informações diferentes.
 * Este bloco troca os campos conforme o tipo escolhido.
 */
export default function ClientTypeFields({
  clientType = 'residencial',
  segment = '',
  areaSqft = null,
  contactRole = '',
  accessNotes = '',
  billingType = 'por_limpeza',
  monthlyValue = null,
  paymentTerms = '',
}: {
  clientType?: string;
  segment?: string;
  areaSqft?: number | null;
  contactRole?: string;
  accessNotes?: string;
  billingType?: string;
  monthlyValue?: number | null;
  paymentTerms?: string;
}) {
  const [tipo, setTipo] = useState(clientType);
  const [cobranca, setCobranca] = useState(billingType);

  return (
    <div className="rounded-card bg-brand-50 p-4">
      <p className="mb-3 font-semibold text-brand-900">🏢 Tipo de cliente</p>

      <div className="flex flex-wrap gap-2">
        {CLIENT_TYPES.map((t) => (
          <label
            key={t.key}
            className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-card border-2 px-4 py-2 font-medium ${
              tipo === t.key
                ? 'border-brand-700 bg-white text-brand-900'
                : 'border-brand-100 bg-white/50 text-brand-800'
            }`}
          >
            <input
              type="radio"
              name="client_type"
              value={t.key}
              checked={tipo === t.key}
              onChange={() => setTipo(t.key)}
              className="h-4 w-4 accent-brand-700"
            />
            {t.label}
          </label>
        ))}
      </div>

      {tipo === 'comercial' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="business_segment">Segmento *</label>
              <select
                className="input"
                id="business_segment"
                name="business_segment"
                defaultValue={segment}
              >
                <option value="">Selecionar</option>
                {SEGMENTS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="area_sqft">Área aproximada (sq ft)</label>
              <input
                className="input"
                id="area_sqft"
                name="area_sqft"
                type="number"
                min={0}
                step={100}
                defaultValue={areaSqft ?? ''}
                placeholder="Ex: 2500"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="contact_role">Quem é o contato no local</label>
            <input
              className="input"
              id="contact_role"
              name="contact_role"
              defaultValue={contactRole}
              placeholder="Ex: Sandra, gerente — atende das 9h às 17h"
            />
          </div>

          <div>
            <label className="label" htmlFor="access_notes">Como a equipe entra</label>
            <textarea
              className="input"
              id="access_notes"
              name="access_notes"
              rows={2}
              defaultValue={accessNotes}
              placeholder="Ex: entrada pelos fundos, chave na portaria, alarme código 4482. Limpeza só depois das 22h."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="billing_type">Como cobra</label>
              <select
                className="input"
                id="billing_type"
                name="billing_type"
                value={cobranca}
                onChange={(e) => setCobranca(e.target.value)}
              >
                {BILLING_TYPES.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </div>

            {cobranca === 'mensal_fixo' && (
              <div>
                <label className="label" htmlFor="monthly_contract_value">
                  Valor mensal (USD)
                </label>
                <input
                  className="input"
                  id="monthly_contract_value"
                  name="monthly_contract_value"
                  type="number"
                  min={0}
                  step={50}
                  defaultValue={monthlyValue ?? ''}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="payment_terms">Prazo de pagamento</label>
              <select
                className="input"
                id="payment_terms"
                name="payment_terms"
                defaultValue={paymentTerms}
              >
                {PAYMENT_TERMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-brand-800">
            No contrato mensal fixo, a fatura é uma só no fim do mês, somando as limpezas do
            período.
          </p>
        </div>
      )}
    </div>
  );
}
