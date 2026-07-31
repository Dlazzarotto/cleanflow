/**
 * Contrato de Assinatura da Plataforma CleanFlow.
 * Versao controladora: ingles (EUA / Massachusetts).
 * A versao em portugues e traducao de cortesia.
 *
 * IMPORTANTE: modelo elaborado com base em praticas usuais de SaaS nos EUA.
 * Recomenda-se revisao por advogado licenciado antes do uso comercial.
 */

export const TERMS_VERSION = '2026-07-30';

export interface Clause {
  title: string;
  body: string[];
}

export const TERMS_EN: { intro: string; clauses: Clause[] } = {
  intro:
    'This Subscription Agreement ("Agreement") is entered into between CleanFlow ("Provider") and the business identified in the account registration ("Customer"). By creating an account, clicking to accept, or using the Service, Customer agrees to be bound by this Agreement.',
  clauses: [
    {
      title: '1. Definitions',
      body: [
        '"Service" means the CleanFlow web platform for cleaning business management, including all features, updates, and related documentation.',
        '"Customer Data" means all data submitted by Customer or its users to the Service, including data about Customer\'s own clients, staff, schedules, and pricing.',
        '"Authorized Users" means employees, contractors, or agents of Customer that Customer grants access to the Service.',
      ],
    },
    {
      title: '2. Service and License',
      body: [
        'Provider grants Customer a limited, non-exclusive, non-transferable, revocable right to access and use the Service during the Term, solely for Customer\'s internal business operations.',
        'The Service is provided on a software-as-a-service basis. No copy of the software is delivered or licensed for installation.',
        'Provider may modify, improve, or discontinue features of the Service, provided that material reductions in core functionality will be communicated with at least thirty (30) days\' notice.',
      ],
    },
    {
      title: '3. Subscription Plans, Fees and Auto-Renewal',
      body: [
        'Subscription plans and prices are those published by Provider and selected by Customer at registration. As of this version: Standard — US$30.00 per month, including one (1) team; Plus — US$50.00 per month, including two (2) teams, with each additional team at US$10.00 per month.',
        'THIS IS AN AUTOMATICALLY RENEWING SUBSCRIPTION. The subscription renews monthly and the payment method on file will be charged each billing period until cancelled by Customer. Customer may cancel at any time through the account settings or by written notice to Provider, effective at the end of the then-current billing period.',
        'Fees are stated in U.S. dollars, are non-refundable except as required by applicable law, and do not include taxes. Customer is responsible for all applicable sales, use, or similar taxes.',
        'Provider may change prices with at least thirty (30) (thirty) days\' prior notice; changes apply at the next renewal. Continued use after the effective date constitutes acceptance.',
        'If payment fails, Provider may suspend access after written notice. Customer Data is retained during suspension and may be permanently deleted sixty (60) days after termination.',
      ],
    },
    {
      title: '4. Customer Data and Privacy',
      body: [
        'As between the parties, Customer owns all right, title, and interest in Customer Data. Provider claims no ownership over Customer Data.',
        'Customer acts as the controller of personal information of its own clients and staff; Provider acts as a processor and will process Customer Data only to provide, secure, and support the Service, or as required by law.',
        'Provider will maintain commercially reasonable administrative, technical, and physical safeguards designed to protect Customer Data, including tenant isolation so that one customer cannot access another customer\'s data.',
        'Customer may export or request a copy of Customer Data at any time during the Term. Upon termination, Customer may request an export within thirty (30) days.',
        'Provider will not sell Customer Data and will not use Customer Data to contact Customer\'s clients for Provider\'s own commercial purposes.',
      ],
    },
    {
      title: '5. Customer Responsibilities and Acceptable Use',
      body: [
        'Customer is responsible for the accuracy of Customer Data, for all activity of its Authorized Users, and for maintaining the confidentiality of login credentials.',
        'Customer represents that it has obtained all consents required by applicable law — including the CAN-SPAM Act, the Telephone Consumer Protection Act (TCPA), and applicable state privacy laws — before using the Service to send commercial or marketing communications to its clients.',
        'Customer shall not: (a) resell, sublicense, or provide the Service to third parties as a service bureau; (b) reverse engineer, decompile, or attempt to derive the source code or underlying logic of the Service; (c) copy, replicate, or create a derivative or competing product based on the Service; (d) use the Service to violate any law or third-party right; (e) upload malicious code or attempt to breach security or access other customers\' data; (f) exceed the plan limits through technical circumvention.',
        'Customer is solely responsible for its relationship with its own clients and staff, including the services performed, employment classification, wages, insurance, licensing, and compliance with labor and consumer laws.',
      ],
    },
    {
      title: '6. Intellectual Property',
      body: [
        'Provider retains all right, title, and interest in and to the Service, including its software, source code, business logic, algorithms, database structure, interfaces, design, documentation, trademarks, and all improvements thereto. No rights are granted except as expressly stated in this Agreement.',
        'The Service, its underlying methods, and its non-public logic constitute confidential information and trade secrets of Provider.',
        'Feedback or suggestions provided by Customer may be used by Provider without restriction or compensation.',
      ],
    },
    {
      title: '7. Confidentiality',
      body: [
        'Each party may receive confidential information of the other. The receiving party will use at least reasonable care to protect such information and will not disclose it except to personnel with a need to know who are bound by comparable obligations, or as required by law with prompt notice where permitted.',
        'These obligations survive for three (3) years after termination, and indefinitely for trade secrets.',
      ],
    },
    {
      title: '8. Third-Party Services',
      body: [
        'The Service integrates third-party providers (including mapping, email delivery, artificial intelligence, and payment processing). Use of such features may be subject to the third party\'s terms. Provider is not responsible for the availability, accuracy, or acts of third-party services.',
        'Price estimates, route suggestions, market research, and other automated outputs are informational aids only. Customer is solely responsible for reviewing and approving any price, contract, or schedule before use with its clients.',
      ],
    },
    {
      title: '9. Warranty Disclaimer',
      body: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE". TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROVIDER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.',
        'Provider does not warrant that the Service will be uninterrupted, error-free, or that location, routing, or estimate features will be accurate in all circumstances.',
        'The Service is not a substitute for legal, tax, accounting, or employment advice. Document templates provided within the Service, including service agreements with Customer\'s clients, are samples and should be reviewed by a licensed attorney before use.',
      ],
    },
    {
      title: '10. Limitation of Liability',
      body: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, OR DATA, EVEN IF ADVISED OF THE POSSIBILITY.',
        'PROVIDER\'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT WILL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER TO PROVIDER IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.',
        'These limitations do not apply to Customer\'s payment obligations, either party\'s breach of confidentiality, or liability that cannot be limited under applicable law.',
      ],
    },
    {
      title: '11. Indemnification',
      body: [
        'Customer will defend, indemnify, and hold harmless Provider from third-party claims arising out of Customer Data, Customer\'s use of the Service in violation of this Agreement or law, or disputes between Customer and its own clients or staff.',
        'Provider will defend, indemnify, and hold harmless Customer from third-party claims alleging that the Service, as provided, infringes a U.S. intellectual property right, provided Customer promptly notifies Provider and permits Provider to control the defense.',
      ],
    },
    {
      title: '12. Term, Suspension and Termination',
      body: [
        'This Agreement begins on acceptance and continues on a month-to-month basis until terminated.',
        'Either party may terminate for convenience effective at the end of the current billing period. Provider may suspend or terminate immediately for non-payment after notice, for material breach not cured within ten (10) days, or for use that threatens the security or integrity of the Service.',
        'Upon termination, access ends, no further charges accrue, and Customer Data is available for export for thirty (30) days, after which it may be permanently deleted.',
      ],
    },
    {
      title: '13. Governing Law and Dispute Resolution',
      body: [
        'This Agreement is governed by the laws of the Commonwealth of Massachusetts, United States, without regard to conflict-of-law rules.',
        'The parties will first attempt to resolve any dispute in good faith for thirty (30) days. Thereafter, disputes will be resolved exclusively in the state or federal courts located in Massachusetts, and each party consents to that jurisdiction and venue.',
        'EACH PARTY WAIVES ANY RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION RELATING TO THIS AGREEMENT.',
      ],
    },
    {
      title: '14. General',
      body: [
        'Electronic acceptance: Customer consents to transact electronically. Clicking to accept has the same legal effect as a handwritten signature under the U.S. E-SIGN Act.',
        'Modifications: Provider may update this Agreement with at least thirty (30) days\' notice; continued use after the effective date constitutes acceptance. Material changes will be presented for re-acceptance.',
        'Assignment: Customer may not assign this Agreement without Provider\'s written consent. Provider may assign in connection with a merger, acquisition, or sale of assets.',
        'Force majeure, severability, no waiver, and independent contractors apply in customary terms. This Agreement, together with the plan selected, is the entire agreement between the parties and supersedes prior understandings.',
        'The English version of this Agreement controls in the event of any conflict with a translation.',
      ],
    },
  ],
};

