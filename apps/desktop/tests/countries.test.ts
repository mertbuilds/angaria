import { describe, expect, test } from 'vitest';
import {
  COUNTRY_OPTIONS,
  findCountry,
  fullCountryName,
  GIB_COUNTRY_LENGTH,
  gibCountryValue,
  matchesCountry,
} from '../src/lib/countries.ts';
import { GIB_COUNTRIES } from '../src/lib/gib-constants.ts';

/** The stored names of the countries a typed query finds. */
const findCountries = (query: string) =>
  COUNTRY_OPTIONS.filter((country) => matchesCountry(country, query)).map(
    (country) => country.value,
  );

describe('country options', () => {
  test('pin Türkiye and keep one option per full name and per GİB value', () => {
    expect(COUNTRY_OPTIONS[0]?.value).toBe('Türkiye');
    const names = COUNTRY_OPTIONS.map((country) => country.value);
    expect(new Set(names).size).toBe(names.length);
    const values = COUNTRY_OPTIONS.map((country) => country.gib);
    expect(new Set(values).size).toBe(values.length);
  });

  test('store the full Turkish name', () => {
    expect(COUNTRY_OPTIONS.every((country) => country.value === country.label)).toBe(true);
  });

  test('match the Turkish name, the English name, GİB’s spelling and aliases', () => {
    expect(findCountries('usa')).toEqual(['Amerika Birleşik Devletleri']);
    expect(findCountries('United States')).toContain('Amerika Birleşik Devletleri');
    expect(findCountries('abd')).toContain('Amerika Birleşik Devletleri');
    expect(findCountries('uk')).toEqual(['Birleşik Krallık', 'Ukrayna']);
    expect(findCountries('ingiltere')).toEqual(['Birleşik Krallık']);
    expect(findCountries('birleşik krallik')).toEqual(['Birleşik Krallık']);
    expect(findCountries('germany')).toEqual(['Almanya']);
    expect(findCountries('ALMANYA')).toEqual(['Almanya']);
  });

  test('match the start of a word, not any letters inside it', () => {
    expect(findCountries('us')).not.toContain('Avustralya');
    expect(findCountries('kore')).toEqual(
      expect.arrayContaining(['Güney Kore Cumhuriyeti', 'Kuzey Kore Demokratik Halk Cumhuriyeti']),
    );
  });
});

describe('fullCountryName', () => {
  test("maps GİB's cut value back to the full name", () => {
    expect(fullCountryName('Amerika Birleşik Dev')).toBe('Amerika Birleşik Devletleri');
    expect(fullCountryName('Birleşik Krallik')).toBe('Birleşik Krallık');
    expect(fullCountryName('Kuzey Kibris Türk Cu')).toBe('Kuzey Kıbrıs Türk Cumhuriyeti');
  });

  test('maps every GİB value and every name cut at 20 characters to its country', () => {
    for (const { label, value } of GIB_COUNTRIES) {
      expect(fullCountryName(value)).toBe(label);
      expect(fullCountryName(label.slice(0, GIB_COUNTRY_LENGTH))).toBe(label);
    }
  });

  test('keeps a full name, and finds it in any case', () => {
    expect(fullCountryName('Amerika Birleşik Devletleri')).toBe('Amerika Birleşik Devletleri');
    expect(fullCountryName('Kongo')).toBe('Kongo');
    expect(fullCountryName(' almanya ')).toBe('Almanya');
  });

  test('keeps a name that starts more than one country, or none', () => {
    expect(fullCountryName('Amerika')).toBe('Amerika');
    expect(findCountry('Amerika')).toBeNull();
    expect(fullCountryName('Atlantis')).toBe('Atlantis');
    expect(fullCountryName('')).toBe('');
  });
});

describe('gibCountryValue', () => {
  test("sends GİB's value for a full name", () => {
    expect(gibCountryValue('Amerika Birleşik Devletleri')).toBe('Amerika Birleşik Dev');
    expect(gibCountryValue('Birleşik Krallık')).toBe('Birleşik Krallik');
    expect(gibCountryValue('Almanya')).toBe('Almanya');
    expect(gibCountryValue('Amerika Birleşik Dev')).toBe('Amerika Birleşik Dev');
  });

  test('cuts a name outside the list at 20 characters, as GİB would', () => {
    expect(gibCountryValue('Republic of Atlantis Federation')).toBe('Republic of Atlantis');
    expect(gibCountryValue('')).toBe('');
  });

  test('round-trips: what GİB keeps maps back to the name sent', () => {
    for (const { label } of GIB_COUNTRIES) {
      expect(fullCountryName(gibCountryValue(label).slice(0, GIB_COUNTRY_LENGTH))).toBe(label);
    }
  });
});
