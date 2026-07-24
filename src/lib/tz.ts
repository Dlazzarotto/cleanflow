/**
 * Helpers de fuso horario da operacao.
 * A empresa opera em America/New_York; o banco grava em UTC.
 * Em fases futuras, o TZ pode vir da tabela companies.
 */
export const COMPANY_TZ = 'America/New_York';

/** Data de "hoje" no fuso da empresa, em YYYY-MM-DD */
export function todayEt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TZ }).format(new Date());
}

/** Converte data+hora locais da empresa (YYYY-MM-DD, HH:MM) para ISO UTC */
export function etToUtcIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: COMPANY_TZ, timeZoneName: 'longOffset' })
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  const m = tzName.match(/GMT([+-]\d{2}):(\d{2})/);
  const hours = m ? Number(m[1]) : -5;
  const minutes = m ? Number(m[2]) : 0;
  const offMin = hours * 60 + Math.sign(hours) * minutes;
  return new Date(guess.getTime() - offMin * 60000).toISOString();
}

/** Soma dias a uma data YYYY-MM-DD sem efeitos de DST */
export function addDaysYmd(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inicio e fim do dia de hoje (fuso da empresa), em ISO UTC */
export function etTodayRange(): { start: string; end: string } {
  const d = todayEt();
  return { start: etToUtcIso(d, '00:00'), end: etToUtcIso(addDaysYmd(d, 1), '00:00') };
}

/** Inicio do mes atual (fuso da empresa), em ISO UTC */
export function etMonthStart(): string {
  return etToUtcIso(`${todayEt().slice(0, 7)}-01`, '00:00');
}
