import { expect, test } from 'vitest';
import { draftSearchRange, formatGIBDate, formatGIBTime } from '../src/dates.ts';

const now = new Date(2026, 2, 5, 9, 4, 3);

test('formats dates and times the way GİB expects', () => {
  expect(formatGIBDate(now)).toBe('05/03/2026');
  expect(formatGIBTime(now)).toBe('09:04:03');
});

test('draftSearchRange searches 7 days around a given date', () => {
  expect(draftSearchRange('03/03/2026', now)).toEqual({
    endDate: '10/03/2026',
    startDate: '24/02/2026',
  });
});

test('draftSearchRange falls back to the last 90 days', () => {
  expect(draftSearchRange(undefined, now)).toEqual({
    endDate: '05/03/2026',
    startDate: '05/12/2025',
  });
});
