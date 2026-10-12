import { maskitoTransform } from '@maskito/core';
import { describe, expect, test } from 'vitest';
import {
  formatPhone,
  ibanBankCode,
  isTaxIDPlaceholder,
  isValidEmail,
  isValidPhone,
  isValidSWIFT,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
  normalizeIBAN,
  PHONE_MASK,
  TAX_ID_PLACEHOLDERS,
} from '../src/lib/tr-validators.ts';

// Check digits written out from the published algorithms, independent of the
// implementation under test.

function vknCheckDigit(first9: string) {
  let sum = 0;
  for (let position = 1; position <= 9; position++) {
    const shifted = (Number(first9[position - 1]) + 10 - position) % 10;
    sum += shifted === 9 ? 9 : (shifted * 2 ** (10 - position)) % 9;
  }
  return String((10 - (sum % 10)) % 10);
}

function tcknCheckDigits(first9: string) {
  const d = [...first9].map(Number);
  const tenth =
    ((((d[0]! + d[2]! + d[4]! + d[6]! + d[8]!) * 7 - (d[1]! + d[3]! + d[5]! + d[7]!)) % 10) + 10) %
    10;
  const eleventh = (d.reduce((total, digit) => total + digit, 0) + tenth) % 10;
  return `${tenth}${eleventh}`;
}

/** Deterministic prefixes, so a failure names the same sample every run. */
function prefixes(count: number, firstDigitNonZero: boolean) {
  let seed = 20_261_002;
  const next = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed;
  };
  return Array.from({ length: count }, () => {
    let prefix = '';
    for (let index = 0; index < 9; index++) {
      const digit = next() % 10;
      prefix += index === 0 && firstDigitNonZero && digit === 0 ? '1' : String(digit);
    }
    return prefix;
  });
}

const vkns = prefixes(40, false).map((prefix) => prefix + vknCheckDigit(prefix));
const tckns = prefixes(40, true).map((prefix) => prefix + tcknCheckDigits(prefix));

/** Every ID that differs from `id` in exactly one digit. */
function mutations(id: string) {
  return [...id].flatMap((char, index) =>
    Array.from({ length: 10 }, (_, digit) => String(digit))
      .filter((digit) => digit !== char)
      .map((digit) => id.slice(0, index) + digit + id.slice(index + 1)),
  );
}

describe('isValidVKN', () => {
  test.each(vkns)('accepts %s', (vkn) => {
    expect(isValidVKN(vkn)).toBe(true);
  });

  test('rejects every single-digit change', () => {
    for (const vkn of vkns) {
      for (const mutated of mutations(vkn)) {
        expect(isValidVKN(mutated), mutated).toBe(false);
      }
    }
  });

  test('rejects other shapes', () => {
    expect(isValidVKN('')).toBe(false);
    expect(isValidVKN('123456789')).toBe(false);
    expect(isValidVKN(`${vkns[0]}0`)).toBe(false);
    expect(isValidVKN(` ${vkns[0]}`)).toBe(false);
    expect(isValidVKN('12345abcde')).toBe(false);
  });
});

describe('isValidTCKN', () => {
  test.each(tckns)('accepts %s', (tckn) => {
    expect(isValidTCKN(tckn)).toBe(true);
  });

  test('rejects every single-digit change', () => {
    for (const tckn of tckns) {
      for (const mutated of mutations(tckn)) {
        expect(isValidTCKN(mutated), mutated).toBe(false);
      }
    }
  });

  test('rejects a leading zero even with matching check digits', () => {
    const prefix = '012345678';
    expect(isValidTCKN(prefix + tcknCheckDigits(prefix))).toBe(false);
  });
});

describe('tax ID placeholders', () => {
  test.each(TAX_ID_PLACEHOLDERS)('%s fails the checksum but is a placeholder', (id) => {
    expect(id.length === 10 ? isValidVKN(id) : isValidTCKN(id)).toBe(false);
    expect(isTaxIDPlaceholder(id)).toBe(true);
    expect(isTaxIDPlaceholder(` ${id} `)).toBe(true);
  });

  test('a real ID is not a placeholder', () => {
    expect(isTaxIDPlaceholder(vkns[0]!)).toBe(false);
    expect(isTaxIDPlaceholder('3333333333')).toBe(false);
  });
});

