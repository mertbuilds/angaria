import type { MaskitoOptions, MaskitoPostprocessor, MaskitoPreprocessor } from '@maskito/core';

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

/** What an empty phone field starts with: most numbers are Turkish. */
export const PHONE_PREFIX = '+90 ';

/**
 * A phone number in its clean form. Turkish ones (+90, 0532…, 532…) read
 * `+90 532 123 45 67`; another country's keeps its + and digits, grouped as
 * given (`+49 30 1234 5678`; 0049… counts as +49…). `cap` cuts the digits a
 * number can have (10 after +90, 15 in all), for the field as it is typed;
 * the check sees them all.
 */
export function formatPhone(text: string, { cap = false } = {}) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const plus = trimmed.startsWith('+');
  let groups = trimmed.split(/\D+/).filter(Boolean);
  if (!plus && groups.join('').startsWith('00')) {
    groups[0] = groups[0]?.replace(/^00/, '') ?? '';
    groups = groups.filter(Boolean);
  } else if (!plus && !groups.join('').startsWith('90')) {
    // A Turkish number without its country code; no area code starts with 9.
    groups = ['90', ...groups];
  }
  const digits = groups.join('');
  if (digits.startsWith('90')) {
    let national = digits.slice(2).replace(/^0+/, '');
    if (cap) {
      national = national.slice(0, 10);
    }
    const parts = [national.slice(0, 3), national.slice(3, 6), national.slice(6, 8)];
    return ['+90', ...parts, national.slice(8)].filter(Boolean).join(' ');
  }
  if (cap) {
    let room = 15;
    groups = groups.map((group) => {
      const kept = group.slice(0, room);
      room -= kept.length;
      return kept;
    });
  }
  return `+${groups.filter(Boolean).join(' ')}`;
}

const TR_PHONE_SHAPE = /^\+90 \d{3} \d{3} \d{2} \d{2}$/;

/** A Turkish number in full (+90 and 10 digits), or another country's with 8 to 15 digits. */
export function isValidPhone(text: string) {
  const phone = formatPhone(text);
  if (phone.startsWith('+90')) {
    return TR_PHONE_SHAPE.test(phone);
  }
  return /^\+[1-9]/.test(phone) && /^\d{8,15}$/.test(phone.replaceAll(/\D/g, ''));
}

/** The digits and + a caret has before it, so it lands after the same ones once formatted. */
const significantBefore = (text: string, at: number) =>
  text.slice(0, at).replaceAll(/[^\d+]/g, '').length;

function caretAfter(text: string, count: number) {
  if (count === 0) {
    return 0;
  }
  let seen = 0;
  for (const [index, char] of [...text].entries()) {
    if (/[\d+]/.test(char)) {
      seen += 1;
      if (seen === count) {
        return index + 1;
      }
    }
  }
  return text.length;
}

/**
 * Only digits and a leading + go in. A whole number pasted or typed over an
 * empty field (or one holding only the +90 it starts with) replaces it, so
 * `+49…` or `0532…` pasted after +90 is not doubled.
 */
const phoneInsert: MaskitoPreprocessor = ({ data, elementState }, actionType) => {
  if (actionType !== 'insert') {
    return { data, elementState };
  }
  const { selection, value } = elementState;
  const [from, to] = selection;
  const rest = (value.slice(0, from) + value.slice(to)).trim();
  const cleaned = data.replaceAll(/[^\d+]/g, '');
  const whole = cleaned.startsWith('+') || cleaned.replaceAll(/\D/g, '').length >= 10;
  if (whole && (rest === '' || rest === PHONE_PREFIX.trim())) {
    return { data: cleaned, elementState: { selection: [0, 0], value: '' } };
  }
  const plusFirst = from === 0 && !value.startsWith('+') && cleaned.startsWith('+');
  return { data: plusFirst ? cleaned : cleaned.replaceAll('+', ''), elementState };
};

/** Reformats the number as it is typed, keeping the caret after the same digit. */
const phoneFormat: MaskitoPostprocessor = ({ selection, value }) => {
  const formatted = formatPhone(value, { cap: true });
  const caret = caretAfter(formatted, significantBefore(value, selection[1]));
  return { selection: [caret, caret], value: formatted };
};

/** A phone number of any country, Turkish ones as `+90 532 123 45 67`. */
export const PHONE_MASK: MaskitoOptions = {
  mask: /^\+?[\d ]*$/,
  postprocessors: [phoneFormat],
  preprocessors: [phoneInsert],
};
