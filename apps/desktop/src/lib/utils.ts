import { format, parse } from 'date-fns';
import { tr } from 'date-fns/locale';

const GIB_FORMAT = 'dd/MM/yyyy';
const GIB_FORMAT_DASH = 'dd-MM-yyyy';

/** Parse a GIB date string (dd/MM/yyyy or dd-MM-yyyy) into a Date */
export function parseGIB(s: string): Date | undefined {
  if (!s) {
    return undefined;
  }
  try {
    const fmt = s.includes('/') ? GIB_FORMAT : GIB_FORMAT_DASH;
    const d = parse(s, fmt, new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

/** Format a Date as dd/MM/yyyy for GIB API */
export function toGIB(d: Date | undefined): string {
  return d ? format(d, GIB_FORMAT) : '';
}

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "1 Eki", with the year when it is not this year's. */
export const shortDate = (date: Date, today = new Date()) =>
  (date.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear).format(date);

/** Format a GIB date string as human-readable Turkish (e.g. "19 Mart 2026") */
export function formatDateHuman(s: string): string {
  const d = parseGIB(s);
  return d ? format(d, 'd MMMM yyyy', { locale: tr }) : s;
}