describe('IBAN', () => {
  const example = 'TR33 0006 1005 1978 6457 8413 26';

  test('the example passes mod-97, spaced or not, any case', () => {
    expect(isValidTRIBAN(example)).toBe(true);
    expect(isValidTRIBAN('TR330006100519786457841326')).toBe(true);
    expect(isValidTRIBAN('tr33 0006 1005 1978 6457 8413 26')).toBe(true);
  });

  test('one changed digit fails', () => {
    const compact = normalizeIBAN(example);
    for (let index = 2; index < compact.length; index++) {
      const char = compact[index]!;
      const changed = String((Number(char) + 1) % 10);
      const mutated = compact.slice(0, index) + changed + compact.slice(index + 1);
      expect(isValidTRIBAN(mutated), mutated).toBe(false);
    }
  });

  test('only Turkish IBANs of 26 characters pass', () => {
    expect(isValidTRIBAN('DE89 3704 0044 0532 0130 00')).toBe(false);
    expect(isValidTRIBAN('TR33 0006 1005 1978 6457 8413 2')).toBe(false);
    expect(isValidTRIBAN('')).toBe(false);
  });

  test('normalizes and reads the bank code', () => {
    expect(normalizeIBAN(' tr33-0006 1005 1978 ')).toBe('TR33000610051978');
    expect(ibanBankCode(example)).toBe('00061');
    expect(ibanBankCode('TR33 0006')).toBeNull();
    expect(ibanBankCode('DE89 3704 0044')).toBeNull();
  });
});

describe('isValidSWIFT', () => {
  test('takes 8 or 11 characters, any case and spacing', () => {
    expect(isValidSWIFT('TGBATRIS')).toBe(true);
    expect(isValidSWIFT('tgbatrisxxx')).toBe(true);
    expect(isValidSWIFT('TGBA TR IS')).toBe(true);
    expect(isValidSWIFT('TGBATRI')).toBe(false);
    expect(isValidSWIFT('TGBATRISXX')).toBe(false);
    expect(isValidSWIFT('1GBATRIS')).toBe(false);
  });
});

describe('isValidEmail', () => {
  test('takes the common shape', () => {
    expect(isValidEmail('destek@angaria.app')).toBe(true);
    expect(isValidEmail(' ad@firma.com.tr ')).toBe(true);
    expect(isValidEmail('ad@firma')).toBe(false);
    expect(isValidEmail('ad firma@x.com')).toBe(false);
    expect(isValidEmail('@firma.com')).toBe(false);
  });
});

describe('phone numbers', () => {
  test('a Turkish number reads +90 532 123 45 67 however it is typed', () => {
    for (const typed of [
      '+90 532 123 45 67',
      '+905321234567',
      '0532 123 45 67',
      '532 123 45 67',
      '90 532 123 4567',
      '+90 (0532) 123-45-67',
    ]) {
      expect(formatPhone(typed), typed).toBe('+90 532 123 45 67');
    }
    expect(isValidPhone('+90 532 123 45 67')).toBe(true);
    expect(isValidPhone('+90 532 123 45')).toBe(false);
    expect(isValidPhone('+90 532 123 45 678')).toBe(false);
  });

  test("another country's number keeps its + and digits, grouped as given", () => {
    expect(formatPhone('+49 30 1234 5678')).toBe('+49 30 1234 5678');
    expect(formatPhone('+1 (415) 555-0100')).toBe('+1 415 555 0100');
    expect(formatPhone('0049 30 12345678')).toBe('+49 30 12345678');
    expect(formatPhone('+4930123456')).toBe('+4930123456');
    expect(isValidPhone('+49 30 1234 5678')).toBe(true);
    expect(isValidPhone('+1 415 555 0100')).toBe(true);
    // 8 to 15 digits with the country code
    expect(isValidPhone('+49 301 23')).toBe(false);
    expect(isValidPhone('+49 3012 3456 7890 12')).toBe(false);
    expect(isValidPhone('+')).toBe(false);
    expect(isValidPhone('+0 123 456 789')).toBe(false);
  });

  test('the mask formats as typed and caps the digits', () => {
    expect(maskitoTransform('+905321234567', PHONE_MASK)).toBe('+90 532 123 45 67');
    expect(maskitoTransform('+90532123456789', PHONE_MASK)).toBe('+90 532 123 45 67');
    expect(maskitoTransform('+90 0532', PHONE_MASK)).toBe('+90 532');
    expect(maskitoTransform('+4930123456', PHONE_MASK)).toBe('+4930123456');
    expect(maskitoTransform('+4930123456789012', PHONE_MASK)).toBe('+493012345678901');
  });
});
