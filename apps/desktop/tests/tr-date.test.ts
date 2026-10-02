import { CalendarDate } from '@internationalized/date';
import { describe, expect, test } from 'vitest';
import {
  calendarDateToGIB,
  formatTurkishDate,
  gibToCalendarDate,
  parseTurkishDate,
} from '../src/lib/tr-date.ts';

// Friday, 2 October 2026.
const today = new CalendarDate(2026, 10, 2);
const date = (year: number, month: number, day: number) => new CalendarDate(year, month, day);

describe('parseTurkishDate', () => {
  test.each([
    ['bugün', date(2026, 10, 2)],
    ['dün', date(2026, 10, 1)],
    ['yarın', date(2026, 10, 3)],
    ['öbür gün', date(2026, 10, 4)],
  ])('%s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test.each([
    ['dun', date(2026, 10, 1)],
    ['DÜN', date(2026, 10, 1)],
    ['  Bugun ', date(2026, 10, 2)],
    ['YARIN', date(2026, 10, 3)],
    ['yarin', date(2026, 10, 3)],
    ['obur gun', date(2026, 10, 4)],
    ['öbürgün', date(2026, 10, 4)],
  ])('folds case and Turkish letters: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test.each([
    ['+3', date(2026, 10, 5)],
    ['-7', date(2026, 9, 25)],
    ['+ 30', date(2026, 11, 1)],
    ['3 gün önce', date(2026, 9, 29)],
    ['10 gun sonra', date(2026, 10, 12)],
    ['2 hafta önce', date(2026, 9, 18)],
    ['1 hafta sonra', date(2026, 10, 9)],
    ['1 ay önce', date(2026, 9, 2)],
  ])('counts days and weeks: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test('a weekday is today or the nearest one in the direction of the bias', () => {
    expect(parseTurkishDate('cuma', today, 'past')).toEqual(date(2026, 10, 2));
    expect(parseTurkishDate('cuma', today, 'future')).toEqual(date(2026, 10, 2));
    expect(parseTurkishDate('perşembe', today, 'past')).toEqual(date(2026, 10, 1));
    expect(parseTurkishDate('perşembe', today, 'future')).toEqual(date(2026, 10, 8));
    expect(parseTurkishDate('cumartesi', today, 'past')).toEqual(date(2026, 9, 26));
    expect(parseTurkishDate('cumartesi', today, 'future')).toEqual(date(2026, 10, 3));
  });

  test.each([
    ['pazartesi', date(2026, 9, 28)],
    ['salı', date(2026, 9, 29)],
    ['SALI', date(2026, 9, 29)],
    ['CUMARTESİ', date(2026, 9, 26)],
    ['PAZARTESI', date(2026, 9, 28)],
    ['carsamba', date(2026, 9, 30)],
    ['Çarşamba', date(2026, 9, 30)],
    ['pazar', date(2026, 9, 27)],
    ['cumaya', date(2026, 10, 2)],
    ['cuma günü', date(2026, 10, 2)],
    ['pazartesiye', date(2026, 9, 28)],
    ['cum', date(2026, 10, 2)],
    ['cmt', date(2026, 9, 26)],
    ['pzt', date(2026, 9, 28)],
  ])('reads weekday names with suffixes: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test.each([
    ['geçen cuma', date(2026, 9, 25)],
    ['gecen persembe', date(2026, 9, 24)],
    ['geçen hafta pazartesi', date(2026, 9, 21)],
    ['bu pazartesi', date(2026, 9, 28)],
    ['bu pazar', date(2026, 10, 4)],
    ['gelecek cuma', date(2026, 10, 9)],
    ['önümüzdeki salı', date(2026, 10, 6)],
    ['haftaya çarşamba', date(2026, 10, 7)],
  ])('reads a weekday of the previous, this or next week: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test.each([
    ['ay başı', date(2026, 10, 1)],
    ['ay sonu', date(2026, 10, 31)],
    ['aybaşı', date(2026, 10, 1)],
    ['ay sonuna', date(2026, 10, 31)],
    ['bu ay sonu', date(2026, 10, 31)],
    ['geçen ay başı', date(2026, 9, 1)],
    ['geçen ay sonu', date(2026, 9, 30)],
    ['gecen ayin son gunu', date(2026, 9, 30)],
    ['Geçen ayın ilk günü', date(2026, 9, 1)],
    ['gelecek ay sonu', date(2026, 11, 30)],
    ["ayın 15'i", date(2026, 10, 15)],
    ['ayın 15i', date(2026, 10, 15)],
    ['geçen ayın 15’i', date(2026, 9, 15)],
    ["gelecek ayın 1'i", date(2026, 11, 1)],
  ])('reads the start, end and days of a month: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test('a day the month does not have is not a date', () => {
    expect(parseTurkishDate("geçen ayın 31'i", today, 'past')).toBeNull();
  });

  test('a bare day is the nearest such day in the direction of the bias', () => {
    expect(parseTurkishDate('15', today, 'past')).toEqual(date(2026, 9, 15));
    expect(parseTurkishDate('15', today, 'future')).toEqual(date(2026, 10, 15));
    expect(parseTurkishDate('2', today, 'past')).toEqual(date(2026, 10, 2));
    expect(parseTurkishDate('1', today, 'future')).toEqual(date(2026, 11, 1));
    // September has no 31st, so the nearest one back is in August.
    expect(parseTurkishDate('31', today, 'past')).toEqual(date(2026, 8, 31));
    expect(parseTurkishDate('0', today, 'past')).toBeNull();
    expect(parseTurkishDate('32', today, 'past')).toBeNull();
  });

  test.each([
    ['15.10.2026', date(2026, 10, 15)],
    ['15/10/2026', date(2026, 10, 15)],
    ['15-10-2026', date(2026, 10, 15)],
    ['15.10.26', date(2026, 10, 15)],
    ['5.1.2027', date(2027, 1, 5)],
    ['151026', date(2026, 10, 15)],
    ['15102026', date(2026, 10, 15)],
    ['2026-10-15', date(2026, 10, 15)],
    ['29.02.2028', date(2028, 2, 29)],
  ])('reads numeric dates: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test('a day and month without a year follows the bias', () => {
    expect(parseTurkishDate('15.10', today, 'past')).toEqual(date(2025, 10, 15));
    expect(parseTurkishDate('15/10', today, 'future')).toEqual(date(2026, 10, 15));
    expect(parseTurkishDate('15.09', today, 'past')).toEqual(date(2026, 9, 15));
    expect(parseTurkishDate('15.09', today, 'future')).toEqual(date(2027, 9, 15));
    expect(parseTurkishDate('02.10', today, 'past')).toEqual(date(2026, 10, 2));
    expect(parseTurkishDate('1510', today, 'future')).toEqual(date(2026, 10, 15));
  });

  test.each(['29.02.2027', '31.04.2026', '15.13.2026', '00.10.2026', '1.2.3.4', '2026'])(
    'an impossible date is null: %s',
    (text) => {
      expect(parseTurkishDate(text, today, 'past')).toBeNull();
    },
  );

  test.each([
    ['15 ekim', date(2025, 10, 15)],
    ['15 eki', date(2025, 10, 15)],
    ['15 Ekim 2026', date(2026, 10, 15)],
    ['1 ocak', date(2026, 1, 1)],
    ['3 şubat 27', date(2027, 2, 3)],
    ['30 eylül', date(2026, 9, 30)],
    ['30 eylülde', date(2026, 9, 30)],
    ['1 AĞUSTOS', date(2026, 8, 1)],
    ['12 aralik 2025', date(2025, 12, 12)],
    ['9 mayıs', date(2026, 5, 9)],
    ['9 mart', date(2026, 3, 9)],
  ])('reads month names: %s', (text, expected) => {
    expect(parseTurkishDate(text, today, 'past')).toEqual(expected);
  });

  test('a month name follows the bias without a year', () => {
    expect(parseTurkishDate('15 ekim', today, 'future')).toEqual(date(2026, 10, 15));
  });

  test.each([
    '',
    '   ',
    'yesterday',
    'ekim',
    '15 marmara',
    'geçen',
    'ay',
    'hafta',
    '+',
    'x'.repeat(2000),
  ])('text it does not understand is null: %j', (text) => {
    expect(parseTurkishDate(text, today, 'past')).toBeNull();
  });

  test('a bare count of days follows the bias', () => {
    expect(parseTurkishDate('30 gün', today, 'future')).toEqual(date(2026, 11, 1));
    expect(parseTurkishDate('3 gün', today, 'past')).toEqual(date(2026, 9, 29));
  });
});

