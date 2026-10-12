// Faturalar over long ranges. GİB lists at most seven days per request, so a
// year is 53 requests on the one session GİB allows. The list asks for whole
// Monday-to-Sunday weeks, newest first, and shows each as it arrives. A week
// that is settled (it ended more than SETTLED_DAYS ago and holds no draft and
// no pending cancellation) is kept on this Mac per GİB user code, so the next
// look at that range reads it from here. ⌘R forgets the kept weeks.

import { newestFirst } from './invoices.ts';
import type { Invoice } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

/** A week this many days in the past no longer changes, unless a draft or a cancellation is in it. */
export const SETTLED_DAYS = 30;

const STORAGE_PREFIX = 'angaria-invoice-weeks:';
const DAY_MS = 24 * 60 * 60 * 1000;

/** How far a list is: weeks read (from GİB or this Mac) of all it needs. */
export interface WeekProgress {
  done: number;
  total: number;
}

export interface Week {
  end: Date;
  start: Date;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The Monday-to-Sunday weeks that cover `start` to `end`, newest first. */
export function weeksOf(start: Date, end: Date): Array<Week> {
  const first = startOfDay(start);
  const last = startOfDay(end);
  if (first > last) {
    return [];
  }
  // getDay: 0 is Sunday. Back to that week's Monday.
  let monday = addDays(last, -((last.getDay() + 6) % 7));
  const weeks: Array<Week> = [];
  while (addDays(monday, 6) >= first) {
    weeks.push({ end: addDays(monday, 6), start: monday });
    monday = addDays(monday, -7);
  }
  return weeks;
}

const settled = (week: Week, today: Date) =>
  week.end.getTime() < startOfDay(today).getTime() - SETTLED_DAYS * DAY_MS;

/** Nothing in it can still change: no draft, no cancellation waiting for an answer. */
const final = (rows: ReadonlyArray<Invoice>) =>
  rows.every(
    (row) =>
      row.onayDurumu !== 'Onaylanmadı' &&
      !(row.iptalItiraz !== undefined && String(row.iptalItirazDurumu) === '0'),
  );

/** The kept weeks of one GİB user code, by their Monday (DD/MM/YYYY). */
export interface WeekStore {
  clear: () => void;
  get: (monday: string) => Array<Invoice> | undefined;
  set: (monday: string, rows: Array<Invoice>) => void;
}

/** Kept weeks in localStorage. A browser that keeps nothing still works, a week at a time. */
export function localWeekStore(accountKey: string): WeekStore {
  const key = `${STORAGE_PREFIX}${accountKey}`;
  const read = (): Record<string, Array<Invoice>> => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as Record<string, Array<Invoice>>) : {};
    } catch {
      return {};
    }
  };
  return {
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing kept.
      }
    },
    get: (monday) => read()[monday],
    set: (monday, rows) => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...read(), [monday]: rows }));
      } catch {
        // Full or off: the week is fetched again next time.
      }
    },
  };
}

/**
 * Every document dated `start` to `end` (DD/MM/YYYY), newest first. Weeks
 * are fetched newest first, one request each, and `onPartial` gets the rows
 * so far after every week. A day after `today` is never asked for.
 */
export async function loadInvoiceWeeks({
  end,
  fetchWeek,
  onPartial,
  onProgress,
  start,
  store,
  today = new Date(),
}: {
  end: string;
  fetchWeek: (start: string, end: string) => Promise<Array<Invoice>>;
  onPartial?: (rows: Array<Invoice>) => void;
  onProgress?: (progress: WeekProgress) => void;
  start: string;
  store: WeekStore;
  today?: Date;
}): Promise<Array<Invoice>> {
  const from = parseGIB(start);
  const to = parseGIB(end);
  if (!from || !to) {
    return newestFirst(await fetchWeek(start, end));
  }
  const inRange = (row: Invoice) => {
    const date = parseGIB(row.belgeTarihi ?? '');
    return !date || (date >= startOfDay(from) && date <= startOfDay(to));
  };
  const lastDay = startOfDay(today);
  const rows: Array<Invoice> = [];
  const weeks = weeksOf(from, to);
  onProgress?.({ done: 0, total: weeks.length });
  for (const [index, week] of weeks.entries()) {
    const monday = toGIB(week.start);
    let found = store.get(monday);
    if (!found) {
      const weekEnd = week.end > lastDay ? lastDay : week.end;
      found = week.start > weekEnd ? [] : await fetchWeek(monday, toGIB(weekEnd));
      if (settled(week, today) && final(found)) {
        store.set(monday, found);
      }
    }
    rows.push(...found.filter(inRange));
    onPartial?.(newestFirst(rows));
    onProgress?.({ done: index + 1, total: weeks.length });
  }
  return newestFirst(rows);
}
