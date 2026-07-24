/**
 * Traducoes dos documentos voltados ao cliente final:
 * documento de estimate, contrato e email — PT, EN, ES, FR.
 */

export type DocLang = 'pt' | 'en' | 'es' | 'fr';

export const DOC_LANGS: { code: DocLang; label: string }[] = [
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
];

export const FREQ: Record<DocLang, Record<string, string>> = {
  pt: { unica: 'Limpeza única', semanal: 'Semanal', quinzenal: 'Quinzenal (a cada 2 semanas)', mensal: 'Mensal (a cada 4 semanas)', indef: 'A definir' },
  en: { unica: 'One-time cleaning', semanal: 'Weekly', quinzenal: 'Bi-weekly (every 2 weeks)', mensal: 'Monthly (every 4 weeks)', indef: 'To be defined' },
  es: { unica: 'Limpieza única', semanal: 'Semanal', quinzenal: 'Quincenal (cada 2 semanas)', mensal: 'Mensual (cada 4 semanas)', indef: 'Por definir' },
  fr: { unica: 'Nettoyage unique', semanal: 'Hebdomadaire', quinzenal: 'Bimensuel (toutes les 2 semaines)', mensal: 'Mensuel (toutes les 4 semaines)', indef: 'À définir' },
};

// ---------- Servicos (lista do estimate/anexo do contrato) ----------
type Dict = Record<string, string>;

