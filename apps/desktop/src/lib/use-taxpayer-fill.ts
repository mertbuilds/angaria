import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { taxpayerQuery, useGIBAccount } from './gib.ts';
import { useStore } from './store.tsx';
import { isTaxIDPlaceholder, isValidTCKN, isValidVKN } from './tr-validators.ts';
import type { Recipient } from './types.ts';

type Named = Pick<Recipient, 'name' | 'surname' | 'taxIDOrTRID' | 'taxOffice' | 'title'>;

/** The line under VKN / TCKN while the name is the one GİB's registry gave. */
export const TAXPAYER_FILLED = 'Unvan ve vergi dairesi GİB kaydından dolduruldu';

const unnamed = (customer: Named) =>
  !customer.title.trim() && !customer.name.trim() && !customer.surname.trim();

/**
 * A valid VKN / TCKN typed for a customer with no name yet: GİB's registry
 * fills the empty name and tax office fields through `fill`, as the
 * portal's own form does (Yeni fatura, Müşteriler). `skip` for a number that
 * belongs to a saved customer. True while the name is still the registry's.
 */
export function useTaxpayerFill(
  customer: Named,
  fill: (patch: Partial<Recipient>) => void,
  skip = false,
): boolean {
  const account = useGIBAccount();
  const { hasCredentials } = useStore();
  const taxID = customer.taxIDOrTRID.trim();
  const valid = !isTaxIDPlaceholder(taxID) && (isValidVKN(taxID) || isValidTCKN(taxID));
  const lookup = useQuery({
    ...taxpayerQuery(account, taxID),
    enabled: hasCredentials && valid && unnamed(customer) && !skip,
  });
  const found = lookup.data;
  const empty = unnamed(customer);
  const taxOfficeEmpty = !customer.taxOffice.trim();
  useEffect(() => {
    // Only into empty fields: a name typed meanwhile wins.
    if (!found || !empty) {
      return;
    }
    fill({
      name: found.title ? '' : found.name,
      surname: found.title ? '' : found.surname,
      title: found.title,
      ...(taxOfficeEmpty && found.taxOffice ? { taxOffice: found.taxOffice } : {}),
    });
    // fill changes identity on every render; the lookup's answer drives this.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);
  return Boolean(
    found &&
    (found.title
      ? customer.title === found.title
      : customer.name === found.name && customer.surname === found.surname),
  );
}
