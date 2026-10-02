import { expect, test } from 'vitest';
import { readRateDay, setRateDay } from '../src/lib/rate-day.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    items,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

test('starts on the previous business day', () => {
  expect(readRateDay(memoryStorage())).toBe('previous');
});

test('remembers the choice', () => {
  const storage = memoryStorage();
  setRateDay('same', storage);
  expect(storage.items.get('angaria-rate-day')).toBe('same');
  expect(readRateDay(storage)).toBe('same');
});

test('falls back to the default on an unknown value or without storage', () => {
  expect(readRateDay(memoryStorage({ 'angaria-rate-day': 'friday' }))).toBe('previous');
  const broken = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
  };
  expect(readRateDay(broken)).toBe('previous');
  expect(() => setRateDay('same', broken)).not.toThrow();
});
