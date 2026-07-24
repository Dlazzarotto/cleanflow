import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatMinutes, FREQUENCY_LABEL } from '@/lib/pricing';
import { buildServiceList } from '@/lib/estimate-view';
import { getPricingSettings } from '@/lib/actions/estimates';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function ContratoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: estimate }, { data: company }, settings] = await Promise.all([
    supabase.from('estimates').select('*, clients(full_name, phone, email, address)').eq('id', params.id).single(),
    supabase.from('companies').select('name, phone, email, address').limit(1).single(),
    getPricingSettings(),
  ]);
  if (!estimate) notFound();

  const e = estimate as any;
  const sections = buildServiceList(e);
  const clientName = e.clients?.full_name ?? e.lead_name ?? '____________________________';
  const clientAddress = e.address ?? e.clients?.address ?? '____________________________';
  const companyName = company?.name ?? 'Empresa de Limpeza';
  const price = e.final_price ? usd(e.final_price) : `${usd(e.price_low)} – ${usd(e.price_high)}`;
  const freq = FREQUENCY_LABEL[e.frequency] ?? 'a definir entre as partes';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-brand-900">Contrato de prestação de serviços</h1>
        <PrintButton />
      </div>

      <div className="mb-4 rounded-card border border-sun bg-white p-4 text-brand-800 print:hidden">
        ⚠️ Este é um modelo gerado automaticamente a partir do estimate. Antes de usar com clientes,
        recomendamos a revisão por um advogado licenciado em Massachusetts.
      </div>

      <div className="card space-y-5 print:border-0 print:p-0 print:shadow-none">
        <div className="border-b border-brand-100 pb-4 text-center">
          <p className="text-2xl font-bold text-brand-900">
            CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE LIMPEZA RESIDENCIAL
          </p>
        </div>

        <p>
          Pelo presente instrumento, de um lado <strong>{companyName}</strong>
          {company?.address ? `, com endereço em ${company.address}` : ''}
          {company?.phone ? `, telefone ${company.phone}` : ''}
          {company?.email ? `, e-mail ${company.email}` : ''}, doravante denominada{' '}
          <strong>CONTRATADA</strong>; e de outro lado <strong>{clientName}</strong>, com imóvel
          localizado em <strong>{clientAddress}</strong>, doravante denominado(a){' '}
          <strong>CONTRATANTE</strong>; têm entre si justo e acordado o que segue:
        </p>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 1 — OBJETO</p>
          <p>
            A CONTRATADA prestará serviços de limpeza residencial no imóvel indicado acima,
            limitados exclusivamente aos serviços descritos no <strong>Anexo A</strong> deste
            contrato, elaborado a partir do estimate aprovado pelo(a) CONTRATANTE.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 2 — RECORRÊNCIA E AGENDAMENTO</p>
          <p>
            Os serviços serão prestados com frequência <strong>{freq}</strong>, em dia e horário
            acordados entre as partes. A duração estimada de cada visita é de{' '}
            <strong>{formatMinutes(e.minutes)}</strong>, podendo variar conforme as condições do
            imóvel.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 3 — PREÇO E PAGAMENTO</p>
          <p>
            O valor por limpeza é de <strong>{price}</strong>, devido ao término de cada visita,
            pelos meios de pagamento disponibilizados pela CONTRATADA. Reajustes de preço serão
            comunicados com no mínimo 30 (trinta) dias de antecedência.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">
            CLÁUSULA 4 — CANCELAMENTO E REMARCAÇÃO DE VISITAS
          </p>
          <p>
            O cancelamento ou a remarcação de uma visita deve ser comunicado à CONTRATADA com
            antecedência mínima de <strong>{settings.cancel_notice_hours} horas</strong>.
            Caso a equipe compareça ao imóvel na data e horário agendados e não consiga acesso
            (ausência do(a) CONTRATANTE, porta trancada sem chave/código disponibilizado, ou
            recusa de entrada), será devida uma <strong>taxa de comparecimento (lockout fee) de{' '}
            {usd(settings.lockout_fee)}</strong>, cobrada na fatura seguinte.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 5 — SERVIÇOS ADICIONAIS</p>
          <p>
            Qualquer serviço não descrito no Anexo A deverá ser solicitado diretamente à
            CONTRATADA, que elaborará novo estimate para aprovação prévia do(a) CONTRATANTE.{' '}
            <strong>
              As profissionais em campo não estão autorizadas a negociar, aceitar ou executar
              serviços fora do escopo contratado
            </strong>
            , e solicitações feitas diretamente a elas não geram obrigação para a CONTRATADA.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">
            CLÁUSULA 6 — NÃO ALICIAMENTO DE PROFISSIONAIS
          </p>
          <p>
            O(A) CONTRATANTE compromete-se a não contratar, empregar, aliciar, subornar ou
            negociar diretamente — de forma remunerada ou não — com qualquer profissional da
            CONTRATADA para a prestação de serviços de limpeza ou similares, durante a vigência
            deste contrato e por <strong>12 (doze) meses</strong> após seu término. A violação
            desta cláusula sujeita o(a) CONTRATANTE ao pagamento de multa compensatória de{' '}
            <strong>{usd(settings.solicitation_fee)}</strong>, correspondente aos custos de
            recrutamento e treinamento da CONTRATADA.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 7 — VIGÊNCIA E RESCISÃO</p>
          <p>
            Este contrato vigora por prazo indeterminado a partir da assinatura. Qualquer das
            partes pode rescindi-lo, sem penalidade, mediante aviso prévio por escrito de{' '}
            <strong>{settings.termination_notice_days} dias</strong>. As visitas já
            agendadas dentro do período de aviso permanecem devidas nos termos das Cláusulas 3 e 4.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 8 — ACESSO, CHAVES E ALARMES</p>
          <p>
            O(A) CONTRATANTE garantirá o acesso da equipe ao imóvel nos horários agendados,
            responsabilizando-se por fornecer chaves, códigos de porta ou instruções de alarme
            quando necessário. A CONTRATADA manterá tais informações sob confidencialidade e
            uso restrito à prestação dos serviços.
          </p>
        </div>

        <div>
          <p className="font-bold text-brand-900">CLÁUSULA 9 — DISPOSIÇÕES GERAIS</p>
          <p>
            A CONTRATADA mantém seguro e cumpre a legislação trabalhista aplicável às suas
            profissionais. Danos comprovadamente causados pela equipe devem ser comunicados em
            até 48 horas após a visita. Este contrato é regido pelas leis do Estado de
            Massachusetts, Estados Unidos.
          </p>
        </div>

        {/* Anexo A */}
        <div className="rounded-card bg-brand-50 p-5 print:border print:border-brand-100">
          <p className="mb-3 text-xl font-bold text-brand-900">ANEXO A — ESCOPO DOS SERVIÇOS</p>
          <div className="space-y-3">
            {sections.map((s) => (
              <div key={s.title}>
                <p className="font-semibold text-brand-800">{s.title}</p>
                <ul className="ml-5 list-disc">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Assinaturas */}
        <div className="grid gap-10 pt-8 md:grid-cols-2">
          <div className="text-center">
            <div className="border-t border-ink pt-2">
              <p className="font-semibold">{companyName}</p>
              <p className="text-sm text-brand-800">CONTRATADA · Data: ____/____/______</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-ink pt-2">
              <p className="font-semibold">{clientName}</p>
              <p className="text-sm text-brand-800">CONTRATANTE · Data: ____/____/______</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
