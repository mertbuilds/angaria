// Calendar helpers. GİB and TCMB work in Turkish time (Europe/Istanbul, UTC+3
// all year), so "today" and response timestamps are taken there, never in the
// host's time zone.

/** A calendar day without a time zone. `month` is 1-12. */
export interface Day {
  day: number;
  month: number;
  year: number;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

const istanbulFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
});

function istanbulParts(date: Date) {
  const parts: Record<string, number> = {};
  for (const { type, value } of istanbulFormat.formatToParts(date)) {
    parts[type] = Number(value);
  }
  return parts;
}

export function istanbulDay(date: Date): Day {
  const { day, month, year } = istanbulParts(date);
  return { day, month, year };
}

/** Minutes since midnight in Turkish time. */
export function istanbulMinutes(date: Date): number {
  const { hour, minute } = istanbulParts(date);
  return hour * 60 + minute;
}

/** GİB's `metadata.optime`: yyyyMMddHHmmss in Turkish time. */
export function optime(date: Date): string {
  const { day, hour, minute, month, second, year } = istanbulParts(date);
  return `${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${pad(second)}`;
}

/** Days since 1970-01-01. */
export const dayNumber = ({ day, month, year }: Day) => Date.UTC(year, month - 1, day) / 86_400_000;

function fromDayNumber(value: number): Day {
  const date = new Date(value * 86_400_000);
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

/** 0 is Sunday, 6 is Saturday. */
export const weekday = (day: Day) => new Date(dayNumber(day) * 86_400_000).getUTCDay();

export const addDays = (day: Day, days: number) => fromDayNumber(dayNumber(day) + days);

/** Reads dd/MM/yyyy or dd-MM-yyyy. Null when malformed or not a real date. */
export function parseGIBDate(value: unknown): Day | null {
  const match = typeof value === 'string' ? /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value) : null;
  if (!match) {
    return null;
  }
  const day = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  const check = fromDayNumber(dayNumber(day));
  return check.day === day.day && check.month === day.month ? day : null;
}

/** dd/MM/yyyy, the format GİB requests use. */
export const slashDate = ({ day, month, year }: Day) => `${pad(day)}/${pad(month)}/${year}`;

/** dd-MM-yyyy, the format GİB list rows use. */
export const dashDate = ({ day, month, year }: Day) => `${pad(day)}-${pad(month)}-${year}`;

/** yyyy-MM-dd, the format of the QR code's `tarih`. */
export const isoDate = ({ day, month, year }: Day) => `${year}-${pad(month)}-${pad(day)}`;

export { pad };
