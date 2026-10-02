import { describe, expect, test } from 'vitest';
import { ibanBankName } from '../src/lib/tr-banks.ts';

describe('ibanBankName', () => {
  test('reads the bank from a grouped, spaced or lower-case IBAN', () => {
    expect(ibanBankName('TR12 0006 4000 0011 2345 6789 01')).toBe('İş Bankası');
    expect(ibanBankName('tr120001000000112345678901')).toBe('Ziraat Bankası');
    expect(ibanBankName('TR12 0006 2')).toBe('Garanti BBVA');
  });

  test('says nothing before the bank code is typed or for an unknown bank', () => {
    expect(ibanBankName('')).toBeNull();
    expect(ibanBankName('TR12 0006')).toBeNull();
    expect(ibanBankName('TR12 0099 9000')).toBeNull();
    expect(ibanBankName('DE89 3704 0044 0532 0130 00')).toBeNull();
  });
});
