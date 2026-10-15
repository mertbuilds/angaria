import { describe, expect, test } from 'vitest';
import { smsCodeError } from '../src/lib/sms-code.ts';

describe('smsCodeError', () => {
  test('accepts six digits, six letters, or both mixed', () => {
    expect(smsCodeError('123456')).toBeNull();
    expect(smsCodeError('ABCDEF')).toBeNull();
    expect(smsCodeError('a4K 9z2')).toBeNull();
  });

  test('says what is wrong with a short, empty or odd code', () => {
    expect(smsCodeError('')).toBe('SMS şifresini gir');
    expect(smsCodeError('A4K9')).toBe('SMS şifresinin 6 hanesini de gir');
    expect(smsCodeError('A4K-92')).toBe('SMS şifresini yalnızca harf ve rakamla yaz');
  });
});