export const SERVICE_I18N: Record<DocLang, {
  bedrooms: (n: number) => string;
  fullBaths: (n: number) => string;
  halfBaths: (n: number) => string;
  halfBathItem: string;
  laundryTitle: string;
  laundryItem: (loads: number) => string;
  deepTitle: string;
  deepItem: string;
  rooms: Dict;
  tasks: Dict; // chave: `${escopo}.${id}`
}> = {
  pt: {
    bedrooms: (n) => `Quartos (${n})`,
    fullBaths: (n) => `Banheiros completos (${n})`,
    halfBaths: (n) => `Lavabos (${n})`,
    halfBathItem: 'Limpeza completa',
    laundryTitle: '🧺 Laundry',
    laundryItem: (l) => `Lavar e dobrar roupa — até ${l} carga(s) por visita`,
    deepTitle: '✨ Deep cleaning',
    deepItem: 'Primeira limpeza em profundidade',
    rooms: { cozinha: 'Cozinha', sala: 'Sala / estar', escritorio: 'Escritório', porao: 'Porão / basement', area_servico: 'Área de serviço', escadas_corredores: 'Escadas e corredores' },
    tasks: {
      'bed.aspirar': 'Aspirar / varrer', 'bed.po': 'Tirar pó', 'bed.cama': 'Trocar roupa de cama', 'bed.espelhos': 'Limpar espelhos', 'bed.organizar': 'Organizar o ambiente', 'bed.janelas': 'Janelas por dentro',
      'bath.vaso': 'Vaso sanitário', 'bath.box': 'Box / banheira', 'bath.pia': 'Pia e bancada', 'bath.espelho': 'Espelho', 'bath.chao': 'Chão', 'bath.rejunte': 'Rejunte / detalhes',
      'cozinha.fogao': 'Fogão / cooktop', 'cozinha.pia': 'Pia', 'cozinha.bancadas': 'Bancadas', 'cozinha.micro': 'Micro-ondas (dentro e fora)', 'cozinha.geladeira_fora': 'Geladeira por fora', 'cozinha.geladeira_dentro': 'Geladeira por dentro', 'cozinha.armarios': 'Armários por fora', 'cozinha.forno': 'Forno por dentro', 'cozinha.chao': 'Chão',
      'sala.aspirar': 'Aspirar / varrer', 'sala.po': 'Tirar pó', 'sala.sofas': 'Aspirar sofás', 'sala.organizar': 'Organizar',
      'escritorio.geral': 'Limpeza geral', 'porao.geral': 'Limpeza geral', 'area_servico.geral': 'Limpeza geral', 'escadas_corredores.geral': 'Aspirar e tirar pó',
    },
  },
  en: {
    bedrooms: (n) => `Bedrooms (${n})`,
    fullBaths: (n) => `Full bathrooms (${n})`,
    halfBaths: (n) => `Half baths (${n})`,
    halfBathItem: 'Full cleaning',
    laundryTitle: '🧺 Laundry',
    laundryItem: (l) => `Wash and fold — up to ${l} load(s) per visit`,
    deepTitle: '✨ Deep cleaning',
    deepItem: 'Thorough first-time cleaning',
    rooms: { cozinha: 'Kitchen', sala: 'Living room', escritorio: 'Office', porao: 'Basement', area_servico: 'Laundry room', escadas_corredores: 'Stairs and hallways' },
    tasks: {
      'bed.aspirar': 'Vacuum / sweep', 'bed.po': 'Dusting', 'bed.cama': 'Change bed linens', 'bed.espelhos': 'Clean mirrors', 'bed.organizar': 'Tidy up', 'bed.janelas': 'Interior windows',
      'bath.vaso': 'Toilet', 'bath.box': 'Shower / tub', 'bath.pia': 'Sink and counter', 'bath.espelho': 'Mirror', 'bath.chao': 'Floor', 'bath.rejunte': 'Grout / details',
      'cozinha.fogao': 'Stove / cooktop', 'cozinha.pia': 'Sink', 'cozinha.bancadas': 'Countertops', 'cozinha.micro': 'Microwave (inside and out)', 'cozinha.geladeira_fora': 'Fridge exterior', 'cozinha.geladeira_dentro': 'Fridge interior', 'cozinha.armarios': 'Cabinet exteriors', 'cozinha.forno': 'Oven interior', 'cozinha.chao': 'Floor',
      'sala.aspirar': 'Vacuum / sweep', 'sala.po': 'Dusting', 'sala.sofas': 'Vacuum sofas', 'sala.organizar': 'Tidy up',
      'escritorio.geral': 'General cleaning', 'porao.geral': 'General cleaning', 'area_servico.geral': 'General cleaning', 'escadas_corredores.geral': 'Vacuum and dust',
    },
  },
  es: {
    bedrooms: (n) => `Habitaciones (${n})`,
    fullBaths: (n) => `Baños completos (${n})`,
    halfBaths: (n) => `Medios baños (${n})`,
    halfBathItem: 'Limpieza completa',
    laundryTitle: '🧺 Lavandería',
    laundryItem: (l) => `Lavar y doblar ropa — hasta ${l} carga(s) por visita`,
    deepTitle: '✨ Limpieza profunda',
    deepItem: 'Primera limpieza a fondo',
    rooms: { cozinha: 'Cocina', sala: 'Sala de estar', escritorio: 'Oficina', porao: 'Sótano', area_servico: 'Cuarto de lavado', escadas_corredores: 'Escaleras y pasillos' },
    tasks: {
      'bed.aspirar': 'Aspirar / barrer', 'bed.po': 'Quitar el polvo', 'bed.cama': 'Cambiar sábanas', 'bed.espelhos': 'Limpiar espejos', 'bed.organizar': 'Ordenar', 'bed.janelas': 'Ventanas por dentro',
      'bath.vaso': 'Inodoro', 'bath.box': 'Ducha / bañera', 'bath.pia': 'Lavabo y encimera', 'bath.espelho': 'Espejo', 'bath.chao': 'Piso', 'bath.rejunte': 'Juntas / detalles',
      'cozinha.fogao': 'Estufa / cocina', 'cozinha.pia': 'Fregadero', 'cozinha.bancadas': 'Encimeras', 'cozinha.micro': 'Microondas (por dentro y fuera)', 'cozinha.geladeira_fora': 'Refrigerador por fuera', 'cozinha.geladeira_dentro': 'Refrigerador por dentro', 'cozinha.armarios': 'Gabinetes por fuera', 'cozinha.forno': 'Horno por dentro', 'cozinha.chao': 'Piso',
      'sala.aspirar': 'Aspirar / barrer', 'sala.po': 'Quitar el polvo', 'sala.sofas': 'Aspirar sofás', 'sala.organizar': 'Ordenar',
      'escritorio.geral': 'Limpieza general', 'porao.geral': 'Limpieza general', 'area_servico.geral': 'Limpieza general', 'escadas_corredores.geral': 'Aspirar y quitar polvo',
    },
  },
  fr: {
    bedrooms: (n) => `Chambres (${n})`,
    fullBaths: (n) => `Salles de bain complètes (${n})`,
    halfBaths: (n) => `Toilettes (${n})`,
    halfBathItem: 'Nettoyage complet',
    laundryTitle: '🧺 Lessive',
    laundryItem: (l) => `Laver et plier le linge — jusqu'à ${l} charge(s) par visite`,
    deepTitle: '✨ Nettoyage en profondeur',
    deepItem: 'Premier nettoyage approfondi',
    rooms: { cozinha: 'Cuisine', sala: 'Salon', escritorio: 'Bureau', porao: 'Sous-sol', area_servico: 'Buanderie', escadas_corredores: 'Escaliers et couloirs' },
    tasks: {
      'bed.aspirar': 'Aspirer / balayer', 'bed.po': 'Dépoussiérer', 'bed.cama': 'Changer les draps', 'bed.espelhos': 'Nettoyer les miroirs', 'bed.organizar': 'Ranger', 'bed.janelas': "Vitres à l'intérieur",
      'bath.vaso': 'Toilettes', 'bath.box': 'Douche / baignoire', 'bath.pia': 'Lavabo et plan', 'bath.espelho': 'Miroir', 'bath.chao': 'Sol', 'bath.rejunte': 'Joints / détails',
      'cozinha.fogao': 'Cuisinière', 'cozinha.pia': 'Évier', 'cozinha.bancadas': 'Plans de travail', 'cozinha.micro': 'Micro-ondes (intérieur et extérieur)', 'cozinha.geladeira_fora': "Réfrigérateur à l'extérieur", 'cozinha.geladeira_dentro': "Réfrigérateur à l'intérieur", 'cozinha.armarios': "Placards à l'extérieur", 'cozinha.forno': 'Four intérieur', 'cozinha.chao': 'Sol',
      'sala.aspirar': 'Aspirer / balayer', 'sala.po': 'Dépoussiérer', 'sala.sofas': 'Aspirer les canapés', 'sala.organizar': 'Ranger',
      'escritorio.geral': 'Nettoyage général', 'porao.geral': 'Nettoyage général', 'area_servico.geral': 'Nettoyage général', 'escadas_corredores.geral': 'Aspirer et dépoussiérer',
    },
  },
};

