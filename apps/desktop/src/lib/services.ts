import { discountForRate, formatAmount, roundKurus } from './invoice-form.ts';
import type { InvoiceItem, Recipient, Service } from './types.ts';
import { shortDate } from './utils.ts';

// A saved service's currency, and its price on an invoice in another currency.
// Kept free of React so the rules can be tested on their own.

/**
 * The currency of every invoice Angaria knows of: the one each invoiced
 * customer was last invoiced in, when they all agree; else undefined.
 */
export function historyCurrency(customers: ReadonlyArray<Recipient>): string | undefined {
  const currencies = new Set(
    customers.filter((customer) => customer.lastInvoicedAt).map((customer) => customer.currency),
  );
  const [currency] = currencies;
  return currencies.size === 1 ? currency : undefined;
}

/**
 * Services saved before they had a currency take historyCurrency's; without
 * one they keep none and count in the invoice's currency until edited.
 */
export function withServiceCurrencies(
  services: ReadonlyArray<Service>,
  customers: ReadonlyArray<Recipient>,
): Array<Service> {
  const currency = historyCurrency(customers);
  return services.map((service) =>
    service.currency || !currency ? service : { ...service, currency },
  );
}

/** A currency as prices name it: TL for TRY, else its code. */
const currencyName = (currency: string) => (currency === 'TRY' ? 'TL' : currency);

/** A price with its currency: "100,00 USD", "4.110,32 TL"; without one, the amount alone. */
export const formatPrice = (value: number, currency?: string) =>
  currency ? `${formatAmount(value)} ${currencyName(currency)}` : formatAmount(value);

/** The rates a service's price can be converted with on an invoice. */
export interface InvoiceRates {
  /** The invoice's currency. */
  currency: string;
  /** The invoice's rate, lira per unit of its currency; null while empty or unparsable. */
  rate: number | null;
  /** true when the invoice's rate was typed in, not TCMB's. */
  rateManual: boolean;
  /** TCMB's bulletin for the invoice date, lira per unit; null while loading or failed. */
  tcmb: { publishedOn: Date; rates: ReadonlyMap<string, number> } | null;
  tcmbFailed: boolean;
}

/** How a price in one currency goes onto an invoice in another. */
export type PriceConversion =
  | {
      /** Lira per unit of the service's currency. */
      fromRate: number;
      kind: 'converted';
      /** true when the invoice's typed rate was used. */
      manualRate: boolean;
      /** The TCMB bulletin a rate came from, if any did. */
      publishedOn: Date | null;
      /** Lira per unit of the invoice's currency. */
      toRate: number;
    }
  | { kind: 'failed' }
  | { kind: 'same' }
  | { kind: 'unpublished' }
  | { kind: 'waiting' };

/**
 * The conversion of a price in `from` onto the invoice: through lira, with
 * TCMB's rate for `from` and the invoice's own rate for its currency (TCMB's
 * from the same bulletin unless typed in). 'waiting' while a rate is not there
 * yet, 'failed' when TCMB's bulletin could not be fetched, 'unpublished' when
 * TCMB has no rate for `from`.
 */
export function priceConversion(from: string, rates: InvoiceRates): PriceConversion {
  if (from === rates.currency) {
    return { kind: 'same' };
  }
  let fromRate = 1;
  let publishedOn: Date | null = null;
  if (from !== 'TRY') {
    if (!rates.tcmb) {
      return { kind: rates.tcmbFailed ? 'failed' : 'waiting' };
    }
    const rate = rates.tcmb.rates.get(from);
    if (rate === undefined) {
      return { kind: 'unpublished' };
    }
    fromRate = rate;
    publishedOn = rates.tcmb.publishedOn;
  }
  let toRate = 1;
  const manualRate = rates.currency !== 'TRY' && rates.rateManual;
  if (rates.currency !== 'TRY') {
    if (rates.rate === null || rates.rate <= 0) {
      return { kind: 'waiting' };
    }
    toRate = rates.rate;
    if (!manualRate) {
      publishedOn = rates.tcmb?.publishedOn ?? publishedOn;
    }
  }
  return { fromRate, kind: 'converted', manualRate, publishedOn, toRate };
}

/** An amount converted, to kuruş. */
export const convertAmount = (
  amount: number,
  { fromRate, toRate }: Extract<PriceConversion, { kind: 'converted' }>,
) => roundKurus((amount * fromRate) / toRate);

/**
 * A row's price and discount converted: a discount rate keeps its rate and
 * comes to the converted price's amount, a discount amount is converted.
 */
export function convertLine(
  row: InvoiceItem,
  conversion: Extract<PriceConversion, { kind: 'converted' }>,
): InvoiceItem {
  const converted = { ...row, unitPrice: convertAmount(row.unitPrice, conversion) };
  return {
    ...converted,
    discountAmount:
      row.discountRate > 0
        ? discountForRate(converted, row.discountRate)
        : convertAmount(row.discountAmount, conversion),
  };
}

/**
 * What the price field says after a service in `from` at `amount` was picked
 * for an invoice in `to`: the conversion and its rate, or why there is none.
 */
export function conversionHint(
  amount: number,
  from: string,
  to: string,
  conversion: PriceConversion,
  today = new Date(),
): string | undefined {
  const original = formatPrice(amount, from);
  switch (conversion.kind) {
    case 'converted': {
      const tcmb = conversion.publishedOn && `TCMB ${shortDate(conversion.publishedOn, today)}`;
      const source = conversion.manualRate
        ? [tcmb, 'girdiğin kur'].filter(Boolean).join(' ve ')
        : tcmb;
      const price = formatPrice(convertAmount(amount, conversion), to);
      return `${original} → ${price}${source ? ` (${source})` : ''}`;
    }
    case 'waiting':
      return `${original}. Kur gelince dönüştürülecek.`;
    case 'failed':
      return `${original}. TCMB kuru alınamadı, fiyatı ${currencyName(to)} olarak yaz.`;
    case 'unpublished':
      return `${original}. TCMB bu para birimi için kur yayınlamıyor, fiyatı ${currencyName(to)} olarak yaz.`;
    case 'same':
      return undefined;
  }
}