export const TERMS_PT: { intro: string; clauses: Clause[] } = {
  intro:
    'Este Contrato de Assinatura ("Contrato") é celebrado entre a CleanFlow ("Fornecedora") e a empresa identificada no cadastro da conta ("Cliente"). Ao criar uma conta, clicar para aceitar ou usar o Serviço, a Cliente concorda em se vincular a este Contrato. Tradução de cortesia — a versão em inglês prevalece.',
  clauses: [
    {
      title: '1. Definições',
      body: [
        '"Serviço" significa a plataforma web CleanFlow para gestão de empresas de limpeza, incluindo funcionalidades, atualizações e documentação.',
        '"Dados da Cliente" significa todos os dados enviados pela Cliente ou seus usuários ao Serviço, inclusive dados dos clientes finais, da equipe, agenda e preços.',
        '"Usuários Autorizados" são funcionários, contratados ou representantes a quem a Cliente conceder acesso.',
      ],
    },
    {
      title: '2. Serviço e Licença',
      body: [
        'A Fornecedora concede à Cliente um direito limitado, não exclusivo, intransferível e revogável de acessar e usar o Serviço durante a vigência, exclusivamente para sua operação interna.',
        'O Serviço é prestado como software como serviço (SaaS). Nenhuma cópia do software é entregue ou licenciada para instalação.',
        'A Fornecedora pode modificar, melhorar ou descontinuar funcionalidades, comunicando com no mínimo 30 dias de antecedência reduções relevantes de funcionalidade essencial.',
      ],
    },
    {
      title: '3. Planos, Mensalidade e Renovação Automática',
      body: [
        'Os planos e preços são os publicados pela Fornecedora e escolhidos pela Cliente no cadastro. Nesta versão: Standard — US$ 30,00 por mês, com 1 (uma) equipe; Plus — US$ 50,00 por mês, com 2 (duas) equipes, e US$ 10,00 por mês por equipe adicional.',
        'ESTA É UMA ASSINATURA DE RENOVAÇÃO AUTOMÁTICA. A assinatura se renova mensalmente e o meio de pagamento cadastrado será cobrado a cada período até que a Cliente cancele. O cancelamento pode ser feito a qualquer momento nas configurações da conta ou por aviso escrito, com efeito ao fim do período já pago.',
        'Os valores são em dólares americanos, não reembolsáveis salvo exigência legal, e não incluem tributos, de responsabilidade da Cliente.',
        'Reajustes serão comunicados com no mínimo 30 dias de antecedência e valem na renovação seguinte. O uso continuado após a vigência implica aceitação.',
        'Em caso de falha de pagamento, o acesso pode ser suspenso após aviso. Os Dados da Cliente são preservados durante a suspensão e poderão ser excluídos definitivamente 60 dias após o encerramento.',
      ],
    },
    {
      title: '4. Dados da Cliente e Privacidade',
      body: [
        'Entre as partes, a Cliente é titular de todos os direitos sobre os Dados da Cliente. A Fornecedora não reivindica propriedade sobre eles.',
        'A Cliente atua como controladora dos dados pessoais de seus clientes e equipe; a Fornecedora atua como operadora, tratando os dados apenas para prestar, proteger e dar suporte ao Serviço, ou por exigência legal.',
        'A Fornecedora mantém salvaguardas administrativas, técnicas e físicas comercialmente razoáveis, incluindo isolamento entre contas, de modo que uma empresa não acesse dados de outra.',
        'A Cliente pode exportar ou solicitar cópia de seus dados a qualquer tempo durante a vigência e por 30 dias após o encerramento.',
        'A Fornecedora não venderá os Dados da Cliente nem os usará para contatar os clientes finais com finalidade comercial própria.',
      ],
    },
    {
      title: '5. Responsabilidades e Uso Aceitável',
      body: [
        'A Cliente é responsável pela exatidão dos dados, pela conduta de seus Usuários Autorizados e pelo sigilo das credenciais de acesso.',
        'A Cliente declara possuir todos os consentimentos exigidos por lei — inclusive CAN-SPAM Act, Telephone Consumer Protection Act (TCPA) e leis estaduais de privacidade — antes de usar o Serviço para enviar comunicações comerciais ou de marketing a seus clientes.',
        'É vedado à Cliente: (a) revender, sublicenciar ou disponibilizar o Serviço a terceiros; (b) fazer engenharia reversa, descompilar ou tentar obter o código-fonte ou a lógica do Serviço; (c) copiar, replicar ou criar produto derivado ou concorrente baseado no Serviço; (d) usar o Serviço para violar a lei ou direitos de terceiros; (e) inserir código malicioso ou tentar acessar dados de outras empresas; (f) burlar tecnicamente os limites do plano.',
        'A Cliente é a única responsável pela relação com seus clientes e sua equipe, incluindo os serviços prestados, vínculo trabalhista, salários, seguros, licenças e cumprimento das leis trabalhistas e de consumo.',
      ],
    },
    {
      title: '6. Propriedade Intelectual',
      body: [
        'A Fornecedora mantém todos os direitos sobre o Serviço, incluindo software, código-fonte, lógica de negócio, algoritmos, estrutura de banco de dados, interfaces, design, documentação, marcas e todas as melhorias. Nenhum direito é concedido além do expressamente previsto.',
        'O Serviço, seus métodos e sua lógica não pública constituem informação confidencial e segredo comercial da Fornecedora.',
        'Sugestões enviadas pela Cliente podem ser utilizadas pela Fornecedora sem restrição ou contrapartida.',
      ],
    },
    {
      title: '7. Confidencialidade',
      body: [
        'Cada parte poderá receber informações confidenciais da outra, comprometendo-se a protegê-las com cuidado razoável e a não divulgá-las, exceto a pessoal com necessidade de conhecer e obrigações equivalentes, ou por exigência legal, com aviso prévio quando permitido.',
        'As obrigações subsistem por 3 anos após o término e por prazo indeterminado quanto a segredos comerciais.',
      ],
    },
    {
      title: '8. Serviços de Terceiros',
      body: [
        'O Serviço integra fornecedores terceiros (mapas, envio de email, inteligência artificial e processamento de pagamentos), cujos termos próprios podem se aplicar. A Fornecedora não responde pela disponibilidade, exatidão ou atos desses terceiros.',
        'Estimativas de preço, sugestões de rota, pesquisas de mercado e demais resultados automatizados são apenas apoio informativo. A Cliente é a única responsável por revisar e aprovar qualquer preço, contrato ou agenda antes de usar com seus clientes.',
      ],
    },
    {
      title: '9. Isenção de Garantias',
      body: [
        'O SERVIÇO É FORNECIDO "NO ESTADO EM QUE SE ENCONTRA" E "CONFORME DISPONÍVEL". NA MÁXIMA EXTENSÃO PERMITIDA EM LEI, A FORNECEDORA EXCLUI TODAS AS GARANTIAS, EXPRESSAS OU IMPLÍCITAS.',
        'Não se garante operação ininterrupta ou isenta de erros, nem exatidão absoluta das funções de localização, roteirização ou estimativa.',
        'O Serviço não substitui assessoria jurídica, tributária, contábil ou trabalhista. Os modelos de documentos disponibilizados, inclusive contratos com os clientes finais, são exemplos e devem ser revisados por advogado licenciado antes do uso.',
      ],
    },
    {
      title: '10. Limitação de Responsabilidade',
      body: [
        'NA MÁXIMA EXTENSÃO PERMITIDA EM LEI, NENHUMA PARTE RESPONDERÁ POR DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS, NEM POR LUCROS CESSANTES, RECEITA OU PERDA DE DADOS.',
        'A RESPONSABILIDADE TOTAL DA FORNECEDORA NÃO EXCEDERÁ OS VALORES PAGOS PELA CLIENTE NOS 12 MESES ANTERIORES AO FATO GERADOR.',
        'Estas limitações não se aplicam às obrigações de pagamento da Cliente, à violação de confidencialidade ou ao que a lei não permitir limitar.',
      ],
    },
    {
      title: '11. Indenização',
      body: [
        'A Cliente defenderá e indenizará a Fornecedora contra reclamações de terceiros decorrentes dos Dados da Cliente, do uso em desacordo com este Contrato ou com a lei, e de disputas com seus próprios clientes ou equipe.',
        'A Fornecedora defenderá e indenizará a Cliente contra reclamações de que o Serviço, tal como fornecido, viola direito de propriedade intelectual nos EUA, desde que notificada prontamente e com o controle da defesa.',
      ],
    },
    {
      title: '12. Vigência, Suspensão e Rescisão',
      body: [
        'Este Contrato vigora a partir do aceite, mês a mês, até ser rescindido.',
        'Qualquer parte pode rescindir por conveniência, com efeito ao fim do período vigente. A Fornecedora pode suspender ou rescindir de imediato por inadimplência após aviso, por violação relevante não sanada em 10 dias, ou por uso que ameace a segurança do Serviço.',
        'Com o término, o acesso cessa, não há novas cobranças e os dados ficam disponíveis para exportação por 30 dias, podendo depois ser excluídos definitivamente.',
      ],
    },
    {
      title: '13. Lei Aplicável e Foro',
      body: [
        'Este Contrato é regido pelas leis do Estado de Massachusetts, Estados Unidos.',
        'As partes tentarão solucionar disputas de boa-fé por 30 dias. Após esse prazo, as disputas serão resolvidas exclusivamente nos tribunais estaduais ou federais de Massachusetts, com consentimento expresso quanto à jurisdição e ao foro.',
        'AS PARTES RENUNCIAM AO JULGAMENTO POR JÚRI E À PARTICIPAÇÃO EM AÇÕES COLETIVAS RELATIVAS A ESTE CONTRATO.',
      ],
    },
    {
      title: '14. Disposições Gerais',
      body: [
        'Aceite eletrônico: a Cliente consente em contratar por meio eletrônico. O clique de aceite tem o mesmo efeito jurídico de assinatura manuscrita, nos termos do E-SIGN Act dos EUA.',
        'Alterações: a Fornecedora pode atualizar este Contrato com aviso de no mínimo 30 dias; o uso continuado implica aceitação, e alterações relevantes serão submetidas a novo aceite.',
        'Cessão: a Cliente não pode ceder este Contrato sem consentimento escrito. A Fornecedora pode cedê-lo em caso de fusão, aquisição ou venda de ativos.',
        'Aplicam-se, nos termos usuais, cláusulas de caso fortuito, autonomia das disposições, não renúncia e independência das partes. Este Contrato, junto com o plano contratado, constitui o acordo integral entre as partes.',
        'Em caso de conflito entre versões, prevalece o texto em inglês.',
      ],
    },
  ],
};
