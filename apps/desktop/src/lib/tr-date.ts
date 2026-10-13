import { CalendarDate, endOfMonth } from '@internationalized/date';

/** Which way an incomplete date leans: an invoice date looks back, a due date ahead. */
export type DateBias = 'past' | 'future';

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** Lowercase in Turkish, then fold to ASCII: "DÜN" and "dun" read the same. */
function normalize(text: string) {
  return text
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll(/[çğıöşü]/g, (char) => FOLD[char] ?? char)
    .replaceAll(/['’‘`]/g, '')
    .replaceAll(/\s+/g, ' ');
}

// Keyed without spaces, so "öbür gün" and "öbürgün" both match.
const RELATIVE_DAYS: Record<string, number> = {
  bugun: 0,
  dun: -1,
  oburgun: 2,
  yarin: 1,
};

const UNITS = { ay: 'months', gun: 'days', hafta: 'weeks' } as const;

/** "+3", "-7", "3 gün önce", "2 hafta sonra"; a bare "30 gün" follows the bias. */
function parseOffset(input: string, today: CalendarDate, bias: DateBias) {
  const signed = /^([+-]) ?(\d{1,4})$/.exec(input);
  if (signed) {
    return today.add({ days: Number(signed[2]) * (signed[1] === '-' ? -1 : 1) });
  }
  const counted = /^(\d{1,4}) ?(gun|hafta|ay)\S*(?: (once|sonra)\S*)?$/.exec(input);
  if (!counted) {
    return null;
  }
  const [, count, unit, direction] = counted;
  const sign = (direction ?? (bias === 'past' ? 'once' : 'sonra')) === 'once' ? -1 : 1;
  return today.add({ [UNITS[unit as keyof typeof UNITS]]: Number(count) * sign });
}

// Monday first, folded to ASCII.
const WEEKDAYS = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'];
const WEEKDAY_ALIASES: Record<string, number> = { cmt: 5, pzt: 0 };

/** 0 for Monday through 6 for Sunday. */
const weekdayOf = (date: CalendarDate) => (date.toDate('UTC').getUTCDay() + 6) % 7;

/**
 * The weekday a word names: a full name with any suffix ("cumaya"), or the
 * start of one ("çar"). The longest full name wins, so "cumartesi" is not
 * "cuma"; a bare start picks the shortest, so "cum" is "cuma".
 */
function weekdayIndex(word: string) {
  const alias = WEEKDAY_ALIASES[word];
  if (alias !== undefined) {
    return alias;
  }
  const byLength = WEEKDAYS.map((name, index) => ({ index, name })).toSorted(
    (a, b) => b.name.length - a.name.length,
  );
  const full = byLength.find(({ name }) => word.startsWith(name));
  if (full) {
    return full.index;
  }
  const start =
    word.length >= 3 ? byLength.findLast(({ name }) => name.startsWith(word)) : undefined;
  return start?.index ?? null;
}

/**
 * "cuma" is today or the nearest Friday in the direction of the bias; "geçen",
 * "bu" and "gelecek" pick the Friday of the previous, this or next week
 * (weeks start on Monday).
 */
function parseWeekday(input: string, today: CalendarDate, bias: DateBias) {
  const match = /^(?:(gecen|bu|gelecek|onumuzdeki|haftaya) )?(?:hafta )?([a-z]+)(?: gun\S*)?$/.exec(
    input,
  );
  const target = match ? weekdayIndex(match[2]) : null;
  if (!match || target === null) {
    return null;
  }
  const current = weekdayOf(today);
  const monday = today.subtract({ days: current });
  switch (match[1]) {
    case 'gecen':
      return monday.add({ days: target - 7 });
    case 'bu':
      return monday.add({ days: target });
    case 'gelecek':
    case 'onumuzdeki':
    case 'haftaya':
      return monday.add({ days: target + 7 });
    default:
      return bias === 'past'
        ? today.subtract({ days: (current - target + 7) % 7 })
        : today.add({ days: (target - current + 7) % 7 });
  }
}

const MONTH_STEPS: Record<string, number> = { bu: 0, gecen: -1, gelecek: 1, onumuzdeki: 1 };

/** "ay başı", "geçen ay sonu", "geçen ayın son günü", "ayın 15'i". */
function parseMonthDay(input: string, today: CalendarDate) {
  const match = /^(?:(gecen|bu|gelecek|onumuzdeki) )?ay(?:in)? ?(.+)$/.exec(input);
  if (!match) {
    return null;
  }
  const month = today.set({ day: 1 }).add({ months: MONTH_STEPS[match[1] ?? 'bu'] ?? 0 });
  const last = endOfMonth(month);
  const part = match[2];
  if (/^(?:basi|ilk gun)\S*$/.test(part)) {
    return month;
  }
  if (/^(?:sonu|son gun)\S*$/.test(part)) {
    return last;
  }
  const day = /^(\d{1,2})\S*$/.exec(part);
  return day && Number(day[1]) >= 1 && Number(day[1]) <= last.day
    ? month.set({ day: Number(day[1]) })
    : null;
}

// Folded to ASCII.
const MONTHS = [
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik',
];

/** A real calendar day, or null: no 29 February 2027, no 31 April. */
function dateOf(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 1 || year > 9999) {
    return null;
  }
  const first = new CalendarDate(year, month, 1);
  return day <= endOfMonth(first).day ? first.set({ day }) : null;
}

/** "26" is 2026; a missing year is the nearest one in the direction of the bias. */
function withYear(
  day: number,
  month: number,
  year: string | undefined,
  today: CalendarDate,
  bias: DateBias,
) {
  if (year) {
    return dateOf(year.length === 2 ? 2000 + Number(year) : Number(year), month, day);
  }
  const step = bias === 'past' ? -1 : 1;
  // Eight years reach the nearest 29 February.
  for (let offset = 0; offset < 8; offset++) {
    const candidate = dateOf(today.year + offset * step, month, day);
    if (candidate && candidate.compare(today) * step >= 0) {
      return candidate;
    }
  }
  return null;
}

/** "15" is the nearest 15th in the direction of the bias, today included. */
function parseDay(input: string, today: CalendarDate, bias: DateBias) {
  if (!/^\d{1,2}$/.test(input)) {
    return null;
  }
  const step = bias === 'past' ? -1 : 1;
  const first = today.set({ day: 1 });
  for (let offset = 0; offset < 12; offset++) {
    const month = first.add({ months: offset * step });
    const candidate = dateOf(month.year, month.month, Number(input));
    if (candidate && candidate.compare(today) * step >= 0) {
      return candidate;
    }
  }
  return null;
}

/** "15.10", "15/10/2026", "15.10.26", "151026", "2026-10-15". */
function parseNumeric(input: string, today: CalendarDate, bias: DateBias) {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (iso) {
    return dateOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const match =
    /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?\.?$/.exec(input) ??
    /^(\d{2})(\d{2})(\d{2}|\d{4})?$/.exec(input);
  return match ? withYear(Number(match[1]), Number(match[2]), match[3], today, bias) : null;
}

/** "15 ekim", "15 eki", "3 şubat 27", "30 eylülde". */
function parseMonthName(input: string, today: CalendarDate, bias: DateBias) {
  const match = /^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/.exec(input);
  if (!match) {
    return null;
  }
  const word = match[2];
  const month = MONTHS.findIndex(
    (name) => word.startsWith(name) || (word.length >= 3 && name.startsWith(word)),
  );
  return month === -1 ? null : withYear(Number(match[1]), month + 1, match[3], today, bias);
}

/**
 * Reads a Turkish date the way people type it: "dün", "cuma", "15.10",
 * "geçen ay sonu". Null when it does not understand the text.
 */
export function parseTurkishDate(
  text: string,
  today: CalendarDate,
  bias: DateBias,
): CalendarDate | null {
  const input = normalize(text);
  // Nothing worth reading is this long; a pasted page should not cost a scan.
  if (input.length > 40) {
    return null;
  }
  const relative = RELATIVE_DAYS[input.replaceAll(' ', '')];
  if (relative !== undefined) {
    return today.add({ days: relative });
  }
  return (
    parseOffset(input, today, bias) ??
    parseWeekday(input, today, bias) ??
    parseMonthDay(input, today) ??
    parseDay(input, today, bias) ??
    parseNumeric(input, today, bias) ??
    parseMonthName(input, today, bias)
  );
}

/** GİB's "02/10/2026" (or "02-10-2026"); null when empty or not a real day. */
export function gibToCalendarDate(gib: string) {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(gib);
  return match ? dateOf(Number(match[3]), Number(match[2]), Number(match[1])) : null;
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** GİB's "dd/MM/yyyy". */
export const calendarDateToGIB = (date: CalendarDate) =>
  `${pad(date.day)}/${pad(date.month)}/${pad(date.year, 4)}`;

/** Under the date popover's text line: what it understands. */
export const DATE_TEXT_HINT = 'Örnek: dün, 15.10, geçen ay sonu';