// ---------- Documento do estimate ----------
export const ESTIMATE_I18N: Record<DocLang, {
  title: string; date: string; validUntil: string; preparedFor: string;
  services: string; frequency: string; timePerVisit: string; investment: string;
  conditionsTitle: string; conditions: string[];
}> = {
  pt: {
    title: 'ESTIMATE', date: 'Data', validUntil: 'Válido até', preparedFor: 'Preparado para:',
    services: 'Serviços incluídos', frequency: 'Frequência', timePerVisit: 'Tempo estimado por visita', investment: 'Investimento por limpeza',
    conditionsTitle: 'Condições:',
    conditions: [
      'Este estimate cobre exclusivamente os serviços listados acima.',
      'Serviços adicionais devem ser solicitados à empresa e passarão por um novo estimate — a equipe em campo não está autorizada a aceitar serviços extras.',
      'Valores válidos por 30 dias a partir da data de emissão.',
      'O tempo estimado pode variar conforme as condições do imóvel na primeira visita.',
    ],
  },
  en: {
    title: 'ESTIMATE', date: 'Date', validUntil: 'Valid until', preparedFor: 'Prepared for:',
    services: 'Services included', frequency: 'Frequency', timePerVisit: 'Estimated time per visit', investment: 'Investment per cleaning',
    conditionsTitle: 'Terms:',
    conditions: [
      'This estimate covers only the services listed above.',
      'Additional services must be requested through the company and will require a new estimate — field staff are not authorized to accept extra services.',
      'Prices are valid for 30 days from the issue date.',
      'Estimated time may vary depending on the condition of the home at the first visit.',
    ],
  },
  es: {
    title: 'PRESUPUESTO', date: 'Fecha', validUntil: 'Válido hasta', preparedFor: 'Preparado para:',
    services: 'Servicios incluidos', frequency: 'Frecuencia', timePerVisit: 'Tiempo estimado por visita', investment: 'Inversión por limpieza',
    conditionsTitle: 'Condiciones:',
    conditions: [
      'Este presupuesto cubre exclusivamente los servicios listados arriba.',
      'Los servicios adicionales deben solicitarse a la empresa y requerirán un nuevo presupuesto — el personal en campo no está autorizado a aceptar servicios extra.',
      'Precios válidos por 30 días desde la fecha de emisión.',
      'El tiempo estimado puede variar según las condiciones de la vivienda en la primera visita.',
    ],
  },
  fr: {
    title: 'DEVIS', date: 'Date', validUntil: "Valable jusqu'au", preparedFor: 'Préparé pour :',
    services: 'Services inclus', frequency: 'Fréquence', timePerVisit: 'Durée estimée par visite', investment: 'Investissement par nettoyage',
    conditionsTitle: 'Conditions :',
    conditions: [
      'Ce devis couvre exclusivement les services listés ci-dessus.',
      "Les services supplémentaires doivent être demandés à l'entreprise et feront l'objet d'un nouveau devis — le personnel sur place n'est pas autorisé à accepter des services supplémentaires.",
      "Prix valables 30 jours à compter de la date d'émission.",
      "La durée estimée peut varier selon l'état du logement lors de la première visite.",
    ],
  },
};

