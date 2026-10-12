import { describe, expect, test } from 'vitest';
import { companyFieldError, normalizeCompanyField } from '../src/lib/company-fields.ts';

/** What Ayarlar and update_company_details keep: normalized, then checked. */
const save = (kind: Parameters<typeof normalizeCompanyField>[0], value: string) => {
  const normal = normalizeCompanyField(kind, value);
  return { error: companyFieldError(kind, normal), value: normal };
};

describe('phone', () => {
  test('only a bare +90 clears it', () => {
    expect(save('phone', '+90 ')).toEqual({ error: undefined, value: '' });
    expect(save('phone', '+90')).toEqual({ error: undefined, value: '' });
    expect(save('phone', '')).toEqual({ error: undefined, value: '' });
    for (const partial of ['9', '90', '+9', '+']) {
      const saved = save('phone', partial);
      expect(saved.error, partial).toBeDefined();
      expect(saved.value, partial).not.toBe('');
    }
  });

  test('keeps a saved Turkish number as it was', () => {
    expect(save('phone', '+90 532 123 45 67')).toEqual({
      error: undefined,
      value: '+90 532 123 45 67',
    });
    expect(save('phone', '0532 123 4567').value).toBe('+90 532 123 45 67');
  });

  test("takes another country's number with its country code", () => {
    expect(save('phone', '+49 (30) 1234-5678')).toEqual({
      error: undefined,
      value: '+49 30 1234 5678',
    });
    expect(save('phone', '+49 30').error).toBe(
      'Telefonu ülke koduyla yaz, örneğin +90 532 123 45 67 ya da +49 30 1234 5678',
    );
  });
});

describe('bank fields', () => {
  test('an IBAN is kept grouped by four, without other characters', () => {
    expect(save('iban', 'tr33-0006-1005-1978-6457-8413-26')).toEqual({
      error: undefined,
      value: 'TR33 0006 1005 1978 6457 8413 26',
    });
  });

  test('a SWIFT code is kept without spaces, upper-cased', () => {
    expect(save('swift', 'tczb tris')).toEqual({ error: undefined, value: 'TCZBTRIS' });
  });
});
