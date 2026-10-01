import type { InvoiceItem } from 'angaria-earsiv-sdk';

export interface RawItem {
  discountAmount?: number;
  discountRate?: number;
  discountReason?: string;
  gtip?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitType?: string;
  VATRate: number;
}

export interface Totals {
  grandTotal: number;
  grandTotalInclVAT: number;
  paymentTotal: number;
  totalDiscount: number;
  totalVAT: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A discount rate without an amount derives the amount from the line price,
 * as the desktop invoice form does. */
export function computeItemFields(raw: RawItem): InvoiceItem {
  const price = round2(raw.quantity * raw.unitPrice);
  const discountRate = raw.discountRate ?? 0;
  const discountAmount = raw.discountAmount ?? round2((price * discountRate) / 100);
  const taxableAmount = round2(price - discountAmount);
  const VATAmount = round2((taxableAmount * raw.VATRate) / 100);

  return {
    discountAmount,
    discountRate,
    discountReason: raw.discountReason ?? '',
    gtip: raw.gtip ?? '',
    name: raw.name,
    price,
    quantity: raw.quantity,
    unitPrice: raw.unitPrice,
    unitType: raw.unitType ?? 'C62',
    VATAmount,
    VATRate: raw.VATRate,
  };
}

export function computeTotals(items: Array<InvoiceItem>): Totals {
  let grandTotal = 0;
  let totalVAT = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const discount = item.discountAmount ?? 0;
    grandTotal += round2(item.price - discount);
    totalVAT += item.VATAmount;
    totalDiscount += discount;
  }

  const grandTotalInclVAT = round2(round2(grandTotal) + round2(totalVAT));

  return {
    grandTotal: round2(grandTotal),
    grandTotalInclVAT,
    paymentTotal: grandTotalInclVAT,
    totalDiscount: round2(totalDiscount),
    totalVAT: round2(totalVAT),
  };
}
