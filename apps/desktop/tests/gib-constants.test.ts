import { describe, expect, test } from 'vitest';
import { GIB_UNIT_TYPES as EMULATOR_UNIT_TYPES } from '../../../packages/gib-emulator/src/units.ts';
import { GIB_COUNTRIES, GIB_COUNTRY_ALIASES, GIB_UNIT_TYPES } from '../src/lib/gib-constants.ts';
import { suggestTaxOffices, TAX_OFFICES } from '../src/lib/tax-offices.ts';
import { CITY_NAMES, cityCode, matchesWords, searchKey, TR_CITIES } from '../src/lib/tr-cities.ts';

test('the GİB emulator knows every unit the app offers, by the same name', () => {
  expect(EMULATOR_UNIT_TYPES).toEqual(GIB_UNIT_TYPES);
});

describe('countries', () => {
  test('list every GİB value once', () => {
    const values = GIB_COUNTRIES.map((country) => country.value);
    expect(new Set(values).size).toBe(values.length);
  });

  test('give aliases only to countries GİB has', () => {
    const values = new Set(GIB_COUNTRIES.map((country) => country.value));
    expect(Object.keys(GIB_COUNTRY_ALIASES).filter((value) => !values.has(value))).toEqual([]);
  });
});

describe('cities', () => {
  test('are the 81 il, one per plate number', () => {
    expect(TR_CITIES).toHaveLength(81);
    expect(TR_CITIES.map(([code]) => Number(code))).toEqual(
      Array.from({ length: 81 }, (_, index) => index + 1),
    );
    expect(CITY_NAMES[0]).toBe('Adana');
    expect(CITY_NAMES.at(-1)).toBe('Zonguldak');
  });

  test('are found in any case and without Turkish letters', () => {
    expect(cityCode('İstanbul')).toBe('34');
    expect(cityCode('ISTANBUL')).toBe('34');
    expect(cityCode(' istanbul ')).toBe('34');
    expect(cityCode('izmir')).toBe('35');
    expect(cityCode('Iğdır')).toBe('76');
    expect(cityCode('Berlin')).toBeNull();
    expect(cityCode('')).toBeNull();
  });
});

describe('matchesWords', () => {
  test('matches the start of every typed word', () => {
    expect(searchKey('KADIKÖY')).toBe('kadikoy');
    expect(matchesWords('kadikoy', 'Kadıköy')).toBe(true);
    expect(matchesWords('bir kr', 'Birleşik Krallık')).toBe(true);
    expect(matchesWords('köy', 'Kadıköy')).toBe(false);
    expect(matchesWords('', 'Kadıköy')).toBe(true);
  });
});

describe('tax offices', () => {
  test("are GİB's list: unique codes, each in a known il", () => {
    expect(TAX_OFFICES).toHaveLength(860);
    const codes = TAX_OFFICES.map(([code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
    const plates = new Set(TR_CITIES.map(([code]) => code));
    expect(codes.filter((code) => !/^\d{5}$/.test(code) || !plates.has(code.slice(0, 2)))).toEqual(
      [],
    );
    expect(TAX_OFFICES).toContainEqual(['34272', 'Kadıköy']);
  });

  test("list an il's own offices once Şehir names it", () => {
    const istanbul = suggestTaxOffices('', 'istanbul', 100);
    expect(istanbul.length).toBeGreaterThan(30);
    expect(istanbul.every((office) => office.code.startsWith('34'))).toBe(true);
    expect(suggestTaxOffices('kadik', 'İstanbul').map((office) => office.name)).toEqual([
      'Kadıköy',
    ]);
    expect(suggestTaxOffices('kadik', 'Ankara')).toEqual([]);
  });

  test('match by name or il without a Şehir, and suggest nothing before typing', () => {
    expect(suggestTaxOffices('', '')).toEqual([]);
    expect(suggestTaxOffices('gölbaşı', '').map((office) => office.city)).toEqual([
      'Adıyaman',
      'Ankara',
    ]);
    expect(suggestTaxOffices('ankara', '', 100).every((office) => office.city === 'Ankara')).toBe(
      true,
    );
    expect(suggestTaxOffices('a', '', 5)).toHaveLength(5);
  });
});
