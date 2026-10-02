import type { MaskitoOptions, MaskitoPreprocessor } from '@maskito/core';

// Checks and masks for Turkish IDs and numbers: VKN, TCKN, IBAN, GTİP, phone,
// SWIFT and e-mail. Pure functions; the masks feed MaskedField.

/**
 * Tax IDs GİB accepts in place of a real one: 2222222222 for a foreign buyer,
 * 22222222222 and 11111111111 for a person who gives no TCKN. None passes
 * the checksum, so a check takes them first.
 */
export const TAX_ID_PLACEHOLDERS: ReadonlyArray<string> = [
  '2222222222',
  '22222222222',
  '11111111111',
];

export const isTaxIDPlaceholder = (id: string) => TAX_ID_PLACEHOLDERS.includes(id.trim());

const digitsOf = (text: string) => [...text].map(Number);

/** A 10-digit vergi kimlik numarası with GİB's check digit. */
export function isValidVKN(vkn: string) {
  if (!/^\d{10}$/.test(vkn)) {
    return false;
  }
  const digits = digitsOf(vkn);
  let sum = 0;
  for (let index = 0; index < 9; index++) {
    const shifted = ((digits[index] ?? 0) + 9 - index) % 10;
    const weighted = (shifted * 2 ** (9 - index)) % 9;
    sum += shifted !== 0 && weighted === 0 ? 9 : weighted;
  }
  return (10 - (sum % 10)) % 10 === digits[9];
}

/** An 11-digit T.C. kimlik numarası: no leading 0 and both check digits. */
export function isValidTCKN(tckn: string) {
  if (!/^[1-9]\d{10}$/.test(tckn)) {
    return false;
  }
  const digits = digitsOf(tckn);
  const at = (index: number) => digits[index] ?? 0;
  const odd = at(0) + at(2) + at(4) + at(6) + at(8);
  const even = at(1) + at(3) + at(5) + at(7);
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((total, digit) => total + digit, 0) % 10;
  return tenth === at(9) && eleventh === at(10);
}

/** An IBAN without spaces or separators, upper-cased: `TR330006100519786457841326`. */
export const normalizeIBAN = (text: string) => text.replaceAll(/[^0-9a-z]/gi, '').toUpperCase();

/** ISO 13616: the country and check digits moved to the end, read as a number, mod 97 is 1. */
function ibanChecksum(iban: string) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = Number.parseInt(char, 36);
    remainder = (value < 10 ? remainder * 10 + value : remainder * 100 + value) % 97;
  }
  return remainder;
}

/** A Turkish IBAN: TR, 24 digits, and the mod-97 check. Spaces and case do not matter. */
export function isValidTRIBAN(text: string) {
  const iban = normalizeIBAN(text);
  return /^TR\d{24}$/.test(iban) && ibanChecksum(iban) === 1;
}

/** The five-digit bank code of a Turkish IBAN (`00061`), or null before it is typed. */
export function ibanBankCode(text: string) {
  const iban = normalizeIBAN(text);
  return /^TR\d{7}/.test(iban) ? iban.slice(4, 9) : null;
}

/** A SWIFT/BIC code: 8 or 11 letters and digits, the country in 5-6. */
export const isValidSWIFT = (text: string) =>
  /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(text.replaceAll(/\s/g, '').toUpperCase());

/** An e-mail address in its common shape: something@domain.tld, no spaces. */
export const isValidEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

const digit = /\d/;
const alphanumeric = /[0-9A-Z]/;

/**
 * An IBAN grouped by four: `TR33 0006 1005 1978 6457 8413 26`. Two letters and
 * two check digits, then up to 30 letters or digits, so a foreign IBAN fits
 * too; isValidTRIBAN decides what is accepted.
 */
export const IBAN_MASK: MaskitoOptions = {
  mask: [
    /[A-Z]/,
    /[A-Z]/,
    digit,
    digit,
    ...Array.from({ length: 30 }, (_, index) =>
      index % 4 === 0 ? [' ', alphanumeric] : [alphanumeric],
    ).flat(),
  ],
};

/** GTİP, the customs tariff number: `8471.30.00.00.00`. */
export const GTIP_MASK: MaskitoOptions = {
  mask: [
    digit,
    digit,
    digit,
    digit,
    '.',
    digit,
    digit,
    '.',
    digit,
    digit,
    '.',
    digit,
    digit,
    '.',
    digit,
    digit,
  ],
};

/** A GTİP's digits in the mask's groups, as far as they go: `847130` is `8471.30`. */
export function formatGTIP(text: string) {
  const digits = text.replaceAll(/\D/g, '').slice(0, 12);
  return [
    digits.slice(0, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
    digits.slice(10, 12),
  ]
    .filter(Boolean)
    .join('.');
}

const PHONE_PREFIX = '+90 ';

/**
 * Turns a pasted or typed number into the digits after +90: `+90 532…`,
 * `0532…` and `532…` all become `532…`. A leading 0 typed into an empty
 * field is dropped too.
 */
const phoneDigits: MaskitoPreprocessor = ({ data, elementState }, actionType) => {
  if (actionType !== 'insert') {
    return { data, elementState };
  }
  let digits = data.replaceAll(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('90')) {
    digits = digits.slice(2);
  }
  const [from] = elementState.selection;
  if (from <= PHONE_PREFIX.length) {
    digits = digits.replace(/^0+/, '');
  }
  return { data: digits, elementState };
};

/** A Turkish phone number: `+90 532 123 45 67`. */
export const TR_PHONE_MASK: MaskitoOptions = {
  mask: [
    ...PHONE_PREFIX,
    digit,
    digit,
    digit,
    ' ',
    digit,
    digit,
    digit,
    ' ',
    digit,
    digit,
    ' ',
    digit,
    digit,
  ],
  preprocessors: [phoneDigits],
};
