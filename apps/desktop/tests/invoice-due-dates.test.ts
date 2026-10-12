import { expect, test } from 'vitest';
import { dueDateOf, saveDueDate } from '../src/lib/invoice-due-dates.ts';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

test('keeps a due date per ETTN and forgets an empty one', () => {
  const storage = memoryStorage();
  saveDueDate('a', '15/10/2026', storage);
  saveDueDate('b', '31/10/2026', storage);
  expect(dueDateOf('a', storage)).toBe('15/10/2026');
  expect(dueDateOf('b', storage)).toBe('31/10/2026');
  expect(dueDateOf('c', storage)).toBeUndefined();

  saveDueDate('a', '', storage);
  expect(dueDateOf('a', storage)).toBeUndefined();
  expect(dueDateOf('b', storage)).toBe('31/10/2026');
});

test('reads nothing from a broken entry', () => {
  const storage = memoryStorage();
  storage.setItem('fatura-due-dates', '{');
  expect(dueDateOf('a', storage)).toBeUndefined();
});

test('never throws when the storage refuses the write', () => {
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    },
  };
  expect(() => saveDueDate('a', '15/10/2026', full)).not.toThrow();
});
