import { z } from 'zod';

const pad = (n: number) => String(n).padStart(2, '0');

const utcDay = (value: string) => {
  const [dd, mm, yyyy] = value.split('/').map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd));
};

const isCalendarDate = (value: string) => {
  const date = utcDay(value);
  return (
    `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}` === value
  );
};

/** YYYYMMDD, so DD/MM/YYYY dates compare as strings. */
const sortKey = (value: string) => value.split('/').toReversed().join('');

const istanbulDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
});

/** Today as DD/MM/YYYY in Turkish time, whatever the host's time zone. */
export const istanbulToday = (now: Date) => istanbulDate.format(now);

/** Days from `start` to `end` (DD/MM/YYYY), both ends counted. */
export const rangeDays = (start: string, end: string) =>
  (utcDay(end).getTime() - utcDay(start).getTime()) / 86_400_000 + 1;

export const gibDate = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Expected DD/MM/YYYY')
  .refine(isCalendarDate, 'Not a calendar date');

/** A GİB date no later than today in Turkish time. */
export const pastGIBDate = gibDate.refine(
  (value) => sortKey(value) <= sortKey(istanbulToday(new Date())),
  'Must not be after today (Europe/Istanbul)',
);

export const gibTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, 'Expected HH:MM:SS, 00:00:00 to 23:59:59');

export function formatGIBDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatGIBTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseGIBDate(value: string): Date {
  const [dd, mm, yyyy] = value.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** ±7 days around a known invoice date, else the last 90 days. */
export function draftSearchRange(
  date: string | undefined,
  now: Date,
): { endDate: string; startDate: string } {
  if (date) {
    const d = parseGIBDate(date);
    return { endDate: formatGIBDate(addDays(d, 7)), startDate: formatGIBDate(addDays(d, -7)) };
  }
  return { endDate: formatGIBDate(now), startDate: formatGIBDate(addDays(now, -90)) };
}