describe('GİB dates', () => {
  test.each([
    ['02/10/2026', date(2026, 10, 2)],
    ['30-09-2026', date(2026, 9, 30)],
    ['29/02/2028', date(2028, 2, 29)],
  ])('reads %s', (gib, expected) => {
    expect(gibToCalendarDate(gib)).toEqual(expected);
  });

  test.each(['', '2026-10-02', '29/02/2027', '32/01/2026', '2/10/2026', 'dün'])(
    'reads %j as no date',
    (gib) => {
      expect(gibToCalendarDate(gib)).toBeNull();
    },
  );

  test('writes dd/MM/yyyy', () => {
    expect(calendarDateToGIB(date(2026, 10, 2))).toBe('02/10/2026');
    expect(calendarDateToGIB(date(2026, 12, 31))).toBe('31/12/2026');
  });
});

describe('formatTurkishDate', () => {
  test.each([
    [date(2026, 10, 9), '9 Eki 2026, Cuma'],
    [date(2026, 10, 2), '2 Eki 2026, Cuma'],
    [date(2026, 9, 28), '28 Eyl 2026, Pazartesi'],
    [date(2026, 8, 1), '1 Ağu 2026, Cumartesi'],
    [date(2027, 1, 3), '3 Oca 2027, Pazar'],
  ])('%s is %s', (value, expected) => {
    expect(formatTurkishDate(value)).toBe(expected);
  });
});
