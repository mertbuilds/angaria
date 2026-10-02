import type { TCMBRateDay } from 'angaria-utils';
import { useSyncExternalStore } from 'react';

// Which TCMB bulletin a foreign currency invoice takes its rate from (Ayarlar ›
// Gelişmiş › Kur günü), kept in localStorage `angaria-rate-day`. Either way the
// rate depends on the invoice date only, never on the time of day.

export type RateDay = TCMBRateDay;

/** The choices in the order Ayarlar shows them. */
export const rateDayChoices: ReadonlyArray<RateDay> = ['previous', 'same'];

/** Önceki iş günü: the bulletin TCMB published the day before, valid on the invoice date. */
export const DEFAULT_RATE_DAY: RateDay = 'previous';

const RATE_DAY_STORAGE_KEY = 'angaria-rate-day';

type RateDayStorage = Pick<Storage, 'getItem' | 'setItem'>;

const listeners = new Set<() => void>();

/** The picked rate day, else the default. */
export function readRateDay(storage?: RateDayStorage): RateDay {
  try {
    const stored = (storage ?? localStorage).getItem(RATE_DAY_STORAGE_KEY);
    return rateDayChoices.find((choice) => choice === stored) ?? DEFAULT_RATE_DAY;
  } catch {
    return DEFAULT_RATE_DAY;
  }
}

/** Remembers the choice and tells useRateDay. */
export function setRateDay(choice: RateDay, storage?: RateDayStorage) {
  try {
    (storage ?? localStorage).setItem(RATE_DAY_STORAGE_KEY, choice);
  } catch {
    // No storage: the default stays.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The picked rate day, kept in step when Ayarlar changes it. */
export function useRateDay(): RateDay {
  return useSyncExternalStore(subscribe, () => readRateDay());
}
