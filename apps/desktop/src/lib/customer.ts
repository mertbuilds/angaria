import type { Recipient } from './types.ts';

/** Unvan, else "Ad Soyad"; empty when neither is filled. */
export function customerName(customer: Recipient) {
  return (
    customer.title.trim() ||
    [customer.name.trim(), customer.surname.trim()].filter(Boolean).join(' ')
  );
}

// Turkish capitals, with İ as I: "Plastic" and "PLASTIC" are one name.
const nameKey = (name: string) =>
  name.trim().replaceAll(/\s+/g, ' ').toLocaleUpperCase('tr').replaceAll('İ', 'I');

/**
 * The saved customer with this VKN / TCKN and name (unvan, else "Ad Soyad"),
 * if any. The name counts too: every customer abroad has VKN 2222222222.
 */
export function findCustomer(customers: ReadonlyArray<Recipient>, taxID: string, name: string) {
  const id = taxID.trim();
  const key = nameKey(name);
  return id
    ? (customers.find(
        (customer) => customer.taxIDOrTRID.trim() === id && nameKey(customerName(customer)) === key,
      ) ?? null)
    : null;
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
