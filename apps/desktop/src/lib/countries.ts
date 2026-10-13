import { GIB_COUNTRIES, GIB_COUNTRY_ALIASES } from './gib-constants.ts';
import { matchesWords, searchKey } from './tr-cities.ts';

/** How many characters of a country name GİB keeps ("Amerika Birleşik Dev"). */
export const GIB_COUNTRY_LENGTH = 20;

export interface CountryOption {
  aliases: ReadonlyArray<string>;
  en: string;
  /** What GİB stores and the payload sends, cut at 20 characters. */
  gib: string;
  /** The full Turkish name. */
  label: string;
  /** What Angaria stores: the full Turkish name. */
  value: string;
}

/** GİB's countries for a picker: Türkiye first, then the rest by Turkish name. */
export const COUNTRY_OPTIONS: ReadonlyArray<CountryOption> = GIB_COUNTRIES.map(
  ({ en, label, value }) => ({
    aliases: GIB_COUNTRY_ALIASES[value] ?? [],
    en,
    gib: value,
    label,
    value: label,
  }),
).toSorted((a, b) =>
  a.value === 'Türkiye' ? -1 : b.value === 'Türkiye' ? 1 : a.label.localeCompare(b.label, 'tr'),
);

/**
 * The country a stored or GİB-sent name stands for: its full Turkish name,
 * GİB's value (in any case), or the start of exactly one country's name or
 * GİB value (GİB cuts at 20 characters). Null when no country, or more than
 * one, fits.
 */
export function findCountry(name: string): CountryOption | null {
  const text = name.trim();
  if (!text) {
    return null;
  }
  const exact =
    COUNTRY_OPTIONS.find((country) => country.label === text) ??
    COUNTRY_OPTIONS.find((country) => country.gib === text);
  if (exact) {
    return exact;
  }
  const key = searchKey(text);
  const only = (fits: (candidate: string) => boolean) => {
    const found = COUNTRY_OPTIONS.filter(
      (country) => fits(searchKey(country.label)) || fits(searchKey(country.gib)),
    );
    return found.length === 1 ? (found[0] ?? null) : null;
  };
  return only((candidate) => candidate === key) ?? only((candidate) => candidate.startsWith(key));
}

/**
 * A country by its full Turkish name: "Amerika Birleşik Devletleri" for GİB's
 * "Amerika Birleşik Dev". A name that fits no one country stays as it is.
 */
export const fullCountryName = (name: string) => findCountry(name)?.label ?? name.trim();

/**
 * What GİB takes for a country: its value in GİB's list, else the name cut at
 * GİB's 20 characters, as GİB would store it.
 */
export const gibCountryValue = (name: string) =>
  findCountry(name)?.gib ?? name.trim().slice(0, GIB_COUNTRY_LENGTH);

/**
 * Whether the typed words start the country's Turkish or English name, GİB's
 * spelling or an alias: "usa", "abd" and "united" all find the United States.
 */
export const matchesCountry = (country: CountryOption, query: string) =>
  matchesWords(query, country.label, country.en, country.gib, ...country.aliases);
