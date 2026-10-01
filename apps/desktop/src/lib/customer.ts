import type { Recipient } from './types.ts';

/** Unvan, else "Ad Soyad"; empty when neither is filled. */
export function customerName(customer: Recipient) {
  return (
    customer.title.trim() ||
    [customer.name.trim(), customer.surname.trim()].filter(Boolean).join(' ')
  );
}

/** VKN is 10 digits, TCKN 11. The problem with `value` in Turkish, or null. */
export function taxIDError(value: string) {
  const digits = value.trim();
  if (!digits) {
    return 'VKN veya TCKN gerekli';
  }
  if (!/^\d+$/.test(digits)) {
    return 'Yalnızca rakam girin';
  }
  if (digits.length !== 10 && digits.length !== 11) {
    return 'VKN 10, TCKN 11 hane olmalı';
  }
  return null;
}

/** GİB needs an unvan, or a first and last name for a person. */
export function nameError(customer: Recipient) {
  return customer.title.trim() || (customer.name.trim() && customer.surname.trim())
    ? null
    : 'Unvan ya da ad ve soyad gerekli';
}
