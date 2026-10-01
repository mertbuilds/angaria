import { z } from 'zod';

const pad = (n: number) => String(n).padStart(2, '0');

export const gibDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Expected DD/MM/YYYY');
export const gibTime = z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Expected HH:MM:SS');

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