// ---------- Contrato ----------
export interface ContractParams {
  companyName: string;
  companyInfo: string; // endereco/telefone/email ja formatados
  clientName: string;
  clientAddress: string;
  freq: string;
  time: string;
  price: string;
  cancelHours: number;
  lockoutFee: string;
  terminationDays: number;
  solicitationFee: string;
}

export const CONTRACT_I18N: Record<DocLang, {
  title: string;
  preamble: (p: ContractParams) => string;
  clauses: { title: string; body: (p: ContractParams) => string }[];
  annexTitle: string;
  contractor: string;
  client: string;
  dateSig: string;
  disclaimer: string;
}> = {
  pt: {
    title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE LIMPEZA RESIDENCIAL',
    preamble: (p) => `Pelo presente instrumento, de um lado ${p.companyName}${p.companyInfo}, doravante denominada CONTRATADA; e de outro lado ${p.clientName}, com imóvel localizado em ${p.clientAddress}, doravante denominado(a) CONTRATANTE; têm entre si justo e acordado o que segue:`,
    clauses: [
      { title: 'CLÁUSULA 1 — OBJETO', body: () => 'A CONTRATADA prestará serviços de limpeza residencial no imóvel indicado acima, limitados exclusivamente aos serviços descritos no Anexo A deste contrato, elaborado a partir do estimate aprovado pelo(a) CONTRATANTE.' },
      { title: 'CLÁUSULA 2 — RECORRÊNCIA E AGENDAMENTO', body: (p) => `Os serviços serão prestados com frequência ${p.freq}, em dia e horário acordados entre as partes. A CONTRATADA dimensiona livremente a equipe para a execução do serviço contratado.` },
      { title: 'CLÁUSULA 3 — PREÇO E PAGAMENTO', body: (p) => `O valor por limpeza é de ${p.price}, devido ao término de cada visita, pelos meios de pagamento disponibilizados pela CONTRATADA. Reajustes serão comunicados com no mínimo 30 dias de antecedência.` },
      { title: 'CLÁUSULA 4 — CANCELAMENTO E REMARCAÇÃO', body: (p) => `O cancelamento ou a remarcação de uma visita deve ser comunicado com antecedência mínima de ${p.cancelHours} horas. Caso a equipe compareça e não consiga acesso ao imóvel, será devida uma taxa de comparecimento (lockout fee) de ${p.lockoutFee}.` },
      { title: 'CLÁUSULA 5 — SERVIÇOS ADICIONAIS', body: () => 'Qualquer serviço não descrito no Anexo A deverá ser solicitado diretamente à CONTRATADA, que elaborará novo estimate para aprovação prévia. As profissionais em campo não estão autorizadas a negociar, aceitar ou executar serviços fora do escopo contratado.' },
      { title: 'CLÁUSULA 6 — NÃO ALICIAMENTO DE PROFISSIONAIS', body: (p) => `O(A) CONTRATANTE compromete-se a não contratar, aliciar ou negociar diretamente com qualquer profissional da CONTRATADA durante a vigência deste contrato e por 12 meses após seu término, sob pena de multa compensatória de ${p.solicitationFee}.` },
      { title: 'CLÁUSULA 7 — VIGÊNCIA E RESCISÃO', body: (p) => `Este contrato vigora por prazo indeterminado. Qualquer das partes pode rescindi-lo, sem penalidade, mediante aviso prévio por escrito de ${p.terminationDays} dias. Visitas já agendadas dentro do aviso permanecem devidas.` },
      { title: 'CLÁUSULA 8 — ACESSO, CHAVES E ALARMES', body: () => 'O(A) CONTRATANTE garantirá o acesso da equipe nos horários agendados, fornecendo chaves, códigos ou instruções de alarme quando necessário. A CONTRATADA manterá tais informações sob confidencialidade.' },
      { title: 'CLÁUSULA 9 — DISPOSIÇÕES GERAIS', body: () => 'Danos comprovadamente causados pela equipe devem ser comunicados em até 48 horas após a visita. Este contrato é regido pelas leis do Estado de Massachusetts, Estados Unidos.' },
    ],
    annexTitle: 'ANEXO A — ESCOPO DOS SERVIÇOS',
    contractor: 'CONTRATADA', client: 'CONTRATANTE', dateSig: 'Data: ____/____/______',
    disclaimer: '⚠️ Modelo gerado automaticamente. Recomendamos revisão por advogado licenciado antes do uso.',
  },
  en: {
    title: 'RESIDENTIAL CLEANING SERVICES AGREEMENT',
    preamble: (p) => `This Agreement is entered into between ${p.companyName}${p.companyInfo}, hereinafter the "COMPANY"; and ${p.clientName}, with property located at ${p.clientAddress}, hereinafter the "CLIENT"; who agree as follows:`,
    clauses: [
      { title: 'SECTION 1 — SCOPE', body: () => 'The COMPANY will provide residential cleaning services at the property above, strictly limited to the services described in Exhibit A of this Agreement, based on the estimate approved by the CLIENT.' },
      { title: 'SECTION 2 — RECURRENCE AND SCHEDULING', body: (p) => `Services will be provided on a ${p.freq} basis, on days and times agreed by the parties. The COMPANY may freely size its team to perform the contracted services.` },
      { title: 'SECTION 3 — PRICE AND PAYMENT', body: (p) => `The price per cleaning is ${p.price}, due upon completion of each visit through the payment methods provided by the COMPANY. Price changes will be communicated at least 30 days in advance.` },
      { title: 'SECTION 4 — CANCELLATION AND RESCHEDULING', body: (p) => `Cancellations or rescheduling must be communicated at least ${p.cancelHours} hours in advance. If the team arrives and cannot access the property, a lockout fee of ${p.lockoutFee} will apply.` },
      { title: 'SECTION 5 — ADDITIONAL SERVICES', body: () => 'Any service not described in Exhibit A must be requested directly from the COMPANY, which will prepare a new estimate for prior approval. Field staff are not authorized to negotiate, accept, or perform services outside the contracted scope.' },
      { title: 'SECTION 6 — NON-SOLICITATION OF STAFF', body: (p) => `The CLIENT agrees not to hire, solicit, or deal directly with any COMPANY professional during this Agreement and for 12 months after its termination, subject to liquidated damages of ${p.solicitationFee}.` },
      { title: 'SECTION 7 — TERM AND TERMINATION', body: (p) => `This Agreement remains in force indefinitely. Either party may terminate it without penalty with ${p.terminationDays} days' prior written notice. Visits already scheduled within the notice period remain due.` },
      { title: 'SECTION 8 — ACCESS, KEYS AND ALARMS', body: () => 'The CLIENT will ensure team access at scheduled times, providing keys, codes, or alarm instructions when needed. The COMPANY will keep such information confidential.' },
      { title: 'SECTION 9 — GENERAL PROVISIONS', body: () => 'Damage attributable to the team must be reported within 48 hours after the visit. This Agreement is governed by the laws of the Commonwealth of Massachusetts, United States.' },
    ],
    annexTitle: 'EXHIBIT A — SCOPE OF SERVICES',
    contractor: 'COMPANY', client: 'CLIENT', dateSig: 'Date: ____/____/______',
    disclaimer: '⚠️ Automatically generated template. We recommend review by a licensed attorney before use.',
  },
  es: {
    title: 'CONTRATO DE SERVICIOS DE LIMPIEZA RESIDENCIAL',
    preamble: (p) => `Por el presente instrumento, de una parte ${p.companyName}${p.companyInfo}, en adelante la "CONTRATADA"; y de otra parte ${p.clientName}, con inmueble ubicado en ${p.clientAddress}, en adelante el/la "CONTRATANTE"; acuerdan lo siguiente:`,
    clauses: [
      { title: 'CLÁUSULA 1 — OBJETO', body: () => 'La CONTRATADA prestará servicios de limpieza residencial en el inmueble indicado, limitados exclusivamente a los servicios descritos en el Anexo A, elaborado a partir del presupuesto aprobado por el/la CONTRATANTE.' },
      { title: 'CLÁUSULA 2 — RECURRENCIA Y AGENDAMIENTO', body: (p) => `Los servicios se prestarán con frecuencia ${p.freq}, en días y horarios acordados. La CONTRATADA dimensiona libremente su equipo para ejecutar los servicios contratados.` },
      { title: 'CLÁUSULA 3 — PRECIO Y PAGO', body: (p) => `El valor por limpieza es de ${p.price}, pagadero al término de cada visita por los medios dispuestos por la CONTRATADA. Los ajustes se comunicarán con al menos 30 días de antelación.` },
      { title: 'CLÁUSULA 4 — CANCELACIÓN Y REPROGRAMACIÓN', body: (p) => `La cancelación o reprogramación debe comunicarse con al menos ${p.cancelHours} horas de antelación. Si el equipo acude y no logra acceso al inmueble, se aplicará una tarifa (lockout fee) de ${p.lockoutFee}.` },
      { title: 'CLÁUSULA 5 — SERVICIOS ADICIONALES', body: () => 'Todo servicio no descrito en el Anexo A deberá solicitarse directamente a la CONTRATADA, que elaborará un nuevo presupuesto para aprobación previa. El personal en campo no está autorizado a negociar, aceptar o ejecutar servicios fuera del alcance contratado.' },
      { title: 'CLÁUSULA 6 — NO CAPTACIÓN DE PERSONAL', body: (p) => `El/la CONTRATANTE se compromete a no contratar, captar ni negociar directamente con profesionales de la CONTRATADA durante la vigencia del contrato y por 12 meses tras su término, bajo pena de multa compensatoria de ${p.solicitationFee}.` },
      { title: 'CLÁUSULA 7 — VIGENCIA Y TERMINACIÓN', body: (p) => `Este contrato rige por plazo indefinido. Cualquiera de las partes puede terminarlo, sin penalidad, con aviso previo por escrito de ${p.terminationDays} días. Las visitas ya agendadas dentro del aviso permanecen debidas.` },
      { title: 'CLÁUSULA 8 — ACCESO, LLAVES Y ALARMAS', body: () => 'El/la CONTRATANTE garantizará el acceso del equipo en los horarios agendados, proporcionando llaves, códigos o instrucciones de alarma cuando sea necesario. La CONTRATADA mantendrá dicha información en confidencialidad.' },
      { title: 'CLÁUSULA 9 — DISPOSICIONES GENERALES', body: () => 'Los daños comprobadamente causados por el equipo deben comunicarse dentro de las 48 horas posteriores a la visita. Este contrato se rige por las leyes del Estado de Massachusetts, Estados Unidos.' },
    ],
    annexTitle: 'ANEXO A — ALCANCE DE LOS SERVICIOS',
    contractor: 'CONTRATADA', client: 'CONTRATANTE', dateSig: 'Fecha: ____/____/______',
    disclaimer: '⚠️ Modelo generado automáticamente. Recomendamos revisión por abogado licenciado antes de usar.',
  },
  fr: {
    title: 'CONTRAT DE SERVICES DE NETTOYAGE RÉSIDENTIEL',
    preamble: (p) => `Le présent contrat est conclu entre ${p.companyName}${p.companyInfo}, ci-après « LE PRESTATAIRE » ; et ${p.clientName}, dont le logement est situé au ${p.clientAddress}, ci-après « LE CLIENT » ; qui conviennent de ce qui suit :`,
    clauses: [
      { title: 'ARTICLE 1 — OBJET', body: () => "LE PRESTATAIRE fournira des services de nettoyage résidentiel dans le logement indiqué, strictement limités aux services décrits à l'Annexe A du présent contrat, établie à partir du devis approuvé par LE CLIENT." },
      { title: 'ARTICLE 2 — RÉCURRENCE ET PLANIFICATION', body: (p) => `Les services seront fournis à une fréquence ${p.freq}, aux jours et horaires convenus. LE PRESTATAIRE dimensionne librement son équipe pour exécuter les services convenus.` },
      { title: 'ARTICLE 3 — PRIX ET PAIEMENT', body: (p) => `Le prix par nettoyage est de ${p.price}, dû à la fin de chaque visite par les moyens de paiement proposés par LE PRESTATAIRE. Toute révision de prix sera communiquée au moins 30 jours à l'avance.` },
      { title: 'ARTICLE 4 — ANNULATION ET REPORT', body: (p) => `Toute annulation ou report doit être communiqué au moins ${p.cancelHours} heures à l'avance. Si l'équipe se présente sans pouvoir accéder au logement, des frais de déplacement (lockout fee) de ${p.lockoutFee} seront dus.` },
      { title: 'ARTICLE 5 — SERVICES SUPPLÉMENTAIRES', body: () => "Tout service non décrit à l'Annexe A doit être demandé directement au PRESTATAIRE, qui établira un nouveau devis pour approbation préalable. Le personnel sur place n'est pas autorisé à négocier, accepter ou exécuter des services hors du périmètre contractuel." },
      { title: 'ARTICLE 6 — NON-SOLLICITATION DU PERSONNEL', body: (p) => `LE CLIENT s'engage à ne pas embaucher, solliciter ni traiter directement avec le personnel du PRESTATAIRE pendant la durée du contrat et pendant 12 mois après sa fin, sous peine d'une indemnité forfaitaire de ${p.solicitationFee}.` },
      { title: 'ARTICLE 7 — DURÉE ET RÉSILIATION', body: (p) => `Le présent contrat est conclu pour une durée indéterminée. Chaque partie peut le résilier, sans pénalité, moyennant un préavis écrit de ${p.terminationDays} jours. Les visites déjà planifiées pendant le préavis restent dues.` },
      { title: 'ARTICLE 8 — ACCÈS, CLÉS ET ALARMES', body: () => "LE CLIENT garantira l'accès de l'équipe aux horaires convenus, en fournissant clés, codes ou instructions d'alarme si nécessaire. LE PRESTATAIRE gardera ces informations confidentielles." },
      { title: 'ARTICLE 9 — DISPOSITIONS GÉNÉRALES', body: () => "Tout dommage imputable à l'équipe doit être signalé dans les 48 heures suivant la visite. Le présent contrat est régi par les lois du Commonwealth du Massachusetts, États-Unis." },
    ],
    annexTitle: 'ANNEXE A — PÉRIMÈTRE DES SERVICES',
    contractor: 'LE PRESTATAIRE', client: 'LE CLIENT', dateSig: 'Date : ____/____/______',
    disclaimer: "⚠️ Modèle généré automatiquement. Nous recommandons une revue par un avocat agréé avant utilisation.",
  },
};

// ---------- Email ----------
export const EMAIL_I18N: Record<DocLang, {
  subject: (company: string) => string;
  tagline: string;
  hello: (name: string) => string;
  intro: (address: string) => string;
  frequency: string;
  time: string;
  investment: string;
  validity: (date: string) => string;
  reply: (phone: string) => string;
  regards: string;
}> = {
  pt: {
    subject: (c) => `Estimate de limpeza — ${c}`,
    tagline: 'Estimate de serviços de limpeza',
    hello: (n) => `Olá, ${n}!`,
    intro: (a) => `Segue o estimate preparado para o imóvel${a ? ` em ${a}` : ''}:`,
    frequency: 'Frequência', time: 'Tempo estimado por visita', investment: 'Investimento por limpeza',
    validity: (d) => `Este estimate cobre exclusivamente os serviços listados e é válido até ${d}. Serviços adicionais exigem um novo estimate.`,
    reply: (p) => `Para aprovar ou tirar dúvidas, é só responder este email${p ? ` ou falar conosco: ${p}` : ''}.`,
    regards: 'Atenciosamente,',
  },
  en: {
    subject: (c) => `Cleaning estimate — ${c}`,
    tagline: 'Cleaning services estimate',
    hello: (n) => `Hi ${n},`,
    intro: (a) => `Here is the estimate prepared for your home${a ? ` at ${a}` : ''}:`,
    frequency: 'Frequency', time: 'Estimated time per visit', investment: 'Investment per cleaning',
    validity: (d) => `This estimate covers only the services listed and is valid until ${d}. Additional services require a new estimate.`,
    reply: (p) => `To approve or ask questions, just reply to this email${p ? ` or reach us at ${p}` : ''}.`,
    regards: 'Best regards,',
  },
  es: {
    subject: (c) => `Presupuesto de limpieza — ${c}`,
    tagline: 'Presupuesto de servicios de limpieza',
    hello: (n) => `¡Hola, ${n}!`,
    intro: (a) => `Le enviamos el presupuesto preparado para su vivienda${a ? ` en ${a}` : ''}:`,
    frequency: 'Frecuencia', time: 'Tiempo estimado por visita', investment: 'Inversión por limpieza',
    validity: (d) => `Este presupuesto cubre exclusivamente los servicios listados y es válido hasta el ${d}. Los servicios adicionales requieren un nuevo presupuesto.`,
    reply: (p) => `Para aprobar o resolver dudas, responda este correo${p ? ` o contáctenos: ${p}` : ''}.`,
    regards: 'Atentamente,',
  },
  fr: {
    subject: (c) => `Devis de nettoyage — ${c}`,
    tagline: 'Devis de services de nettoyage',
    hello: (n) => `Bonjour ${n},`,
    intro: (a) => `Voici le devis préparé pour votre logement${a ? ` au ${a}` : ''} :`,
    frequency: 'Fréquence', time: 'Durée estimée par visite', investment: 'Investissement par nettoyage',
    validity: (d) => `Ce devis couvre exclusivement les services listés et est valable jusqu'au ${d}. Tout service supplémentaire nécessite un nouveau devis.`,
    reply: (p) => `Pour approuver ou poser vos questions, répondez simplement à cet email${p ? ` ou contactez-nous : ${p}` : ''}.`,
    regards: 'Cordialement,',
  },
};

export function normalizeLang(l: string | null | undefined): DocLang {
  return (['pt', 'en', 'es', 'fr'] as const).includes(l as DocLang) ? (l as DocLang) : 'pt';
}
